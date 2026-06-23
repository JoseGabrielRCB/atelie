"""Rotas da API do catálogo."""

from django.urls import include, path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .views import (
    CategoriaViewSet,
    CheckoutView,
    CorViewSet,
    EncomendaViewSet,
    ImagemViewSet,
    PecaViewSet,
    PedidoViewSet,
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

urlpatterns = [
    path("auth/login/", TokenObtainPairView.as_view(), name="login"),
    path("auth/refresh/", TokenRefreshView.as_view(), name="refresh"),
    path("checkout/", CheckoutView.as_view(), name="checkout"),
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
