"""Privacidade/cache/JWT: Cache-Control, logout com blacklist e claims sem PII."""

import pytest
from django.urls import reverse
from rest_framework_simplejwt.tokens import AccessToken, RefreshToken

from catalogo.models import ItemPedido, Pedido

pytestmark = pytest.mark.django_db


# --------------------------------------------------------------------------
# Cache-Control: privado = no-store; público = cache curto
# --------------------------------------------------------------------------
def test_conta_me_e_no_store(api, cliente):
    api.credentials(HTTP_AUTHORIZATION=f"Bearer {AccessToken.for_user(cliente.usuario)}")
    resp = api.get(reverse("conta-me"))
    assert resp.status_code == 200
    assert "no-store" in resp["Cache-Control"]


def test_pedidos_admin_e_no_store(api, admin_user):
    api.credentials(HTTP_AUTHORIZATION=f"Bearer {AccessToken.for_user(admin_user)}")
    resp = api.get(reverse("pedido-list"))
    assert "no-store" in resp["Cache-Control"]


def test_login_resposta_e_no_store(api):
    # Rota de auth (mesmo anônima) nunca é cacheada (carrega tokens/credenciais).
    resp = api.post(reverse("login"), {"username": "x", "password": "y"}, format="json")
    assert "no-store" in resp["Cache-Control"]


def test_catalogo_publico_tem_cache_curto(api, peca_ativa):
    resp = api.get(reverse("peca-list"))
    assert resp.status_code == 200
    cc = resp["Cache-Control"]
    assert "public" in cc and "max-age" in cc
    assert "Authorization" in resp.get("Vary", "")


# --------------------------------------------------------------------------
# Logout revoga o refresh de fato (blacklist)
# --------------------------------------------------------------------------
def test_logout_revoga_refresh(api, admin_user):
    refresh = RefreshToken.for_user(admin_user)
    # Antes do logout, o refresh renova normalmente.
    assert api.post(reverse("refresh"), {"refresh": str(refresh)}, format="json").status_code == 200

    refresh2 = RefreshToken.for_user(admin_user)
    saida = api.post(reverse("logout"), {"refresh": str(refresh2)}, format="json")
    assert saida.status_code == 205
    # Depois do logout, o refresh revogado é recusado.
    nova = api.post(reverse("refresh"), {"refresh": str(refresh2)}, format="json")
    assert nova.status_code == 401


def test_logout_sem_refresh_400(api):
    assert api.post(reverse("logout"), {}, format="json").status_code == 400


def test_logout_idempotente_token_invalido(api):
    # Token inexistente/expirado também sai com sucesso (idempotente).
    assert api.post(reverse("logout"), {"refresh": "lixo"}, format="json").status_code == 205


# --------------------------------------------------------------------------
# JWT sem dados sensíveis nas claims
# --------------------------------------------------------------------------
def test_claims_do_admin_sem_pii(admin_user):
    token = AccessToken.for_user(admin_user)
    payload = dict(token.payload)
    # Não pode conter CPF, senha ou segredos.
    proibidos = {"cpf", "senha", "password", "secret"}
    assert proibidos.isdisjoint(payload.keys())


def test_claims_do_cliente_sem_cpf(cliente):
    from catalogo.serializers import ContaTokenSerializer

    token = ContaTokenSerializer.get_token(cliente.usuario)
    payload = dict(token.payload)
    assert payload.get("audiencia") == "cliente"
    assert "cpf" not in payload and str(cliente.cpf) not in str(payload)


# --------------------------------------------------------------------------
# Respostas mínimas: nunca expõe hash de senha
# --------------------------------------------------------------------------
def test_pedido_nao_expoe_campos_sensiveis(api, admin_user, peca_ativa, cliente):
    v = peca_ativa.variacoes.get(tamanho="P")
    pedido = Pedido.objects.create(
        cliente=cliente, nome=cliente.nome, contato="x",
        status=Pedido.Status.PAGO, total=v.peca.preco,
        expira_em="2099-01-01T00:00:00Z",
    )
    ItemPedido.objects.create(pedido=pedido, variacao=v, quantidade=1, preco_unit=v.peca.preco)
    api.credentials(HTTP_AUTHORIZATION=f"Bearer {AccessToken.for_user(admin_user)}")
    item = api.get(reverse("pedido-list")).data["results"][0]
    assert "password" not in item and "cpf" not in item
