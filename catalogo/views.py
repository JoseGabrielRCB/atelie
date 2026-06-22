"""ViewSets da API do catálogo.

Leitura é pública; escrita exige JWT de admin (IsAuthenticatedOrReadOnly,
definido como permissão padrão no settings).
"""

from decimal import Decimal

from django.conf import settings
from django.db import transaction
from django.utils import timezone
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from rest_framework import serializers, status, viewsets
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

import logging

from . import evolution, pagamentos
from .comandos import interpretar
from .estoque import disponibilidade
from .models import (
    Categoria,
    Cor,
    Encomenda,
    EncomendaImagem,
    EventoPagamento,
    Imagem,
    ItemPedido,
    MensagemWhatsApp,
    Peca,
    Pedido,
    Variacao,
)
from .notificacoes import enviar_whatsapp
from .serializers import (
    CategoriaSerializer,
    CheckoutSerializer,
    CorSerializer,
    EncomendaCreateSerializer,
    EncomendaSerializer,
    ImagemSerializer,
    PecaSerializer,
    PedidoSerializer,
    VariacaoSerializer,
)
from .signals import compra_paga, encomenda_criada

logger = logging.getLogger(__name__)

# Janela de validade do pedido aguardando pagamento.
PEDIDO_VALIDADE_MINUTOS = 30


class CategoriaViewSet(viewsets.ModelViewSet):
    queryset = Categoria.objects.all()
    serializer_class = CategoriaSerializer


class CorViewSet(viewsets.ModelViewSet):
    """Paleta de cores reutilizável (leitura pública; escrita só admin)."""

    queryset = Cor.objects.all()
    serializer_class = CorSerializer


class PecaViewSet(viewsets.ModelViewSet):
    serializer_class = PecaSerializer
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
    filterset_fields = ["peca", "tamanho", "cor"]


class ImagemViewSet(viewsets.ModelViewSet):
    queryset = Imagem.objects.select_related("peca").all()
    serializer_class = ImagemSerializer
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
        return [IsAuthenticated()]

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

    Público (AllowAny). O preço/total é SEMPRE recalculado no servidor a partir
    do banco; valores enviados pelo cliente são ignorados. O estoque NÃO é
    decrementado aqui — só após o pagamento aprovado (webhook). Throttle
    anti-abuso reaproveita o escopo ``encomendas``.
    """

    permission_classes = [AllowAny]
    throttle_scope = "encomendas"
    throttle_classes = [ScopedRateThrottle]

    def post(self, request, *args, **kwargs):
        serializer = CheckoutSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        dados = serializer.validated_data

        # Agrega quantidades por variação (caso o cliente repita o id).
        pedido_por_variacao = {}
        for item in dados["itens"]:
            vid = item["variacao_id"]
            pedido_por_variacao[vid] = pedido_por_variacao.get(vid, 0) + item["quantidade"]

        variacoes = (
            Variacao.objects.select_related("peca")
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

        # Checa disponibilidade (estoque − reservas ativas).
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

        # Cria o pedido + itens com preço travado do banco.
        agora = timezone.now()
        expira_em = agora + timezone.timedelta(minutes=PEDIDO_VALIDADE_MINUTOS)
        total = Decimal("0.00")
        itens_mp = []

        with transaction.atomic():
            pedido = Pedido.objects.create(
                nome=dados["nome"],
                contato=dados["contato"],
                status=Pedido.Status.AGUARDANDO_PAGAMENTO,
                total=Decimal("0.00"),
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
                total += preco_unit * qtd
                itens_mp.append(
                    {
                        "title": variacao.peca.nome,
                        "quantity": qtd,
                        "unit_price": float(preco_unit),
                        "currency_id": "BRL",
                    }
                )
            pedido.total = total
            pedido.save(update_fields=["total"])

        # Cria a preferência no Mercado Pago (fora da transação de banco).
        base_url = settings.MP_PUBLIC_URL.rstrip("/")
        notification_url = f"{base_url}/api/webhooks/mercadopago/"
        try:
            resposta = pagamentos.criar_preferencia(
                pedido,
                itens_mp,
                base_url=base_url,
                frontend_url=settings.FRONTEND_URL,
                notification_url=notification_url,
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

        self._confirmar_pedido(external_reference, str(data_id))
        return Response(status=status.HTTP_200_OK)

    def _confirmar_pedido(self, pedido_id, evento_id):
        """Decrementa estoque e marca o pedido como pago, com lock + idempotência."""
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

            if pedido.status == Pedido.Status.PAGO:
                return

            itens = list(pedido.itens.select_related("variacao").all())
            variacao_ids = [i.variacao_id for i in itens]
            # Lock nas variações para evitar venda concorrente do último item.
            travadas = {
                v.id: v
                for v in Variacao.objects.select_for_update().filter(id__in=variacao_ids)
            }

            # Revalida estoque bruto (o decremento nunca pode ser negativo).
            suficiente = all(
                travadas[i.variacao_id].estoque >= i.quantidade for i in itens
            )
            if not suficiente:
                # Caso raro: estoque acabou. Cancela o pedido e registra mp_payment_id.
                pedido.status = Pedido.Status.CANCELADO
                pedido.mp_payment_id = evento_id
                pedido.save(update_fields=["status", "mp_payment_id"])
                return

            for item in itens:
                variacao = travadas[item.variacao_id]
                variacao.estoque -= item.quantidade
                variacao.save(update_fields=["estoque"])

            pedido.status = Pedido.Status.PAGO
            pedido.mp_payment_id = evento_id
            pedido.save(update_fields=["status", "mp_payment_id"])

        # Sinal disparado fora da transação (consumidores externos: bot WhatsApp).
        compra_paga.send(sender=Pedido, pedido=pedido)


def _so_digitos(valor) -> str:
    """Devolve apenas os dígitos de ``valor`` (str)."""
    return "".join(c for c in str(valor or "") if c.isdigit())


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
        autorizados = {_so_digitos(n) for n in getattr(settings, "WHATSAPP_DONO", [])}
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
    permission_classes = [IsAuthenticated]
    filterset_fields = ["status"]


# --------------------------------------------------------------------------
# Conexão do WhatsApp (bot do dono) — proxy admin para a Evolution API
# --------------------------------------------------------------------------
# O backend é o PROXY: guarda a EVOLUTION_API_KEY e fala com a Evolution; o
# navegador (admin) nunca vê o segredo. Todas as ações exigem JWT de admin.


class WhatsappConexaoStatusView(APIView):
    """Estado da conexão do WhatsApp do dono (admin)."""

    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        return Response(evolution.estado_conexao())


class WhatsappConectarView(APIView):
    """Garante a instância e devolve o QR Code para parear o número (admin)."""

    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        return Response(evolution.conectar())


class WhatsappDesconectarView(APIView):
    """Desconecta (logout) o número da instância (admin)."""

    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        return Response(evolution.desconectar())
