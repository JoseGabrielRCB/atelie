"""ViewSets da API do catálogo.

Leitura é pública; escrita exige JWT de admin (IsAuthenticatedOrReadOnly,
definido como permissão padrão no settings).
"""

from rest_framework import serializers, status, viewsets
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle

from .models import Categoria, Cor, Encomenda, EncomendaImagem, Imagem, Peca, Variacao
from .serializers import (
    CategoriaSerializer,
    CorSerializer,
    EncomendaCreateSerializer,
    EncomendaSerializer,
    ImagemSerializer,
    PecaSerializer,
    VariacaoSerializer,
)


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
