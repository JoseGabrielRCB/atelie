"""Serializers da API do catálogo."""

from rest_framework import serializers
from rest_framework.validators import UniqueValidator

from .models import (
    HEX_COR_VALIDATOR,
    Categoria,
    Cor,
    Encomenda,
    EncomendaImagem,
    Imagem,
    Peca,
    Variacao,
)

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
        fields = ["id", "peca", "tamanho", "cor", "cor_hex", "estoque", "esgotado"]


class PecaSerializer(serializers.ModelSerializer):
    """Serializer da peça com variações e imagens aninhadas (leitura)."""

    variacoes = VariacaoSerializer(many=True, read_only=True)
    imagens = ImagemSerializer(many=True, read_only=True)
    categoria_nome = serializers.CharField(source="categoria.nome", read_only=True)
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
            "variacoes",
            "imagens",
        ]
        read_only_fields = ["criado_em"]


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
