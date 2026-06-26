"""Throttling: 429 nos pontos sensíveis, webhooks isentos, login genérico.

O ``conftest`` limpa o cache do throttle antes/depois de cada teste, então cada
caso começa com a contagem zerada.
"""

import pytest
from django.urls import reverse

from catalogo import pagamentos

pytestmark = pytest.mark.django_db


# --------------------------------------------------------------------------
# Login / cadastro → 429 ao exceder (anti brute-force, por IP)
# --------------------------------------------------------------------------
def test_login_admin_estrangula_apos_limite(api):
    # Escopo "login" = 10/min por IP → o 11º vira 429.
    codigos = [
        api.post(reverse("login"), {"username": "x", "password": "y"}, format="json").status_code
        for _ in range(11)
    ]
    assert codigos[-1] == 429
    assert all(c in (400, 401) for c in codigos[:10])


def test_login_cliente_estrangula_apos_limite(api):
    codigos = [
        api.post(reverse("conta-login"), {"email": "a@b.com", "password": "y"}, format="json").status_code
        for _ in range(11)
    ]
    assert codigos[-1] == 429


def test_cadastro_estrangula_apos_limite(api):
    # Cadastro usa o escopo "encomendas" (10/hora por IP) — ainda mais estrito.
    codigos = [
        api.post(reverse("conta-cadastro"), {}, format="json").status_code for _ in range(11)
    ]
    assert codigos[-1] == 429


# --------------------------------------------------------------------------
# Uso normal NÃO é afetado
# --------------------------------------------------------------------------
def test_uso_normal_nao_estrangula(api, peca_ativa):
    # Algumas leituras públicas seguidas continuam 200 (bem abaixo do limite anon).
    for _ in range(15):
        assert api.get(reverse("peca-list")).status_code == 200


def test_login_valido_nao_estrangula_em_poucas_tentativas(api):
    # 3 tentativas (abaixo do limite) não disparam 429.
    codigos = [
        api.post(reverse("login"), {"username": "x", "password": "y"}, format="json").status_code
        for _ in range(3)
    ]
    assert 429 not in codigos


# --------------------------------------------------------------------------
# Webhooks do provedor NÃO são estrangulados (reenvios; idempotência protege)
# --------------------------------------------------------------------------
def test_webhook_mercadopago_nao_e_estrangulado(api, monkeypatch):
    monkeypatch.setattr(pagamentos, "assinatura_valida", lambda request, data_id: False)
    url = reverse("webhook-mercadopago")
    codigos = [
        api.post(
            f"{url}?type=payment&data.id=PAY",
            {"type": "payment", "data": {"id": "PAY"}},
            format="json",
        ).status_code
        for _ in range(25)
    ]
    assert 429 not in codigos  # 25 chamadas seguidas, nunca estrangulado


def test_webhook_whatsapp_nao_e_estrangulado(api):
    url = reverse("webhook-whatsapp")
    codigos = [api.post(url, {"event": "outro"}, format="json").status_code for _ in range(25)]
    assert 429 not in codigos


# --------------------------------------------------------------------------
# Mensagem de login genérica (anti-enumeração) — não revela qual campo errou
# --------------------------------------------------------------------------
def test_login_admin_mensagem_generica(api):
    r = api.post(reverse("login"), {"username": "naoexiste", "password": "errada"}, format="json")
    assert r.status_code in (400, 401)
    assert "usuário ou senha" in str(r.data).lower()


def test_login_cliente_mensagem_generica(api):
    r = api.post(reverse("conta-login"), {"email": "naoexiste@x.com", "password": "errada"}, format="json")
    assert r.status_code in (400, 401)
    assert "e-mail ou senha" in str(r.data).lower()
