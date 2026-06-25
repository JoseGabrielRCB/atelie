"""Rotas da API do catálogo."""

from django.urls import include, path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView

from .views import (
    CategoriaViewSet,
    CheckoutView,
    ContaCadastroView,
    ContaLoginView,
    ContaMeView,
    ContaPedidosView,
    ContaSenhaView,
    CorViewSet,
    CupomValidarView,
    EncomendaViewSet,
    ImagemViewSet,
    LoginView,
    MeView,
    MudarSenhaView,
    PecaViewSet,
    PedidoViewSet,
    PromocaoViewSet,
    RelatorioProdutosVendidosView,
    RelatorioResumoMesView,
    RelatorioVendasPeriodoView,
    UsuarioViewSet,
    VariacaoViewSet,
    WebhookMercadoPagoView,
    WhatsappConectarView,
    WhatsappConexaoStatusView,
    WhatsappDesconectarView,
    WhatsappDonoView,
    WhatsappWebhookView,
)

router = DefaultRouter()
router.register("categorias", CategoriaViewSet, basename="categoria")
router.register("cores", CorViewSet, basename="cor")
router.register("pecas", PecaViewSet, basename="peca")
router.register("variacoes", VariacaoViewSet, basename="variacao")
router.register("imagens", ImagemViewSet, basename="imagem")
router.register("encomendas", EncomendaViewSet, basename="encomenda")
router.register("pedidos", PedidoViewSet, basename="pedido")
router.register("promocoes", PromocaoViewSet, basename="promocao")
router.register("usuarios", UsuarioViewSet, basename="usuario")
router.register("conta/pedidos", ContaPedidosView, basename="conta-pedido")

urlpatterns = [
    path("auth/login/", LoginView.as_view(), name="login"),
    path("auth/refresh/", TokenRefreshView.as_view(), name="refresh"),
    # Identidade do usuário logado + troca da própria senha.
    path("me/", MeView.as_view(), name="me"),
    path("me/senha/", MudarSenhaView.as_view(), name="me-senha"),
    # Conta do CLIENTE da loja (separada do staff).
    path("conta/cadastro/", ContaCadastroView.as_view(), name="conta-cadastro"),
    path("conta/login/", ContaLoginView.as_view(), name="conta-login"),
    path("conta/me/", ContaMeView.as_view(), name="conta-me"),
    path("conta/senha/", ContaSenhaView.as_view(), name="conta-senha"),
    path("checkout/", CheckoutView.as_view(), name="checkout"),
    path("cupom/validar/", CupomValidarView.as_view(), name="cupom-validar"),
    # Relatórios financeiros (gate PodeFinanceiro; ?formato=csv|pdf exporta).
    path(
        "relatorios/vendas-por-periodo/",
        RelatorioVendasPeriodoView.as_view(),
        name="relatorio-vendas-periodo",
    ),
    path(
        "relatorios/produtos-mais-vendidos/",
        RelatorioProdutosVendidosView.as_view(),
        name="relatorio-produtos-vendidos",
    ),
    path(
        "relatorios/resumo-do-mes/",
        RelatorioResumoMesView.as_view(),
        name="relatorio-resumo-mes",
    ),
    path(
        "webhooks/mercadopago/",
        WebhookMercadoPagoView.as_view(),
        name="webhook-mercadopago",
    ),
    path(
        "webhooks/whatsapp/",
        WhatsappWebhookView.as_view(),
        name="webhook-whatsapp",
    ),
    # Conexão do WhatsApp do dono (admin): status / QR / logout.
    path("whatsapp/status/", WhatsappConexaoStatusView.as_view(), name="whatsapp-status"),
    path("whatsapp/conectar/", WhatsappConectarView.as_view(), name="whatsapp-conectar"),
    path("whatsapp/desconectar/", WhatsappDesconectarView.as_view(), name="whatsapp-desconectar"),
    path("whatsapp/dono/", WhatsappDonoView.as_view(), name="whatsapp-dono"),
    path("", include(router.urls)),
]
