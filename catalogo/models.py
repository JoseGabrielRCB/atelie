"""Modelos do catálogo do ateliê: Categoria, Peca, Variacao, Imagem, Encomenda."""

from django.core.validators import MinValueValidator
from django.db import models
from django.utils.text import slugify


class Categoria(models.Model):
    """Categoria de peças (ex.: Vestidos, Blusas)."""

    nome = models.CharField("nome", max_length=100)
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


class Peca(models.Model):
    """Peça de roupa exibida na vitrine."""

    class Tipo(models.TextChoices):
        PRONTA = "pronta", "Pronta"
        SOB_MEDIDA = "sob_medida", "Sob medida"

    nome = models.CharField(
        "nome",
        max_length=150,
        unique=True,
        error_messages={"unique": "Já existe uma peça com esse nome."},
    )
    descricao = models.TextField("descrição", blank=True)
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

    nome = models.CharField("nome", max_length=150)
    contato = models.CharField("contato", max_length=100)
    descricao = models.TextField("descrição")
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
