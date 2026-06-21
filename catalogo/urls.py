"""Rotas da API do catálogo."""

from django.urls import include, path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .views import (
    CategoriaViewSet,
    EncomendaViewSet,
    ImagemViewSet,
    PecaViewSet,
    VariacaoViewSet,
)

router = DefaultRouter()
router.register("categorias", CategoriaViewSet, basename="categoria")
router.register("pecas", PecaViewSet, basename="peca")
router.register("variacoes", VariacaoViewSet, basename="variacao")
router.register("imagens", ImagemViewSet, basename="imagem")
router.register("encomendas", EncomendaViewSet, basename="encomenda")

urlpatterns = [
    path("auth/login/", TokenObtainPairView.as_view(), name="login"),
    path("auth/refresh/", TokenRefreshView.as_view(), name="refresh"),
    path("", include(router.urls)),
]
