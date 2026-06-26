"""Serializers da API do catálogo."""

from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers
from rest_framework.validators import UniqueTogetherValidator, UniqueValidator
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import (
    HEX_COR_VALIDATOR,
    Categoria,
    Cliente,
    Cor,
    Encomenda,
    EncomendaImagem,
    Imagem,
    ItemPedido,
    Peca,
    Pedido,
    Perfil,
    Promocao,
    Variacao,
)
from .permissions import perfil_efetivo
from .validators import cpf_valido, so_digitos

User = get_user_model()


def _cpf_formatado(cpf: str) -> str:
    """Formata 11 dígitos como 000.000.000-00 (para exibição)."""
    d = so_digitos(cpf)
    if len(d) != 11:
        return cpf or ""
    return f"{d[:3]}.{d[3:6]}.{d[6:9]}-{d[9:]}"


def _validar_nome_pessoa(value):
    """Nome de pessoa: obrigatório e SEM números (espelha o filtro da UI)."""
    value = (value or "").strip()
    if not value:
        raise serializers.ValidationError("Informe o seu nome.")
    if any(c.isdigit() for c in value):
        raise serializers.ValidationError("O nome não pode conter números.")
    return value

# Teto de preço aceito (em reais). Acima disso, provavelmente é erro de digitação.
PRECO_MAXIMO = 1000000


class CategoriaSerializer(serializers.ModelSerializer):
    nome = serializers.CharField(
        max_length=100,
        validators=[
            UniqueValidator(
                queryset=Categoria.objects.all(),
                message="Já existe uma categoria com esse nome.",
            )
        ],
    )

    class Meta:
        model = Categoria
        fields = ["id", "nome", "slug"]
        read_only_fields = ["slug"]  # gerado automaticamente a partir do nome


class CorSerializer(serializers.ModelSerializer):
    """Cor da paleta reutilizável do ateliê."""

    nome = serializers.CharField(
        max_length=30,
        validators=[
            UniqueValidator(
                queryset=Cor.objects.all(),
                message="Já existe uma cor com esse nome.",
            )
        ],
    )
    hex = serializers.CharField(
        max_length=7,
        validators=[HEX_COR_VALIDATOR],
    )

    class Meta:
        model = Cor
        fields = ["id", "nome", "hex"]


class ImagemSerializer(serializers.ModelSerializer):
    class Meta:
        model = Imagem
        fields = ["id", "peca", "arquivo", "principal"]


class VariacaoSerializer(serializers.ModelSerializer):
    esgotado = serializers.BooleanField(read_only=True)
    # Disponível público = estoque − reservas (pedidos aguardando_pagamento e não
    # expirados). Nunca negativo. É este campo que o cliente deve usar para
    # decidir o que pode comprar/quanto; `esgotado` segue refletindo estoque==0.
    disponivel = serializers.SerializerMethodField()
    # `tamanho` é texto livre: os choices do modelo são só sugestão (ex.: P/M/G),
    # mas a API aceita qualquer valor (ex.: "12", "38", "Único"). Sem essa
    # declaração o DRF geraria um ChoiceField e recusaria tamanhos numéricos.
    tamanho = serializers.CharField(
        max_length=20,
        required=False,
        allow_blank=True,
    )
    estoque = serializers.IntegerField(
        min_value=0,
        error_messages={"min_value": "O estoque não pode ser negativo."},
    )
    # hex opcional da cor (quando escolhida na paleta salva), para o swatch.
    cor_hex = serializers.CharField(
        max_length=7,
        required=False,
        allow_blank=True,
    )

    class Meta:
        model = Variacao
        fields = [
            "id",
            "peca",
            "tamanho",
            "cor",
            "cor_hex",
            "estoque",
            "esgotado",
            "disponivel",
        ]
        # Mensagem PT-BR amigável para a duplicata (peça, tamanho, cor) — no lugar
        # do texto técnico padrão do DRF ("...devem criar um set único").
        validators = [
            UniqueTogetherValidator(
                queryset=Variacao.objects.all(),
                fields=["peca", "tamanho", "cor"],
                message="Já existe uma variação com esse tamanho e cor para esta peça.",
            )
        ]

    def get_disponivel(self, obj):
        from .estoque import disponivel_de

        return disponivel_de(obj)


class PecaSerializer(serializers.ModelSerializer):
    """Serializer da peça com variações e imagens aninhadas (leitura)."""

    variacoes = VariacaoSerializer(many=True, read_only=True)
    imagens = ImagemSerializer(many=True, read_only=True)
    categoria_nome = serializers.CharField(source="categoria.nome", read_only=True)
    # Preço com promoção AUTOMÁTICA ativa (calculado no servidor). `em_promocao`
    # indica se há desconto; `preco_promocional` é o preço novo (ou o preço cheio).
    preco_promocional = serializers.SerializerMethodField()
    em_promocao = serializers.SerializerMethodField()
    # Nome único, com mensagem PT-BR. O UniqueValidator ignora a própria peça
    # automaticamente em PATCH/PUT (usa a instância do serializer).
    nome = serializers.CharField(
        max_length=80,
        validators=[
            UniqueValidator(
                queryset=Peca.objects.all(),
                message="Já existe uma peça com esse nome.",
            )
        ],
    )
    descricao = serializers.CharField(
        max_length=600,
        required=False,
        allow_blank=True,
    )
    preco = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        min_value=0,
        max_value=PRECO_MAXIMO,
        error_messages={
            "min_value": "O preço não pode ser negativo.",
            "max_value": "Preço acima do permitido.",
        },
    )

    class Meta:
        model = Peca
        fields = [
            "id",
            "nome",
            "descricao",
            "preco",
            "categoria",
            "categoria_nome",
            "tipo",
            "ativo",
            "destaque",
            "criado_em",
            "preco_promocional",
            "em_promocao",
            "variacoes",
            "imagens",
        ]
        read_only_fields = ["criado_em"]

    # Promoções automáticas ativas — buscadas UMA vez por serializer (evita N+1).
    def _promos_auto(self):
        if not hasattr(self, "_cache_promos_auto"):
            from .promocoes import promocoes_automaticas_ativas

            self._cache_promos_auto = promocoes_automaticas_ativas()
        return self._cache_promos_auto

    def get_preco_promocional(self, obj):
        from .promocoes import preco_com_promocao

        preco, _ = preco_com_promocao(obj, self._promos_auto())
        return f"{preco:.2f}"

    def get_em_promocao(self, obj):
        from .promocoes import preco_com_promocao

        _, em = preco_com_promocao(obj, self._promos_auto())
        return em


# --------------------------------------------------------------------------
# Encomendas (pedidos sob medida com imagens de referência)
# --------------------------------------------------------------------------

# Limites do upload público (anti-abuso). Tipos por extensão e content-type.
MAX_IMAGENS_ENCOMENDA = 5
MAX_TAMANHO_IMAGEM = 5 * 1024 * 1024  # 5 MB
EXTENSOES_PERMITIDAS = ("jpg", "jpeg", "png", "webp")
CONTENT_TYPES_PERMITIDOS = ("image/jpeg", "image/png", "image/webp")


class EncomendaImagemSerializer(serializers.ModelSerializer):
    class Meta:
        model = EncomendaImagem
        fields = ["id", "arquivo"]


# Máquina de estados do status da encomenda: transições válidas (admin).
# `concluida` e `cancelada` são terminais (não saem desses estados).
TRANSICOES_ENCOMENDA = {
    Encomenda.Status.RECEBIDO: {Encomenda.Status.EM_ANDAMENTO, Encomenda.Status.CANCELADA},
    Encomenda.Status.EM_ANDAMENTO: {Encomenda.Status.CONCLUIDA, Encomenda.Status.CANCELADA},
    Encomenda.Status.CONCLUIDA: set(),
    Encomenda.Status.CANCELADA: set(),
}


class EncomendaSerializer(serializers.ModelSerializer):
    """Leitura de encomendas (admin): inclui imagens aninhadas."""

    imagens = EncomendaImagemSerializer(many=True, read_only=True)

    class Meta:
        model = Encomenda
        fields = [
            "id",
            "nome",
            "contato",
            "descricao",
            "tamanho_medidas",
            "prazo_desejado",
            "status",
            "criado_em",
            "imagens",
        ]
        # status é editável pelo admin (PATCH); criado_em nunca muda.
        read_only_fields = ["criado_em"]

    def validate_status(self, novo):
        """Recusa transições inválidas (mensagem PT-BR amigável)."""
        if self.instance is None or novo == self.instance.status:
            return novo  # criação ou status inalterado
        atual = self.instance.status
        permitidos = TRANSICOES_ENCOMENDA.get(atual, set())
        if novo not in permitidos:
            rotulos = dict(Encomenda.Status.choices)
            if not permitidos:
                raise serializers.ValidationError(
                    f"Esta encomenda está {rotulos[atual].lower()} e não pode mudar de status."
                )
            raise serializers.ValidationError(
                f"Não dá para mudar de “{rotulos[atual]}” para “{rotulos[novo]}”."
            )
        return novo


class EncomendaCreateSerializer(serializers.ModelSerializer):
    """Criação pública de encomenda via multipart/form-data.

    Os arquivos chegam por ``request.FILES.getlist("imagens")`` e são
    validados/persistidos pela view; aqui validamos os campos de texto.
    O ``status`` é sempre forçado para ``recebido`` na criação.
    """

    class Meta:
        model = Encomenda
        fields = [
            "nome",
            "contato",
            "descricao",
            "tamanho_medidas",
            "prazo_desejado",
        ]
        extra_kwargs = {
            "nome": {
                "max_length": 80,
                "error_messages": {
                    "blank": "Informe o seu nome.",
                    "required": "Informe o seu nome.",
                },
            },
            "contato": {
                "max_length": 100,
                "error_messages": {
                    "blank": "Informe um contato (telefone/WhatsApp).",
                    "required": "Informe um contato (telefone/WhatsApp).",
                },
            },
            "descricao": {
                "max_length": 600,
                "error_messages": {
                    "blank": "Descreva a peça que deseja encomendar.",
                    "required": "Descreva a peça que deseja encomendar.",
                },
            },
        }

    def validate_imagens(self, arquivos):
        """Valida a lista de arquivos enviada (quantidade, tamanho, tipo)."""
        if len(arquivos) > MAX_IMAGENS_ENCOMENDA:
            raise serializers.ValidationError(
                f"Envie no máximo {MAX_IMAGENS_ENCOMENDA} imagens."
            )
        for arquivo in arquivos:
            if arquivo.size > MAX_TAMANHO_IMAGEM:
                raise serializers.ValidationError(
                    "Cada imagem deve ter no máximo 5 MB."
                )
            extensao = arquivo.name.rsplit(".", 1)[-1].lower() if "." in arquivo.name else ""
            content_type = getattr(arquivo, "content_type", "") or ""
            if (
                extensao not in EXTENSOES_PERMITIDAS
                or content_type not in CONTENT_TYPES_PERMITIDOS
            ):
                raise serializers.ValidationError(
                    "Formato de imagem inválido. Use JPG, PNG ou WEBP."
                )
        return arquivos


# --------------------------------------------------------------------------
# Pagamento online (pedidos de peças prontas via Mercado Pago)
# --------------------------------------------------------------------------

# Quantidade máxima por item, para evitar valores absurdos no checkout.
MAX_QTD_ITEM = 1000


class ItemCheckoutSerializer(serializers.Serializer):
    """Item enviado pelo cliente no checkout (apenas referência + quantidade).

    O preço NUNCA vem do cliente: é recalculado no servidor a partir do banco.
    """

    variacao_id = serializers.IntegerField(min_value=1)
    quantidade = serializers.IntegerField(
        min_value=1,
        max_value=MAX_QTD_ITEM,
        error_messages={"min_value": "A quantidade deve ser pelo menos 1."},
    )


class CheckoutSerializer(serializers.Serializer):
    """Entrada do checkout. Exige conta de cliente: nome/contato/CPF vêm da conta
    autenticada (não do corpo). ``cupom`` é opcional (validado no servidor)."""

    itens = ItemCheckoutSerializer(many=True)
    cupom = serializers.CharField(required=False, allow_blank=True)

    def validate_itens(self, itens):
        if not itens:
            raise serializers.ValidationError("Adicione pelo menos um item ao pedido.")
        return itens


class CupomValidarSerializer(serializers.Serializer):
    """Entrada de ``POST /api/cupom/validar/`` (pré-validação no carrinho)."""

    codigo = serializers.CharField()
    itens = ItemCheckoutSerializer(many=True)


class ItemPedidoSerializer(serializers.ModelSerializer):
    """Leitura de item de pedido (admin)."""

    variacao_descricao = serializers.CharField(source="variacao.__str__", read_only=True)
    peca_nome = serializers.CharField(source="variacao.peca.nome", read_only=True)

    class Meta:
        model = ItemPedido
        fields = [
            "id",
            "variacao",
            "variacao_descricao",
            "peca_nome",
            "quantidade",
            "preco_unit",
        ]


class PedidoSerializer(serializers.ModelSerializer):
    """Leitura de pedidos (admin): inclui os itens aninhados."""

    itens = ItemPedidoSerializer(many=True, read_only=True)
    # Código legível e estável (ex.: PED-000042) para suporte/cliente.
    codigo = serializers.ReadOnlyField()

    class Meta:
        model = Pedido
        fields = [
            "id",
            "codigo",
            "nome",
            "contato",
            "status",
            "motivo_revisao",
            "total",
            "mp_preference_id",
            "mp_payment_id",
            "codigo_rastreio",
            "criado_em",
            "expira_em",
            "itens",
        ]
        read_only_fields = fields


# --------------------------------------------------------------------------
# Contas do painel — papéis (Dono/Funcionário), login com claims e senha
# --------------------------------------------------------------------------


def _claims_de(user):
    """Claims de papel para o JWT (o front decide o que mostrar; o backend manda)."""
    perfil = perfil_efetivo(user)
    if perfil is None:
        return {"papel": None, "acesso_financeiro": False}
    # acesso_financeiro = o interruptor por conta (cru). O front deriva o acesso
    # efetivo a Vendas como: papel == "dono" OU acesso_financeiro.
    return {"papel": perfil.papel, "acesso_financeiro": perfil.acesso_financeiro}


class TokenComPapelSerializer(TokenObtainPairSerializer):
    """Login JWT que injeta ``papel``/``acesso_financeiro`` nas claims e bloqueia
    contas inativas (perfil ``ativo=False``)."""

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        for chave, valor in _claims_de(user).items():
            token[chave] = valor
        return token

    def validate(self, attrs):
        # super() autentica e já barra usuários com User.is_active=False.
        data = super().validate(attrs)
        if perfil_efetivo(self.user) is None:
            raise serializers.ValidationError(
                "Sua conta está inativa. Fale com o responsável pelo ateliê."
            )
        return data


class UsuarioSerializer(serializers.ModelSerializer):
    """Leitura de um funcionário (lista/detalhe para o Dono)."""

    nome = serializers.CharField(source="first_name", read_only=True)
    usuario = serializers.CharField(source="username", read_only=True)
    papel = serializers.CharField(source="perfil.papel", read_only=True)
    ativo = serializers.BooleanField(source="perfil.ativo", read_only=True)
    acesso_financeiro = serializers.BooleanField(
        source="perfil.acesso_financeiro", read_only=True
    )
    senha_provisoria = serializers.BooleanField(
        source="perfil.senha_provisoria", read_only=True
    )
    criado_em = serializers.DateTimeField(source="perfil.criado_em", read_only=True)

    class Meta:
        model = User
        fields = [
            "id",
            "nome",
            "usuario",
            "email",
            "papel",
            "ativo",
            "acesso_financeiro",
            "senha_provisoria",
            "criado_em",
        ]
        read_only_fields = fields


class UsuarioCreateSerializer(serializers.Serializer):
    """Criação de um funcionário com senha provisória definida pelo Dono."""

    nome = serializers.CharField(max_length=150, required=False, allow_blank=True)
    usuario = serializers.CharField(max_length=150)
    email = serializers.EmailField(required=False, allow_blank=True)
    senha = serializers.CharField(write_only=True)
    acesso_financeiro = serializers.BooleanField(required=False, default=False)

    def validate_usuario(self, value):
        value = (value or "").strip()
        if not value:
            raise serializers.ValidationError("Informe um nome de usuário.")
        if User.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError("Já existe um usuário com esse nome.")
        return value

    def validate_email(self, value):
        value = (value or "").strip()
        if value and User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("Já existe um usuário com esse e-mail.")
        return value

    def validate_senha(self, value):
        try:
            validate_password(value)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(list(exc.messages))
        return value


class MudarSenhaSerializer(serializers.Serializer):
    """Troca da própria senha (qualquer usuário logado)."""

    senha_atual = serializers.CharField(write_only=True)
    nova_senha = serializers.CharField(write_only=True)

    def validate_nova_senha(self, value):
        user = self.context["request"].user
        try:
            validate_password(value, user)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(list(exc.messages))
        return value


# --------------------------------------------------------------------------
# Promoções / cupons (gestão no financeiro do admin)
# --------------------------------------------------------------------------


class PromocaoSerializer(serializers.ModelSerializer):
    """CRUD de promoções/cupons (admin financeiro). ``usos`` é só leitura.

    Escopo por PEÇA(s)/CATEGORIA(s) aceita várias (M2M). Para exibição, expõe
    listas de nomes (`pecas_nomes`/`categorias_nomes`)."""

    pecas_nomes = serializers.SerializerMethodField()
    categorias_nomes = serializers.SerializerMethodField()

    class Meta:
        model = Promocao
        fields = [
            "id",
            "nome",
            "tipo_aplicacao",
            "codigo",
            "tipo_desconto",
            "valor",
            "escopo",
            "pecas",
            "pecas_nomes",
            "categorias",
            "categorias_nomes",
            "inicio",
            "fim",
            "limite_uso",
            "usos",
            "acumulavel",
            "ativo",
            "criado_em",
        ]
        read_only_fields = ["usos", "criado_em"]

    def get_pecas_nomes(self, obj):
        return [p.nome for p in obj.pecas.all()]

    def get_categorias_nomes(self, obj):
        return [c.nome for c in obj.categorias.all()]

    def validate(self, attrs):
        def atual(campo, padrao=None):
            if campo in attrs:
                return attrs[campo]
            return getattr(self.instance, campo, padrao)

        tipo_aplicacao = atual("tipo_aplicacao")
        tipo_desconto = atual("tipo_desconto")
        escopo = atual("escopo")
        codigo = atual("codigo", "")
        valor = atual("valor")
        inicio = atual("inicio")
        fim = atual("fim")
        # M2M: nos attrs vêm como lista de instâncias; na instância, queryset.
        pecas = attrs.get("pecas")
        if pecas is None and self.instance:
            pecas = list(self.instance.pecas.all())
        pecas = pecas or []
        categorias = attrs.get("categorias")
        if categorias is None and self.instance:
            categorias = list(self.instance.categorias.all())
        categorias = categorias or []

        erros = {}

        if tipo_aplicacao == Promocao.TipoAplicacao.CUPOM:
            cod = (codigo or "").strip().upper()
            if not cod:
                erros["codigo"] = "Informe um código para o cupom."
            else:
                qs = Promocao.objects.filter(
                    tipo_aplicacao=Promocao.TipoAplicacao.CUPOM, codigo__iexact=cod
                )
                if self.instance:
                    qs = qs.exclude(pk=self.instance.pk)
                if qs.exists():
                    erros["codigo"] = "Já existe um cupom com esse código."
                attrs["codigo"] = cod
        else:
            attrs["codigo"] = ""  # automática não tem código

        if tipo_desconto == Promocao.TipoDesconto.PERCENTUAL and valor is not None and valor > 100:
            erros["valor"] = "O percentual não pode passar de 100%."

        if escopo == Promocao.Escopo.PECA and not pecas:
            erros["pecas"] = "Escolha ao menos uma peça."
        if escopo == Promocao.Escopo.CATEGORIA and not categorias:
            erros["categorias"] = "Escolha ao menos uma categoria."

        if inicio and fim and fim <= inicio:
            erros["fim"] = "O fim deve ser depois do início (data e hora)."

        if erros:
            raise serializers.ValidationError(erros)
        # Zera as M2M fora do escopo (mantém o dado coerente).
        if escopo != Promocao.Escopo.PECA:
            attrs["pecas"] = []
        if escopo != Promocao.Escopo.CATEGORIA:
            attrs["categorias"] = []
        return attrs


# --------------------------------------------------------------------------
# Conta do CLIENTE da loja (cadastro/login/perfil) — separada do staff
# --------------------------------------------------------------------------


class ContaCadastroSerializer(serializers.Serializer):
    """Cadastro público de cliente: cria User (e-mail = login) + Cliente."""

    nome = serializers.CharField(max_length=120)
    email = serializers.EmailField()
    cpf = serializers.CharField()
    telefone = serializers.CharField(max_length=20, required=False, allow_blank=True)
    senha = serializers.CharField(write_only=True)

    def validate_nome(self, value):
        return _validar_nome_pessoa(value)

    def validate_email(self, value):
        value = (value or "").strip().lower()
        if User.objects.filter(username__iexact=value).exists() or User.objects.filter(
            email__iexact=value
        ).exists():
            raise serializers.ValidationError("Já existe uma conta com esse e-mail.")
        return value

    def validate_cpf(self, value):
        digitos = so_digitos(value)
        if not cpf_valido(digitos):
            raise serializers.ValidationError("CPF inválido.")
        if Cliente.objects.filter(cpf=digitos).exists():
            raise serializers.ValidationError("Já existe uma conta com esse CPF.")
        return digitos

    def validate_senha(self, value):
        try:
            validate_password(value)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(list(exc.messages))
        return value


class ContaTokenSerializer(TokenObtainPairSerializer):
    """Login do cliente por e-mail+senha. Recusa contas de staff.

    O cliente envia ``email``+``password``. Como o ``User.username`` é o próprio
    e-mail, mapeamos ``email`` → ``username`` para o ``authenticate`` padrão.
    """

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Troca o campo de login "username" por "email".
        self.fields.pop(self.username_field, None)
        self.fields["email"] = serializers.EmailField(write_only=True)

    def validate(self, attrs):
        attrs[self.username_field] = (attrs.get("email") or "").strip().lower()
        data = super().validate(attrs)  # autentica; barra User.is_active=False
        user = self.user
        if user.is_staff or getattr(user, "perfil", None) is not None or not hasattr(
            user, "cliente"
        ):
            raise serializers.ValidationError(
                "Esta conta não é de cliente. Use o painel para entrar."
            )
        return data

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["audiencia"] = "cliente"
        return token


class ClienteSerializer(serializers.ModelSerializer):
    """Leitura dos dados da conta do cliente (/api/conta/me/)."""

    email = serializers.EmailField(source="usuario.email", read_only=True)
    cpf = serializers.SerializerMethodField()

    class Meta:
        model = Cliente
        fields = ["nome", "email", "cpf", "telefone", "criado_em"]
        read_only_fields = fields

    def get_cpf(self, obj):
        return _cpf_formatado(obj.cpf)


class ClienteUpdateSerializer(serializers.ModelSerializer):
    """Edição do perfil do cliente — só nome e telefone (e-mail/CPF travados)."""

    class Meta:
        model = Cliente
        fields = ["nome", "telefone"]

    def validate_nome(self, value):
        return _validar_nome_pessoa(value)
