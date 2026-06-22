"""Modelos do catálogo do ateliê: Categoria, Cor, Peca, Variacao, Imagem, Encomenda."""

from django.core.validators import MinValueValidator, RegexValidator
from django.db import models
from django.utils.text import slugify

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

    nome = models.CharField("nome", max_length=80)
    contato = models.CharField("contato", max_length=100)
    status = models.CharField(
        "status",
        max_length=30,
        choices=Status.choices,
        default=Status.AGUARDANDO_PAGAMENTO,
    )
    total = models.DecimalField("total", max_digits=10, decimal_places=2)
    mp_preference_id = models.CharField("ID da preferência (MP)", max_length=100, blank=True)
    mp_payment_id = models.CharField("ID do pagamento (MP)", max_length=100, blank=True)
    criado_em = models.DateTimeField("criado em", auto_now_add=True)
    expira_em = models.DateTimeField("expira em")

    class Meta:
        verbose_name = "pedido"
        verbose_name_plural = "pedidos"
        ordering = ["-criado_em"]

    def __str__(self):
        return f"Pedido #{self.pk} - {self.get_status_display()}"


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
