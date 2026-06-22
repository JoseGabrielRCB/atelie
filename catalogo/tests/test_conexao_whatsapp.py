"""Testes da conexão do WhatsApp (proxy admin para a Evolution API).

A Evolution NUNCA é chamada de verdade: monkeypatch nas funções de
``catalogo.evolution`` (ou no ``requests`` interno) evita rede.
"""

import pytest
from django.urls import reverse

from catalogo import evolution

pytestmark = pytest.mark.django_db


def test_status_exige_autenticacao(api):
    resp = api.get(reverse("whatsapp-status"))
    assert resp.status_code == 401


def test_conectar_exige_autenticacao(api):
    resp = api.post(reverse("whatsapp-conectar"))
    assert resp.status_code == 401


def test_status_nao_configurado(api, admin_user, settings):
    settings.EVOLUTION_URL = ""
    settings.EVOLUTION_API_KEY = ""
    settings.EVOLUTION_INSTANCE = ""
    api.force_authenticate(user=admin_user)
    resp = api.get(reverse("whatsapp-status"))
    assert resp.status_code == 200
    assert resp.data["configurado"] is False
    assert resp.data["estado"] == "nao_configurado"


def test_status_conectado(api, admin_user, settings, monkeypatch):
    settings.EVOLUTION_URL = "http://evolution-api:8080"
    settings.EVOLUTION_API_KEY = "chave"
    settings.EVOLUTION_INSTANCE = "atelie-bot"
    monkeypatch.setattr(
        evolution,
        "estado_conexao",
        lambda: {"configurado": True, "estado": "open", "instancia": "atelie-bot"},
    )
    api.force_authenticate(user=admin_user)
    resp = api.get(reverse("whatsapp-status"))
    assert resp.status_code == 200
    assert resp.data["estado"] == "open"


def test_conectar_devolve_qr(api, admin_user, settings, monkeypatch):
    settings.EVOLUTION_URL = "http://evolution-api:8080"
    settings.EVOLUTION_API_KEY = "chave"
    settings.EVOLUTION_INSTANCE = "atelie-bot"
    monkeypatch.setattr(
        evolution,
        "conectar",
        lambda: {
            "estado": "qr",
            "qr_base64": "data:image/png;base64,AAA",
            "pairing_code": "ABCD1234",
            "mensagem": "Escaneie o QR Code com o WhatsApp do número dedicado.",
        },
    )
    api.force_authenticate(user=admin_user)
    resp = api.post(reverse("whatsapp-conectar"))
    assert resp.status_code == 200
    assert resp.data["estado"] == "qr"
    assert resp.data["qr_base64"].startswith("data:image")


def test_conectar_no_op_sem_configuracao(settings):
    """Sem configuração, conectar() degrada sem tocar a rede nem levantar erro."""
    settings.EVOLUTION_URL = ""
    settings.EVOLUTION_API_KEY = ""
    settings.EVOLUTION_INSTANCE = ""
    resultado = evolution.conectar()
    assert resultado["estado"] == "nao_configurado"
    assert resultado["qr_base64"] is None


def test_extrair_qr_normaliza_formatos():
    # QR no topo
    assert evolution._extrair_qr({"base64": "X", "pairingCode": "P"}) == {
        "qr_base64": "X",
        "pairing_code": "P",
    }
    # QR aninhado em "qrcode" (resposta do /instance/create)
    assert evolution._extrair_qr({"qrcode": {"base64": "Y", "pairingCode": "Q"}}) == {
        "qr_base64": "Y",
        "pairing_code": "Q",
    }
