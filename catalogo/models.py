"""Modelos do catálogo do ateliê: Categoria, Cor, Peca, Variacao, Imagem, Encomenda."""

from decimal import Decimal

from django.conf import settings
from django.core.validators import MinValueValidator, RegexValidator
from django.db import models
from django.utils import timezone
from django.utils.text import slugify

from .validators import validar_cpf


class Cliente(models.Model):
    """Conta de CLIENTE da loja (1-para-1 com o ``User`` do Django).

    Distinta do staff: cliente tem ``Cliente`` e ``User.is_staff=False`` e NÃO
    tem ``Perfil`` (que é do dono/funcionário). Usada para compras com login e
    para preencher o ``payer`` do Mercado Pago (CPF). O e-mail é o login
    (``User.username == User.email``). Sem endereço/entrega neste MVP.
    """

    usuario = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="cliente",
        verbose_name="usuário",
    )
    nome = models.CharField("nome", max_length=120)
    # Guardado SÓ com dígitos (11). Validado pelos dígitos verificadores.
    cpf = models.CharField(
        "CPF",
        max_length=11,
        unique=True,
        validators=[validar_cpf],
        error_messages={"unique": "Já existe uma conta com esse CPF."},
    )
    telefone = models.CharField("telefone", max_length=20, blank=True)
    criado_em = models.DateTimeField("criado em", auto_now_add=True)

    class Meta:
        verbose_name = "cliente"
        verbose_name_plural = "clientes"
        ordering = ["nome"]

    def __str__(self):
        return f"{self.nome} ({self.usuario.email})"


class Perfil(models.Model):
    """Perfil de acesso ao painel (1-para-1 com o ``User`` do Django).

    Define o papel fixo do usuário (Dono ou Funcionário) dentro do MESMO ateliê
    (não é multi-loja). O **Dono** tem acesso total (inclui Funcionários, Vendas/
    financeiro e Configurações). O **Funcionário** gerencia catálogo/estoque/
    encomendas/categorias/cores/destaques, mas NÃO acessa Funcionários nem
    Configurações; o acesso ao financeiro (Vendas) é liberado caso a caso pelo
    Dono via ``acesso_financeiro``.

    A fonte da verdade das permissões é o backend (ver ``catalogo.permissions``).
    """

    class Papel(models.TextChoices):
        DONO = "dono", "Dono"
        FUNCIONARIO = "funcionario", "Funcionário"

    usuario = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="perfil",
        verbose_name="usuário",
    )
    papel = models.CharField(
        "papel",
        max_length=20,
        choices=Papel.choices,
        default=Papel.FUNCIONARIO,
    )
    ativo = models.BooleanField("ativo", default=True)
    acesso_financeiro = models.BooleanField(
        "acesso ao financeiro",
        default=False,
        help_text="Libera a seção Vendas/financeiro para um funcionário.",
    )
    senha_provisoria = models.BooleanField(
        "senha provisória",
        default=False,
        help_text="Quando verdadeiro, força a troca de senha no próximo acesso.",
    )
    criado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="perfis_criados",
        verbose_name="criado por",
    )
    criado_em = models.DateTimeField("criado em", auto_now_add=True)

    class Meta:
        verbose_name = "perfil"
        verbose_name_plural = "perfis"
        ordering = ["usuario__username"]

    def __str__(self):
        return f"{self.usuario} ({self.get_papel_display()})"

    @property
    def eh_dono(self) -> bool:
        return self.papel == self.Papel.DONO

    @property
    def pode_financeiro(self) -> bool:
        """Dono sempre; funcionário só com acesso liberado."""
        return self.eh_dono or self.acesso_financeiro

# Valida cores no formato hexadecimal #RRGGBB (ex.: #B07A56).
HEX_COR_VALIDATOR = RegexValidator(
    regex=r"^#[0-9A-Fa-f]{6}$",
    message="Use uma cor no formato #RRGGBB.",
)


class Categoria(models.Model):
    """Categoria de peças (ex.: Vestidos, Blusas)."""

    nome = models.CharField(
        "nome",
        max_length=100,
        unique=True,
        error_messages={"unique": "Já existe uma categoria com esse nome."},
    )
    slug = models.SlugField("slug", max_length=120, unique=True, blank=True)

    class Meta:
        verbose_name = "categoria"
        verbose_name_plural = "categorias"
        ordering = ["nome"]

    def __str__(self):
        return self.nome

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.nome)
        super().save(*args, **kwargs)


class Cor(models.Model):
    """Cor reutilizável da paleta do ateliê (biblioteca de cores).

    Ao criar uma variação, o admin pode escolher uma cor salva para que o site
    público renderize a amostra (swatch) com o ``hex`` correspondente.
    """

    nome = models.CharField("nome", max_length=30, unique=True)
    hex = models.CharField(
        "hex",
        max_length=7,
        validators=[HEX_COR_VALIDATOR],
        help_text="Cor no formato #RRGGBB (ex.: #B07A56).",
    )

    class Meta:
        verbose_name = "cor"
        verbose_name_plural = "cores"
        ordering = ["nome"]

    def __str__(self):
        return self.nome


class Peca(models.Model):
    """Peça de roupa exibida na vitrine."""

    class Tipo(models.TextChoices):
        PRONTA = "pronta", "Pronta"
        SOB_MEDIDA = "sob_medida", "Sob medida"

    nome = models.CharField(
        "nome",
        max_length=80,
        unique=True,
        error_messages={"unique": "Já existe uma peça com esse nome."},
    )
    descricao = models.TextField("descrição", max_length=600, blank=True)
    preco = models.DecimalField("preço", max_digits=10, decimal_places=2)
    categoria = models.ForeignKey(
        Categoria,
        on_delete=models.CASCADE,
        related_name="pecas",
        verbose_name="categoria",
    )
    tipo = models.CharField(
        "tipo",
        max_length=20,
        choices=Tipo.choices,
        default=Tipo.PRONTA,
    )
    ativo = models.BooleanField("ativo", default=True)
    destaque = models.BooleanField(
        "destaque",
        default=False,
        help_text="Aparece na seção 'Peças em destaque' da Home.",
    )
    criado_em = models.DateTimeField("criado em", auto_now_add=True)

    class Meta:
        verbose_name = "peça"
        verbose_name_plural = "peças"
        ordering = ["-criado_em"]

    def __str__(self):
        return self.nome


class Variacao(models.Model):
    """Variação (tamanho/cor/estoque) de uma peça pronta."""

    class Tamanho(models.TextChoices):
        P = "P", "P"
        M = "M", "M"
        G = "G", "G"
        GG = "GG", "GG"
        UNICO = "Único", "Único"

    peca = models.ForeignKey(
        Peca,
        on_delete=models.CASCADE,
        related_name="variacoes",
        verbose_name="peça",
    )
    # choices apenas como sugestão; o campo aceita valores livres.
    tamanho = models.CharField(
        "tamanho",
        max_length=20,
        choices=Tamanho.choices,
        blank=True,
    )
    cor = models.CharField("cor", max_length=50, blank=True)
    # hex opcional da cor escolhida (quando vem da paleta salva), para o swatch
    # no site público. Mantemos `cor` como texto livre (unique_together intacto).
    cor_hex = models.CharField("cor (hex)", max_length=7, blank=True)
    estoque = models.PositiveIntegerField(
        "estoque",
        default=0,
        validators=[MinValueValidator(0, "O estoque não pode ser negativo.")],
    )

    class Meta:
        verbose_name = "variação"
        verbose_name_plural = "variações"
        unique_together = ("peca", "tamanho", "cor")
        ordering = ["tamanho", "cor"]

    def __str__(self):
        return f"{self.peca.nome} - {self.tamanho} {self.cor}".strip()

    @property
    def esgotado(self) -> bool:
        """Indica se a variação está sem estoque."""
        return self.estoque == 0


class Imagem(models.Model):
    """Imagem associada a uma peça."""

    peca = models.ForeignKey(
        Peca,
        on_delete=models.CASCADE,
        related_name="imagens",
        verbose_name="peça",
    )
    arquivo = models.ImageField("arquivo", upload_to="pecas/")
    principal = models.BooleanField("principal", default=False)

    class Meta:
        verbose_name = "imagem"
        verbose_name_plural = "imagens"
        ordering = ["-principal", "id"]

    def __str__(self):
        return f"Imagem de {self.peca.nome}"


class Encomenda(models.Model):
    """Pedido de peça sob encomenda enviado pelo cliente (público).

    Diferente do fluxo de catálogo (que finaliza no WhatsApp), a encomenda é
    salva no sistema porque o cliente precisa anexar imagens de referência —
    algo que o WhatsApp do site não comporta no fluxo de seleção.
    """

    class Status(models.TextChoices):
        RECEBIDO = "recebido", "Recebido"
        EM_ANDAMENTO = "em_andamento", "Em andamento"
        CONCLUIDA = "concluida", "Concluída"
        CANCELADA = "cancelada", "Cancelada"

    nome = models.CharField("nome", max_length=80)
    contato = models.CharField("contato", max_length=100)
    descricao = models.TextField("descrição", max_length=600)
    tamanho_medidas = models.CharField("tamanho/medidas", max_length=255, blank=True)
    prazo_desejado = models.DateField("prazo desejado", null=True, blank=True)
    status = models.CharField(
        "status",
        max_length=20,
        choices=Status.choices,
        default=Status.RECEBIDO,
    )
    criado_em = models.DateTimeField("criado em", auto_now_add=True)

    class Meta:
        verbose_name = "encomenda"
        verbose_name_plural = "encomendas"
        ordering = ["-criado_em"]

    def __str__(self):
        return f"Encomenda #{self.pk} - {self.nome}"


class EncomendaImagem(models.Model):
    """Imagem de referência anexada a uma encomenda."""

    encomenda = models.ForeignKey(
        Encomenda,
        on_delete=models.CASCADE,
        related_name="imagens",
        verbose_name="encomenda",
    )
    arquivo = models.ImageField("arquivo", upload_to="encomendas/")

    class Meta:
        verbose_name = "imagem de encomenda"
        verbose_name_plural = "imagens de encomenda"
        ordering = ["id"]

    def __str__(self):
        return f"Imagem da encomenda #{self.encomenda_id}"


# --------------------------------------------------------------------------
# Pagamento online (Checkout Pro do Mercado Pago) — somente PEÇAS PRONTAS
# --------------------------------------------------------------------------


class Pedido(models.Model):
    """Pedido de peças PRONTAS pago online via Mercado Pago (Checkout Pro).

    O cliente paga na página hospedada do Mercado Pago (Pix/cartão). O estoque
    só é decrementado quando o pagamento é aprovado (via webhook), dentro de um
    lock de banco com idempotência. Enquanto ``aguardando_pagamento`` e não
    expirado, o pedido "reserva" o estoque para evitar venda do último item em
    duplicidade (ver ``disponibilidade``).

    NÃO confundir com Encomenda (fluxo sob medida via WhatsApp, intacto).
    """

    class Status(models.TextChoices):
        AGUARDANDO_PAGAMENTO = "aguardando_pagamento", "Aguardando pagamento"
        PAGO = "pago", "Pago"
        EXPIRADO = "expirado", "Expirado"
        CANCELADO = "cancelado", "Cancelado"

    # Conta do cliente que fez a compra (null nos pedidos históricos, anteriores
    # ao login obrigatório). PROTECT preserva o histórico financeiro.
    cliente = models.ForeignKey(
        "Cliente",
        on_delete=models.PROTECT,
        related_name="pedidos",
        null=True,
        blank=True,
        verbose_name="cliente",
    )
    # Snapshot do nome/contato no momento da compra (admin Vendas lê daqui).
    nome = models.CharField("nome", max_length=80)
    contato = models.CharField("contato", max_length=100)
    status = models.CharField(
        "status",
        max_length=30,
        choices=Status.choices,
        default=Status.AGUARDANDO_PAGAMENTO,
    )
    total = models.DecimalField("total", max_digits=10, decimal_places=2)
    # Cupom aplicado (se houve) + desconto total já embutido em `total`.
    cupom = models.ForeignKey(
        "Promocao",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="pedidos",
        verbose_name="cupom",
    )
    desconto = models.DecimalField("desconto", max_digits=10, decimal_places=2, default=Decimal("0.00"))
    mp_preference_id = models.CharField("ID da preferência (MP)", max_length=100, blank=True)
    mp_payment_id = models.CharField("ID do pagamento (MP)", max_length=100, blank=True)
    criado_em = models.DateTimeField("criado em", auto_now_add=True)
    expira_em = models.DateTimeField("expira em")

    class Meta:
        verbose_name = "pedido"
        verbose_name_plural = "pedidos"
        ordering = ["-criado_em"]

    def __str__(self):
        return f"{self.codigo} - {self.get_status_display()}"

    @property
    def codigo(self) -> str:
        """Código de compra legível e estável (ex.: PED-000042), derivado do id.

        Fácil de ditar por telefone/WhatsApp e único (o id é único). Não precisa
        de campo/migration — é sempre o mesmo para o mesmo pedido."""
        return f"PED-{self.pk:06d}" if self.pk else "PED-—"


class ItemPedido(models.Model):
    """Item de um :class:`Pedido` (uma variação + quantidade + preço travado).

    ``variacao`` usa ``on_delete=PROTECT`` para preservar o histórico de
    compras pagas: uma variação só pode ser excluída se não houver itens de
    pedido apontando para ela. IMPLICAÇÃO: como Variacao/Peca/Categoria ainda
    usam CASCADE entre si, excluir uma Peca/Categoria que tenha variações
    referenciadas por um Pedido será BLOQUEADO pelo PROTECT (ProtectedError) —
    e isso é intencional para não perder o histórico financeiro.
    """

    pedido = models.ForeignKey(
        Pedido,
        on_delete=models.CASCADE,
        related_name="itens",
        verbose_name="pedido",
    )
    variacao = models.ForeignKey(
        Variacao,
        on_delete=models.PROTECT,
        related_name="itens_pedido",
        verbose_name="variação",
    )
    quantidade = models.PositiveIntegerField(
        "quantidade",
        validators=[MinValueValidator(1, "A quantidade deve ser pelo menos 1.")],
    )
    preco_unit = models.DecimalField("preço unitário", max_digits=10, decimal_places=2)

    class Meta:
        verbose_name = "item do pedido"
        verbose_name_plural = "itens do pedido"
        ordering = ["id"]

    def __str__(self):
        return f"{self.quantidade}x {self.variacao} (Pedido #{self.pedido_id})"


class EventoPagamento(models.Model):
    """Registro de evento de pagamento já processado (idempotência do webhook).

    Garante que uma mesma notificação do Mercado Pago não decremente o estoque
    mais de uma vez. ``evento_id`` é o identificador do pagamento (data.id).
    """

    evento_id = models.CharField("ID do evento", max_length=100, unique=True)
    criado_em = models.DateTimeField("criado em", auto_now_add=True)

    class Meta:
        verbose_name = "evento de pagamento"
        verbose_name_plural = "eventos de pagamento"
        ordering = ["-criado_em"]

    def __str__(self):
        return f"Evento {self.evento_id}"


class MensagemWhatsApp(models.Model):
    """Registro de mensagem de WhatsApp já processada (idempotência do webhook).

    Garante que um reenvio do mesmo evento ``messages.upsert`` (mesmo
    ``data.key.id``) seja um no-op — não ajusta estoque duas vezes.
    """

    mensagem_id = models.CharField("ID da mensagem", max_length=255, unique=True)
    criado_em = models.DateTimeField("criado em", auto_now_add=True)

    class Meta:
        verbose_name = "mensagem de WhatsApp"
        verbose_name_plural = "mensagens de WhatsApp"
        ordering = ["-criado_em"]

    def __str__(self):
        return f"Mensagem {self.mensagem_id}"


class Promocao(models.Model):
    """Promoção/cupom de desconto (gerida no financeiro do admin).

    Dois tipos de aplicação: **cupom** (o cliente digita um código no checkout) e
    **automática** (aplica sozinha ao preço de exibição das peças no escopo). O
    desconto é SEMPRE calculado no servidor — nunca se confia no cliente.
    """

    class TipoAplicacao(models.TextChoices):
        CUPOM = "cupom", "Cupom"
        AUTOMATICA = "automatica", "Automática"

    class TipoDesconto(models.TextChoices):
        PERCENTUAL = "percentual", "Percentual (%)"
        VALOR = "valor", "Valor (R$)"

    class Escopo(models.TextChoices):
        TUDO = "tudo", "Tudo"
        PECA = "peca", "Peça"
        CATEGORIA = "categoria", "Categoria"

    nome = models.CharField("nome", max_length=80)
    tipo_aplicacao = models.CharField(
        "tipo de aplicação", max_length=20, choices=TipoAplicacao.choices
    )
    # Único entre cupons (constraint condicional abaixo); vazio para automática.
    codigo = models.CharField("código", max_length=40, blank=True)
    tipo_desconto = models.CharField(
        "tipo de desconto", max_length=20, choices=TipoDesconto.choices
    )
    valor = models.DecimalField(
        "valor",
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.01"), "O valor do desconto deve ser maior que zero.")],
    )
    escopo = models.CharField(
        "escopo", max_length=20, choices=Escopo.choices, default=Escopo.TUDO
    )
    # Escopo por PEÇA(s) ou CATEGORIA(s) — pode escolher mais de uma.
    pecas = models.ManyToManyField(
        Peca, blank=True, related_name="promocoes", verbose_name="peças"
    )
    categorias = models.ManyToManyField(
        Categoria, blank=True, related_name="promocoes", verbose_name="categorias"
    )
    inicio = models.DateTimeField("início", null=True, blank=True)
    fim = models.DateTimeField("fim", null=True, blank=True)
    limite_uso = models.PositiveIntegerField("limite de usos", null=True, blank=True)
    usos = models.PositiveIntegerField("usos", default=0)
    acumulavel = models.BooleanField(
        "acumulável",
        default=False,
        help_text="Se o cupom soma com a promoção automática; senão, vale o maior desconto.",
    )
    ativo = models.BooleanField("ativo", default=True)
    criado_em = models.DateTimeField("criado em", auto_now_add=True)

    class Meta:
        verbose_name = "promoção"
        verbose_name_plural = "promoções"
        ordering = ["-criado_em"]
        constraints = [
            # Código único apenas entre cupons (automáticas têm código vazio).
            models.UniqueConstraint(
                fields=["codigo"],
                condition=models.Q(tipo_aplicacao="cupom"),
                name="codigo_unico_por_cupom",
            ),
        ]

    def __str__(self):
        return self.nome

    def vigente(self, agora=None) -> bool:
        """Ativa, dentro do período (se houver) e sem estourar o limite de usos."""
        if not self.ativo:
            return False
        agora = agora or timezone.now()
        if self.inicio and agora < self.inicio:
            return False
        if self.fim and agora > self.fim:
            return False
        if self.limite_uso is not None and self.usos >= self.limite_uso:
            return False
        return True

    def casa_peca(self, peca) -> bool:
        """Se o escopo da promoção abrange a ``peca`` (use prefetch nas M2M)."""
        if self.escopo == self.Escopo.TUDO:
            return True
        if self.escopo == self.Escopo.PECA:
            return any(p.id == peca.id for p in self.pecas.all())
        if self.escopo == self.Escopo.CATEGORIA:
            return any(c.id == peca.categoria_id for c in self.categorias.all())
        return False

    def desconto_unitario(self, preco) -> Decimal:
        """Desconto (R$) sobre um preço unitário — nunca abaixo de 0 nem acima do preço."""
        preco = Decimal(preco)
        if self.tipo_desconto == self.TipoDesconto.PERCENTUAL:
            bruto = preco * self.valor / Decimal(100)
        else:
            bruto = self.valor
        bruto = bruto.quantize(Decimal("0.01"))
        if bruto < 0:
            return Decimal("0.00")
        return min(bruto, preco)
