"""ViewSets da API do catálogo.

Leitura é pública; escrita exige JWT de admin (IsAuthenticatedOrReadOnly,
definido como permissão padrão no settings).
"""

import logging
import secrets
from decimal import Decimal, InvalidOperation

from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import F
from django.utils import timezone
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from rest_framework import serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView

from . import evolution, pagamentos, promocoes, relatorios
from .comandos import interpretar
from .estoque import disponibilidade
from .models import (
    Categoria,
    Cliente,
    Cor,
    Encomenda,
    EncomendaImagem,
    EventoPagamento,
    Imagem,
    ItemPedido,
    MensagemWhatsApp,
    Peca,
    Pedido,
    Perfil,
    Promocao,
    Variacao,
)
from .permissions import (
    EhCliente,
    EhEquipeAtiva,
    LeituraPublicaEscritaEquipe,
    PodeFinanceiro,
    SoDono,
    perfil_efetivo,
)
from .notificacoes import (
    enviar_whatsapp,
    notificar_estoque_alterado,
    notificar_variacao_removida,
    _rotulo_variacao,
)
from .serializers import (
    CategoriaSerializer,
    CheckoutSerializer,
    ClienteSerializer,
    ClienteUpdateSerializer,
    ContaCadastroSerializer,
    ContaTokenSerializer,
    CorSerializer,
    EncomendaCreateSerializer,
    EncomendaSerializer,
    CupomValidarSerializer,
    ImagemSerializer,
    MudarSenhaSerializer,
    PecaSerializer,
    PedidoSerializer,
    PromocaoSerializer,
    TokenComPapelSerializer,
    UsuarioCreateSerializer,
    UsuarioSerializer,
    VariacaoSerializer,
)
from .signals import compra_paga, encomenda_criada

logger = logging.getLogger(__name__)

User = get_user_model()

# Janela de validade do pedido aguardando pagamento.
PEDIDO_VALIDADE_MINUTOS = 30


class CategoriaViewSet(viewsets.ModelViewSet):
    queryset = Categoria.objects.all()
    serializer_class = CategoriaSerializer
    permission_classes = [LeituraPublicaEscritaEquipe]


class CorViewSet(viewsets.ModelViewSet):
    """Paleta de cores reutilizável (leitura pública; escrita só a equipe)."""

    queryset = Cor.objects.all()
    serializer_class = CorSerializer
    permission_classes = [LeituraPublicaEscritaEquipe]


class PecaViewSet(viewsets.ModelViewSet):
    serializer_class = PecaSerializer
    permission_classes = [LeituraPublicaEscritaEquipe]
    filterset_fields = ["categoria", "tipo", "destaque"]
    search_fields = ["nome", "descricao"]
    ordering_fields = ["criado_em", "preco", "nome"]

    def get_queryset(self):
        """
        Vitrine pública mostra apenas peças ativas.
        O admin autenticado vê todas (inclusive inativas) para gerenciá-las.
        """
        qs = (
            Peca.objects.select_related("categoria")
            .prefetch_related("variacoes", "imagens")
            .all()
        )
        if not self.request.user.is_authenticated:
            qs = qs.filter(ativo=True)
        return qs


class VariacaoViewSet(viewsets.ModelViewSet):
    queryset = Variacao.objects.select_related("peca").all()
    serializer_class = VariacaoSerializer
    permission_classes = [LeituraPublicaEscritaEquipe]
    filterset_fields = ["peca", "tamanho", "cor"]

    def perform_update(self, serializer):
        estoque_anterior = serializer.instance.estoque
        variacao = serializer.save()
        if "estoque" in serializer.validated_data:
            notificar_estoque_alterado(variacao, estoque_anterior)

    def perform_destroy(self, instance):
        rotulo = _rotulo_variacao(instance)
        estoque_anterior = instance.estoque
        instance.delete()
        notificar_variacao_removida(rotulo, estoque_anterior)


class ImagemViewSet(viewsets.ModelViewSet):
    queryset = Imagem.objects.select_related("peca").all()
    serializer_class = ImagemSerializer
    permission_classes = [LeituraPublicaEscritaEquipe]
    filterset_fields = ["peca", "principal"]


class EncomendaViewSet(viewsets.ModelViewSet):
    """Encomendas (pedidos sob medida).

    - ``create``: público (AllowAny), recebe multipart com imagens de
      referência e é limitado por throttle anti-spam.
    - demais ações (list/retrieve/update/partial_update/destroy): só admin
      autenticado (IsAuthenticated).
    """

    queryset = Encomenda.objects.prefetch_related("imagens").all()
    serializer_class = EncomendaSerializer
    # multipart para o create público (com imagens); JSON para o PATCH de status (admin).
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    filterset_fields = ["status"]

    def get_permissions(self):
        if self.action == "create":
            return [AllowAny()]
        # Ver/atualizar status/excluir encomendas: Dono ou Funcionário ativo.
        return [EhEquipeAtiva()]

    def get_throttles(self):
        if self.action == "create":
            self.throttle_scope = "encomendas"
            return [ScopedRateThrottle()]
        return super().get_throttles()

    def create(self, request, *args, **kwargs):
        """Cria a encomenda + imagens a partir de um único request multipart.

        Não ecoa dados sensíveis do cliente (nome/contato) na resposta.
        """
        serializer = EncomendaCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        # Valida os arquivos (quantidade/tamanho/tipo) reaproveitando a regra
        # do serializer; erros viram {"imagens": [...]} via ValidationError.
        arquivos = request.FILES.getlist("imagens")
        try:
            serializer.validate_imagens(arquivos)
        except serializers.ValidationError as exc:
            raise serializers.ValidationError({"imagens": exc.detail})

        encomenda = serializer.save(status=Encomenda.Status.RECEBIDO)
        EncomendaImagem.objects.bulk_create(
            [EncomendaImagem(encomenda=encomenda, arquivo=arquivo) for arquivo in arquivos]
        )

        # Avisa o dono (bot de WhatsApp). Consumidores são resilientes: uma
        # falha de notificação NUNCA quebra a criação da encomenda.
        encomenda_criada.send(sender=Encomenda, encomenda=encomenda)

        return Response(
            {
                "id": encomenda.id,
                "status": encomenda.status,
                "mensagem": "Encomenda recebida! Em breve entraremos em contato.",
            },
            status=status.HTTP_201_CREATED,
        )

    def update(self, request, *args, **kwargs):
        # Só PATCH parcial de status é suportado; PUT cai em partial também.
        kwargs["partial"] = True
        return super().update(request, *args, **kwargs)


# --------------------------------------------------------------------------
# Pagamento online (Checkout Pro do Mercado Pago) — só peças PRONTAS
# --------------------------------------------------------------------------


class CheckoutView(APIView):
    """Cria um Pedido de peças prontas e a preferência de pagamento no MP.

    Exige **conta de cliente** (``EhCliente``): nome/contato/CPF vêm da conta
    autenticada (o corpo só traz ``itens``). O preço/total é SEMPRE recalculado
    no servidor; valores do cliente são ignorados. O estoque NÃO é decrementado
    aqui — só após o pagamento aprovado (webhook). Throttle anti-abuso reaproveita
    o escopo ``encomendas``.
    """

    permission_classes = [EhCliente]
    throttle_scope = "encomendas"
    throttle_classes = [ScopedRateThrottle]

    def post(self, request, *args, **kwargs):
        serializer = CheckoutSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        dados = serializer.validated_data
        cliente = request.user.cliente

        # Agrega quantidades por variação (caso o cliente repita o id).
        pedido_por_variacao = {}
        for item in dados["itens"]:
            vid = item["variacao_id"]
            pedido_por_variacao[vid] = pedido_por_variacao.get(vid, 0) + item["quantidade"]

        agora = timezone.now()
        expira_em = agora + timezone.timedelta(minutes=PEDIDO_VALIDADE_MINUTOS)
        itens_mp = []
        contato = cliente.telefone or cliente.usuario.email

        # Reserva travada: valida disponibilidade e cria o Pedido/itens dentro de
        # uma transação com lock nas variações (of="self") — dois checkouts
        # simultâneos da MESMA última unidade são serializados, então o segundo já
        # vê a reserva do primeiro e recebe 409 (reduz a corrida na origem). O
        # retorno de erro dentro do bloco apenas encerra a transação (nada gravado).
        with transaction.atomic():
            variacoes = (
                Variacao.objects.select_for_update(of=("self",))
                .select_related("peca")
                .filter(id__in=pedido_por_variacao.keys())
            )
            por_id = {v.id: v for v in variacoes}

            # Valida existência, peça ativa e do tipo "pronta".
            for vid in pedido_por_variacao:
                variacao = por_id.get(vid)
                if variacao is None:
                    return Response(
                        {"itens": [f"Variação {vid} não encontrada."]},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                if not variacao.peca.ativo or variacao.peca.tipo != Peca.Tipo.PRONTA:
                    return Response(
                        {"itens": ["Esta peça não está disponível para compra online."]},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

            # Disponibilidade sob lock (estoque − reservas ativas).
            disp = disponibilidade(por_id.values())
            for vid, qtd in pedido_por_variacao.items():
                if qtd > disp.get(vid, 0):
                    return Response(
                        {
                            "disponibilidade": [
                                "Estoque insuficiente para um ou mais itens. "
                                "Atualize o carrinho e tente novamente."
                            ]
                        },
                        status=status.HTTP_409_CONFLICT,
                    )

            # Itens para o motor de descontos (preço do banco, nunca do cliente).
            itens_calc = [
                {
                    "peca": por_id[vid].peca,
                    "quantidade": qtd,
                    "preco": por_id[vid].peca.preco,
                }
                for vid, qtd in pedido_por_variacao.items()
            ]

            # Cupom opcional: valida no servidor (silencioso — cupom inválido é
            # ignorado, o cliente já viu o erro em /cupom/validar/ antes de pagar).
            cupom = None
            codigo_cupom = (dados.get("cupom") or "").strip()
            if codigo_cupom:
                cupom, _erro = promocoes.validar_cupom(codigo_cupom, itens_calc)

            resumo = promocoes.calcular(itens_calc, cupom=cupom)
            total = resumo["total"]
            desconto = resumo["desconto"]

            # Cria o pedido + itens (preço unitário de catálogo travado no item; o
            # desconto fica no Pedido e o total já vai descontado ao MP).
            pedido = Pedido.objects.create(
                cliente=cliente,
                nome=cliente.nome,
                contato=contato,
                status=Pedido.Status.AGUARDANDO_PAGAMENTO,
                total=total,
                desconto=desconto,
                cupom=cupom,
                expira_em=expira_em,
            )
            for vid, qtd in pedido_por_variacao.items():
                variacao = por_id[vid]
                preco_unit = variacao.peca.preco  # preço do banco, nunca do cliente
                ItemPedido.objects.create(
                    pedido=pedido,
                    variacao=variacao,
                    quantidade=qtd,
                    preco_unit=preco_unit,
                )
                itens_mp.append(
                    {
                        "title": variacao.peca.nome,
                        "quantity": qtd,
                        "unit_price": float(preco_unit),
                        "currency_id": "BRL",
                    }
                )

        # Se houve desconto, o MP recebe UMA linha com o total já descontado
        # (garante que o valor cobrado == total do servidor, sem erro de rateio).
        if desconto > 0:
            n = sum(pedido_por_variacao.values())
            itens_mp = [
                {
                    "title": f"{pedido.codigo} — {n} {'item' if n == 1 else 'itens'}",
                    "quantity": 1,
                    "unit_price": float(total),
                    "currency_id": "BRL",
                }
            ]

        # Cria a preferência no Mercado Pago (fora da transação de banco).
        base_url = settings.MP_PUBLIC_URL.rstrip("/")
        notification_url = f"{base_url}/api/webhooks/mercadopago/"
        payer = {
            "name": cliente.nome,
            "email": cliente.usuario.email,
            "identification": {"type": "CPF", "number": cliente.cpf},
        }
        try:
            resposta = pagamentos.criar_preferencia(
                pedido,
                itens_mp,
                base_url=base_url,
                frontend_url=settings.FRONTEND_URL,
                notification_url=notification_url,
                payer=payer,
            )
        except Exception:
            # Não vaza detalhes do provedor; o pedido fica pendente e expira.
            return Response(
                {
                    "detalhe": [
                        "Não foi possível iniciar o pagamento agora. Tente novamente."
                    ]
                },
                status=status.HTTP_502_BAD_GATEWAY,
            )

        pref_id = resposta.get("id", "")
        init_point = resposta.get("init_point") or resposta.get("sandbox_init_point") or ""
        if pref_id:
            pedido.mp_preference_id = pref_id
            pedido.save(update_fields=["mp_preference_id"])

        return Response(
            {"pedido_id": pedido.id, "init_point": init_point},
            status=status.HTTP_201_CREATED,
        )


@method_decorator(csrf_exempt, name="dispatch")
class WebhookMercadoPagoView(APIView):
    """Recebe notificações de pagamento do Mercado Pago.

    Público (AllowAny) + CSRF isento. Valida a assinatura HMAC, garante
    idempotência via EventoPagamento, confirma o pagamento no MP e — só se
    aprovado — decrementa o estoque dentro de um lock de banco.
    """

    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request, *args, **kwargs):
        # O MP manda o id do recurso em query (?data.id=) e/ou no corpo.
        data_id = (
            request.query_params.get("data.id")
            or request.query_params.get("id")
            or (request.data.get("data", {}) or {}).get("id")
            or request.data.get("id")
        )
        tipo = (
            request.query_params.get("type")
            or request.query_params.get("topic")
            or request.data.get("type")
            or request.data.get("topic")
        )

        if not pagamentos.assinatura_valida(request, data_id):
            return Response(
                {"detalhe": "Assinatura inválida."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        # Só tratamos notificações de pagamento.
        if tipo and tipo != "payment":
            return Response(status=status.HTTP_200_OK)

        if not data_id:
            return Response(status=status.HTTP_200_OK)

        # Idempotência: evento já processado → 200 e para.
        if EventoPagamento.objects.filter(evento_id=str(data_id)).exists():
            return Response(status=status.HTTP_200_OK)

        # Confirma o pagamento no MP.
        try:
            pagamento = pagamentos.consultar_pagamento(data_id)
        except Exception:
            # Erro ao consultar: não confirma; o MP reenviará a notificação.
            return Response(status=status.HTTP_200_OK)

        if (pagamento or {}).get("status") != "approved":
            # Pagamento não aprovado: nada a fazer (não registra evento).
            return Response(status=status.HTTP_200_OK)

        external_reference = pagamento.get("external_reference")
        if not external_reference:
            return Response(status=status.HTTP_200_OK)

        # Valor efetivamente aprovado no MP (anti-fraude: tem de bater com o total).
        valor_pago = pagamento.get("transaction_amount")
        self._confirmar_pedido(external_reference, str(data_id), valor_pago)
        return Response(status=status.HTTP_200_OK)

    @staticmethod
    def _valor_confere(valor_pago, total) -> bool:
        """True se o valor aprovado no MP bate com o total do pedido (±1 centavo)."""
        try:
            pago = Decimal(str(valor_pago))
        except (InvalidOperation, TypeError, ValueError):
            return False
        return abs(pago - total) <= Decimal("0.01")

    @staticmethod
    def _marcar_em_revisao(pedido, motivo, evento_id):
        """Pago no MP mas NÃO atendido: vira 'em revisão' (dono trata/estorna).

        Nunca baixa estoque nem conta cupom. O motivo fica registrado para o admin.
        """
        pedido.status = Pedido.Status.EM_REVISAO
        pedido.motivo_revisao = motivo
        pedido.mp_payment_id = evento_id
        pedido.save(update_fields=["status", "motivo_revisao", "mp_payment_id"])

    def _confirmar_pedido(self, pedido_id, evento_id, valor_pago=None):
        """Confirma o pagamento (baixa estoque + marca pago), com lock + idempotência.

        Três casos viram **em revisão** (pago no MP, mas não atendido — sem baixar
        estoque; o dono trata/estorna pelo admin): valor divergente do total,
        pagamento após a expiração e falta de estoque na hora da confirmação.
        Logs sem PII; idempotência preservada via ``EventoPagamento``.
        """
        with transaction.atomic():
            # Idempotência forte dentro da transação: cria o evento primeiro;
            # se já existir (corrida), aborta sem mexer no estoque.
            _, criado = EventoPagamento.objects.get_or_create(evento_id=evento_id)
            if not criado:
                return

            try:
                pedido = Pedido.objects.select_for_update().get(pk=pedido_id)
            except Pedido.DoesNotExist:
                return

            # Já resolvido: não reprocessa (idempotência de estado).
            if pedido.status in (Pedido.Status.PAGO, Pedido.Status.EM_REVISAO):
                return

            # (1) Anti-fraude: valor aprovado diferente do total → em revisão.
            if valor_pago is not None and not self._valor_confere(valor_pago, pedido.total):
                self._marcar_em_revisao(
                    pedido, Pedido.MotivoRevisao.DIVERGENCIA_VALOR, evento_id
                )
                logger.warning(
                    "Webhook MP: valor aprovado diverge do total do pedido %s — em revisão.",
                    pedido.codigo,
                )
                return

            # (2) Pago após a expiração da reserva → em revisão (precisa estorno).
            if pedido.status == Pedido.Status.EXPIRADO or pedido.expira_em <= timezone.now():
                self._marcar_em_revisao(
                    pedido, Pedido.MotivoRevisao.PAGO_APOS_EXPIRACAO, evento_id
                )
                logger.warning(
                    "Webhook MP: pagamento após a expiração do pedido %s — em revisão.",
                    pedido.codigo,
                )
                return

            itens = list(pedido.itens.select_related("variacao").all())
            variacao_ids = [i.variacao_id for i in itens]
            # Lock nas variações para evitar venda concorrente do último item.
            travadas = {
                v.id: v
                for v in Variacao.objects.select_for_update().filter(id__in=variacao_ids)
            }

            # (3) Sem estoque na confirmação (corrida) → em revisão (precisa estorno).
            # O estoque continua seguro (nunca baixa sem lastro / nunca fica negativo).
            suficiente = all(
                travadas[i.variacao_id].estoque >= i.quantidade for i in itens
            )
            if not suficiente:
                self._marcar_em_revisao(
                    pedido, Pedido.MotivoRevisao.SEM_ESTOQUE_APOS_PAGO, evento_id
                )
                logger.warning(
                    "Webhook MP: sem estoque na confirmação do pedido %s — em revisão.",
                    pedido.codigo,
                )
                return

            for item in itens:
                variacao = travadas[item.variacao_id]
                variacao.estoque -= item.quantidade
                variacao.save(update_fields=["estoque"])

            pedido.status = Pedido.Status.PAGO
            pedido.mp_payment_id = evento_id
            pedido.save(update_fields=["status", "mp_payment_id"])

            # Conta o uso do cupom SÓ quando o pedido é pago (não no abandono),
            # com lock na promoção para evitar corrida.
            if pedido.cupom_id:
                Promocao.objects.select_for_update().filter(pk=pedido.cupom_id).update(
                    usos=F("usos") + 1
                )

        # Sinal disparado fora da transação (consumidores externos: bot WhatsApp).
        compra_paga.send(sender=Pedido, pedido=pedido)


def _so_digitos(valor) -> str:
    """Devolve apenas os dígitos de ``valor`` (str)."""
    return "".join(c for c in str(valor or "") if c.isdigit())


def _variantes_numero_whatsapp(valor) -> set[str]:
    """Variações aceitas para números BR com/sem nono dígito no JID."""
    numero = _so_digitos(valor)
    variantes = {numero} if numero else set()

    # WhatsApp/Baileys às vezes entrega JIDs brasileiros sem o nono dígito:
    # 55 + DDD + 9 + 8 dígitos -> 55 + DDD + 8 dígitos.
    if numero.startswith("55") and len(numero) == 13 and numero[4] == "9":
        variantes.add(numero[:4] + numero[5:])
    elif numero.startswith("55") and len(numero) == 12:
        variantes.add(numero[:4] + "9" + numero[4:])

    return variantes


@method_decorator(csrf_exempt, name="dispatch")
class WhatsappWebhookView(APIView):
    """Recebe eventos ``messages.upsert`` da Evolution API (webhook de entrada).

    Privado de fato por autorização de remetente: SÓ processa mensagens cujo
    número está em ``settings.WHATSAPP_DONO`` (comparação só por dígitos). Outro
    remetente é IGNORADO em silêncio (200, sem resposta).

    Público para o Django (AllowAny + CSRF isento): a Evolution chama de fora da
    sessão. Idempotência por ``MensagemWhatsApp`` (``data.key.id``). Erros de
    processamento NUNCA viram 500 para a Evolution — retornamos 200 e logamos só
    uma falha genérica (sem PII). Espelha ``WebhookMercadoPagoView``.
    """

    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request, *args, **kwargs):
        try:
            self._processar(request)
        except Exception:
            # Nunca devolve 5xx à Evolution (evitaria reenvio infinito); loga
            # apenas uma falha genérica, sem conteúdo nem números.
            logger.warning("Falha ao processar webhook de WhatsApp.")
        return Response(status=status.HTTP_200_OK)

    def _processar(self, request):
        corpo = request.data if isinstance(request.data, dict) else {}
        if corpo.get("event") != "messages.upsert":
            return

        data = corpo.get("data") or {}
        chave = data.get("key") or {}
        if chave.get("fromMe"):
            return

        texto = self._extrair_texto(data.get("message") or {})
        if not texto:
            return

        # Autorização: só o(s) dono(s).
        remetente = _so_digitos((chave.get("remoteJid") or "").split("@")[0])
        autorizados = set()
        for numero in getattr(settings, "WHATSAPP_DONO", []):
            autorizados.update(_variantes_numero_whatsapp(numero))
        for lid in getattr(settings, "WHATSAPP_DONO_LID", []):
            lid = _so_digitos(lid)
            if lid:
                autorizados.add(lid)
        if not remetente or remetente not in autorizados:
            return  # ignora em silêncio

        # Idempotência: mesmo data.key.id → no-op.
        mensagem_id = chave.get("id")
        if mensagem_id:
            _, criado = MensagemWhatsApp.objects.get_or_create(mensagem_id=str(mensagem_id))
            if not criado:
                return

        resposta = interpretar(texto)
        if resposta:
            enviar_whatsapp(resposta)

    @staticmethod
    def _extrair_texto(mensagem: dict) -> str:
        texto = mensagem.get("conversation")
        if not texto:
            estendida = mensagem.get("extendedTextMessage") or {}
            texto = estendida.get("text")
        return (texto or "").strip()


class PedidoViewSet(viewsets.ReadOnlyModelViewSet):
    """Listagem/detalhe de pedidos online (somente admin autenticado).

    Inclui itens aninhados e os ids do Mercado Pago. Filtro por ``status``.
    """

    queryset = Pedido.objects.prefetch_related("itens__variacao__peca").all()
    serializer_class = PedidoSerializer
    # Financeiro: Dono, ou Funcionário com acesso_financeiro liberado.
    permission_classes = [PodeFinanceiro]
    filterset_fields = ["status"]

    @action(detail=True, methods=["patch"], url_path="rastreio")
    def rastreio(self, request, pk=None):
        """Grava/edita o código de rastreio dos Correios (só em pedido PAGO).

        Demais campos do pedido seguem somente leitura — aqui só mexe no
        ``codigo_rastreio`` e NÃO altera o status. Gate financeiro (do viewset).
        """
        pedido = self.get_object()
        if pedido.status != Pedido.Status.PAGO:
            return Response(
                {"codigo_rastreio": ["Só é possível adicionar rastreio a um pedido pago."]},
                status=status.HTTP_400_BAD_REQUEST,
            )
        codigo = (request.data.get("codigo_rastreio") or "").strip()
        if len(codigo) > 60:
            return Response(
                {"codigo_rastreio": ["Código de rastreio muito longo (máx. 60 caracteres)."]},
                status=status.HTTP_400_BAD_REQUEST,
            )
        # Permite limpar (string vazia) ou definir um novo código.
        pedido.codigo_rastreio = codigo
        pedido.save(update_fields=["codigo_rastreio"])
        return Response(PedidoSerializer(pedido).data)


# --------------------------------------------------------------------------
# Conexão do WhatsApp (bot do dono) — proxy admin para a Evolution API
# --------------------------------------------------------------------------
# O backend é o PROXY: guarda a EVOLUTION_API_KEY e fala com a Evolution; o
# navegador (admin) nunca vê o segredo. Todas as ações exigem JWT de admin.




class WhatsappDonoView(APIView):
    """Consulta e atualiza o numero autorizado do dono (Configurações — só Dono)."""

    permission_classes = [SoDono]

    def get(self, request, *args, **kwargs):
        return Response(evolution.whatsapp_dono_atual())

    def put(self, request, *args, **kwargs):
        return self._salvar(request)

    def patch(self, request, *args, **kwargs):
        return self._salvar(request)

    def _salvar(self, request):
        numero = request.data.get("numero", "")
        try:
            dados = evolution.atualizar_whatsapp_dono(numero)
        except ValueError as exc:
            raise serializers.ValidationError({"numero": [str(exc)]})
        return Response({**dados, "mensagem": "WhatsApp do dono atualizado."})

class WhatsappConexaoStatusView(APIView):
    """Estado da conexão do WhatsApp do dono (Configurações — só Dono)."""

    permission_classes = [SoDono]

    def get(self, request, *args, **kwargs):
        return Response(evolution.estado_conexao())


class WhatsappConectarView(APIView):
    """Garante a instância e devolve o QR Code para parear o número (só Dono)."""

    permission_classes = [SoDono]

    def post(self, request, *args, **kwargs):
        return Response(evolution.conectar())


class WhatsappDesconectarView(APIView):
    """Desconecta (logout) o número da instância (só Dono)."""

    permission_classes = [SoDono]

    def post(self, request, *args, **kwargs):
        return Response(evolution.desconectar())


# --------------------------------------------------------------------------
# Contas do painel — login com papel, identidade (/me/), troca de senha e
# gestão de funcionários (só Dono).
# --------------------------------------------------------------------------


class LoginView(TokenObtainPairView):
    """Login JWT que inclui o papel/acesso_financeiro nas claims do token."""

    serializer_class = TokenComPapelSerializer


def _gerar_senha_provisoria() -> str:
    """Senha provisória aleatória, forte o bastante para os validadores padrão."""
    return secrets.token_urlsafe(9)


class MeView(APIView):
    """Identidade do usuário logado (o front decide o que mostrar)."""

    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        perfil = perfil_efetivo(request.user)
        return Response(
            {
                "usuario": request.user.username,
                "nome": request.user.first_name,
                "papel": perfil.papel if perfil else None,
                "ativo": bool(perfil),
                "senha_provisoria": bool(perfil and perfil.senha_provisoria),
                "acesso_financeiro": bool(perfil and perfil.acesso_financeiro),
            }
        )


class MudarSenhaView(APIView):
    """Troca da própria senha. Ao trocar, limpa ``senha_provisoria``."""

    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        serializer = MudarSenhaSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        user = request.user
        if not user.check_password(serializer.validated_data["senha_atual"]):
            raise serializers.ValidationError(
                {"senha_atual": ["Senha atual incorreta."]}
            )
        user.set_password(serializer.validated_data["nova_senha"])
        user.save(update_fields=["password"])
        perfil = getattr(user, "perfil", None)
        if perfil is not None and perfil.senha_provisoria:
            perfil.senha_provisoria = False
            perfil.save(update_fields=["senha_provisoria"])
        return Response({"mensagem": "Senha atualizada com sucesso."})


class UsuarioViewSet(viewsets.ModelViewSet):
    """Gestão de FUNCIONÁRIOS — exclusiva do Dono (reforçada no backend).

    Lista/gerencia apenas perfis de papel ``funcionario`` (o Dono não se
    autoexclui nem edita outros donos por aqui). Senhas nunca são logadas; a
    senha provisória gerada num reset volta UMA vez na resposta, para o Dono
    repassar ao funcionário.
    """

    permission_classes = [SoDono]
    serializer_class = UsuarioSerializer
    queryset = (
        User.objects.select_related("perfil")
        .filter(perfil__papel=Perfil.Papel.FUNCIONARIO)
        .order_by("-perfil__criado_em")
    )

    def create(self, request, *args, **kwargs):
        serializer = UsuarioCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        dados = serializer.validated_data
        with transaction.atomic():
            user = User.objects.create_user(
                username=dados["usuario"],
                email=dados.get("email", "") or "",
                password=dados["senha"],
                first_name=dados.get("nome", "") or "",
            )
            Perfil.objects.create(
                usuario=user,
                papel=Perfil.Papel.FUNCIONARIO,
                ativo=True,
                acesso_financeiro=dados.get("acesso_financeiro", False),
                senha_provisoria=True,
                criado_por=request.user if request.user.is_authenticated else None,
            )
        return Response(UsuarioSerializer(user).data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        return self._atualizar(request)

    def partial_update(self, request, *args, **kwargs):
        return self._atualizar(request)

    def _atualizar(self, request):
        """Ativar/desativar, liberar/revogar financeiro e resetar senha."""
        user = self.get_object()
        perfil = user.perfil
        extra = {}

        if "ativo" in request.data:
            ativo = bool(request.data["ativo"])
            perfil.ativo = ativo
            # Sincroniza com User.is_active para bloquear o login de imediato.
            if user.is_active != ativo:
                user.is_active = ativo
                user.save(update_fields=["is_active"])

        if "acesso_financeiro" in request.data:
            perfil.acesso_financeiro = bool(request.data["acesso_financeiro"])

        # Reset de senha: gera uma provisória (mostrada ao Dono) ou usa a enviada.
        senha = None
        if request.data.get("resetar_senha"):
            senha = _gerar_senha_provisoria()
        elif request.data.get("senha"):
            senha = str(request.data["senha"])
            serializer = UsuarioCreateSerializer()
            senha = serializer.validate_senha(senha)
        if senha:
            user.set_password(senha)
            user.save(update_fields=["password"])
            perfil.senha_provisoria = True
            extra["senha_provisoria_gerada"] = senha

        perfil.save()
        saida = UsuarioSerializer(user).data
        saida.update(extra)
        return Response(saida)


# --------------------------------------------------------------------------
# Conta do CLIENTE da loja (cadastro/login/perfil/histórico) — separada do staff
# --------------------------------------------------------------------------


class ContaCadastroView(APIView):
    """Cadastro público de cliente: cria User (e-mail = login) + Cliente.

    Não ecoa CPF/senha. Throttle anti-abuso reaproveita o escopo ``encomendas``.
    """

    permission_classes = [AllowAny]
    throttle_scope = "encomendas"
    throttle_classes = [ScopedRateThrottle]

    def post(self, request, *args, **kwargs):
        serializer = ContaCadastroSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        dados = serializer.validated_data
        with transaction.atomic():
            user = User.objects.create_user(
                username=dados["email"],
                email=dados["email"],
                password=dados["senha"],
                first_name=dados["nome"][:150],
                is_staff=False,
            )
            Cliente.objects.create(
                usuario=user,
                nome=dados["nome"],
                cpf=dados["cpf"],
                telefone=dados.get("telefone", "") or "",
            )
        return Response(
            {"mensagem": "Conta criada com sucesso! Faça login para continuar."},
            status=status.HTTP_201_CREATED,
        )


class ContaLoginView(TokenObtainPairView):
    """Login do cliente (e-mail + senha) → JWT. Recusa contas de staff."""

    serializer_class = ContaTokenSerializer


class ContaMeView(APIView):
    """Dados da conta do cliente logado. GET (ver) / PATCH (editar nome/telefone)."""

    permission_classes = [EhCliente]

    def get(self, request, *args, **kwargs):
        return Response(ClienteSerializer(request.user.cliente).data)

    def patch(self, request, *args, **kwargs):
        cliente = request.user.cliente
        serializer = ClienteUpdateSerializer(cliente, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(ClienteSerializer(cliente).data)


class ContaSenhaView(APIView):
    """Troca da própria senha (cliente logado)."""

    permission_classes = [EhCliente]

    def post(self, request, *args, **kwargs):
        serializer = MudarSenhaSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        user = request.user
        if not user.check_password(serializer.validated_data["senha_atual"]):
            raise serializers.ValidationError({"senha_atual": ["Senha atual incorreta."]})
        user.set_password(serializer.validated_data["nova_senha"])
        user.save(update_fields=["password"])
        return Response({"mensagem": "Senha atualizada com sucesso."})


class ContaPedidosView(viewsets.ReadOnlyModelViewSet):
    """Histórico de pedidos do PRÓPRIO cliente (somente leitura)."""

    serializer_class = PedidoSerializer
    permission_classes = [EhCliente]
    filterset_fields = ["status"]

    def get_queryset(self):
        return (
            Pedido.objects.filter(cliente=self.request.user.cliente)
            .prefetch_related("itens__variacao__peca")
            .all()
        )


# --------------------------------------------------------------------------
# Promoções / cupons
# --------------------------------------------------------------------------


class PromocaoViewSet(viewsets.ModelViewSet):
    """CRUD de promoções/cupons — gate FINANCEIRO (Dono ou acesso_financeiro)."""

    queryset = Promocao.objects.prefetch_related("pecas", "categorias").all()
    serializer_class = PromocaoSerializer
    permission_classes = [PodeFinanceiro]
    filterset_fields = ["tipo_aplicacao", "ativo", "escopo"]


# --------------------------------------------------------------------------
# Relatórios financeiros (gate PodeFinanceiro) — agregações no servidor.
# Cada endpoint devolve JSON por padrão; com ?formato=csv|pdf baixa o arquivo.
# --------------------------------------------------------------------------


class _RelatorioView(APIView):
    """Base dos relatórios: gate financeiro + dispatch JSON × exportação.

    A subclasse implementa ``montar(request) -> (dados, exportacao)`` onde
    ``exportacao`` é um dict com ``nome``/``titulo``/``subtitulo``/``cabecalhos``/
    ``linhas`` para CSV/PDF. Erros de parâmetro (data/mês inválido) viram 400.
    """

    permission_classes = [PodeFinanceiro]

    def get(self, request, *args, **kwargs):
        try:
            dados, exportacao = self.montar(request)
        except ValueError as exc:
            return Response({"detalhe": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        formato = (request.query_params.get("formato") or "").lower()
        if formato in ("csv", "pdf"):
            try:
                return relatorios.exportar(
                    formato,
                    exportacao["nome"],
                    exportacao["titulo"],
                    exportacao["subtitulo"],
                    exportacao["cabecalhos"],
                    exportacao["linhas"],
                )
            except Exception:
                logger.warning("Falha ao gerar arquivo de relatório (%s).", formato)
                return Response(
                    {"detalhe": "Não foi possível gerar o arquivo agora. Tente novamente."},
                    status=status.HTTP_503_SERVICE_UNAVAILABLE,
                )
        return Response(dados)


class RelatorioVendasPeriodoView(_RelatorioView):
    """Faturamento e nº de pedidos pagos por dia/semana/mês (filtro de datas)."""

    def montar(self, request):
        dados = relatorios.vendas_por_periodo(
            de=request.query_params.get("de"),
            ate=request.query_params.get("ate"),
            granularidade=request.query_params.get("granularidade", "dia"),
        )
        cabecalhos = ["Período", "Faturamento (R$)", "Pedidos pagos"]
        linhas = [
            [s["periodo"], relatorios.moeda_br(s["faturamento"]), s["pedidos"]]
            for s in dados["series"]
        ]
        linhas.append(
            [
                "Total",
                relatorios.moeda_br(dados["totais"]["faturamento"]),
                dados["totais"]["pedidos"],
            ]
        )
        exportacao = {
            "nome": f"vendas-por-periodo-{dados['de']}-a-{dados['ate']}",
            "titulo": "Vendas por período",
            "subtitulo": (
                f"De {relatorios.data_br(dados['de'])} a "
                f"{relatorios.data_br(dados['ate'])} · por {dados['granularidade']}"
            ),
            "cabecalhos": cabecalhos,
            "linhas": linhas,
        }
        return dados, exportacao


class RelatorioProdutosVendidosView(_RelatorioView):
    """Ranking de variações por quantidade e receita (top N, filtro de datas)."""

    def montar(self, request):
        dados = relatorios.produtos_mais_vendidos(
            de=request.query_params.get("de"),
            ate=request.query_params.get("ate"),
            top=request.query_params.get("top", 20),
        )
        cabecalhos = ["Peça", "Variação", "Quantidade", "Receita (R$)"]
        linhas = [
            [
                i["peca_nome"],
                i["variacao_descricao"],
                i["quantidade"],
                relatorios.moeda_br(i["receita"]),
            ]
            for i in dados["itens"]
        ]
        exportacao = {
            "nome": f"produtos-mais-vendidos-{dados['de']}-a-{dados['ate']}",
            "titulo": "Produtos mais vendidos",
            "subtitulo": (
                f"De {relatorios.data_br(dados['de'])} a "
                f"{relatorios.data_br(dados['ate'])} · top {dados['top']}"
            ),
            "cabecalhos": cabecalhos,
            "linhas": linhas,
        }
        return dados, exportacao


class RelatorioResumoMesView(_RelatorioView):
    """Resumo do mês: faturamento, vendas, ticket médio, desconto e cupons."""

    def montar(self, request):
        dados = relatorios.resumo_do_mes(mes=request.query_params.get("mes"))
        cabecalhos = ["Indicador", "Valor"]
        linhas = [
            ["Faturamento (R$)", relatorios.moeda_br(dados["faturamento"])],
            ["Vendas pagas", dados["num_vendas"]],
            ["Ticket médio (R$)", relatorios.moeda_br(dados["ticket_medio"])],
            ["Desconto concedido (R$)", relatorios.moeda_br(dados["desconto_concedido"])],
        ]
        if dados["cupons"]:
            linhas.append(["", ""])
            linhas.append(["Cupom", "Usos / Valor descontado (R$)"])
            for c in dados["cupons"]:
                rotulo = f"{c['nome']} ({c['codigo']})" if c["codigo"] else c["nome"]
                linhas.append(
                    [rotulo, f"{c['usos']} / {relatorios.moeda_br(c['valor_descontado'])}"]
                )
        exportacao = {
            "nome": f"resumo-do-mes-{dados['mes']}",
            "titulo": "Resumo do mês",
            "subtitulo": f"Mês de referência: {dados['mes_rotulo']}",
            "cabecalhos": cabecalhos,
            "linhas": linhas,
        }
        return dados, exportacao


class CupomValidarView(APIView):
    """Pré-valida um cupom contra o carrinho (público) e devolve o desconto.

    NÃO aplica nada — só informa ao cliente, antes de pagar, se o cupom vale e
    quanto abate. O desconto definitivo é recalculado no checkout (servidor).
    """

    permission_classes = [AllowAny]
    throttle_scope = "encomendas"
    throttle_classes = [ScopedRateThrottle]

    def post(self, request, *args, **kwargs):
        serializer = CupomValidarSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        dados = serializer.validated_data

        # Monta os itens a partir do banco (preço nunca vem do cliente).
        por_variacao = {}
        for item in dados["itens"]:
            vid = item["variacao_id"]
            por_variacao[vid] = por_variacao.get(vid, 0) + item["quantidade"]
        variacoes = Variacao.objects.select_related("peca").filter(
            id__in=por_variacao.keys()
        )
        itens_calc = [
            {"peca": v.peca, "quantidade": por_variacao[v.id], "preco": v.peca.preco}
            for v in variacoes
            if v.peca.ativo and v.peca.tipo == Peca.Tipo.PRONTA
        ]
        if not itens_calc:
            return Response(
                {"valido": False, "mensagem": "Adicione itens ao carrinho para usar um cupom."},
                status=status.HTTP_200_OK,
            )

        cupom, erro = promocoes.validar_cupom(dados["codigo"], itens_calc)
        if erro:
            return Response({"valido": False, "mensagem": erro}, status=status.HTTP_200_OK)

        resumo = promocoes.calcular(itens_calc, cupom=cupom)
        return Response(
            {
                "valido": True,
                "codigo": cupom.codigo,
                "desconto": f"{resumo['desconto']:.2f}",
                "total_bruto": f"{resumo['bruto']:.2f}",
                "total": f"{resumo['total']:.2f}",
                "mensagem": "Cupom aplicado.",
            },
            status=status.HTTP_200_OK,
        )
