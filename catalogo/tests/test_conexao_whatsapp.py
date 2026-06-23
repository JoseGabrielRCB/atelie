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


class _Resp:
    """Resposta falsa de requests para testar evolution.py sem rede."""

    def __init__(self, status_code=200, payload=None):
        self.status_code = status_code
        self._payload = payload or {}

    @property
    def ok(self):
        return self.status_code < 400

    def json(self):
        return self._payload

    def raise_for_status(self):
        if self.status_code >= 400:
            import requests

            raise requests.exceptions.HTTPError(response=self)


@pytest.fixture
def _config(settings):
    settings.EVOLUTION_URL = "http://evolution-api:8080"
    settings.EVOLUTION_API_KEY = "chave"
    settings.EVOLUTION_INSTANCE = "atelie-bot"


def test_estado_chave_invalida(_config, monkeypatch):
    import requests

    # Chave inválida na Evolution responde 401 (e SÓ 401 vira "chave inválida").
    monkeypatch.setattr(requests, "get", lambda *a, **k: _Resp(401))
    resultado = evolution.estado_conexao()
    assert resultado["estado"] == "nao_autorizado"
    assert "EVOLUTION_API_KEY" in resultado["mensagem"]


def test_403_nao_e_chave_invalida(_config, monkeypatch):
    """403 da Evolution é regra de negócio (não auth) → NÃO pode virar 'chave inválida'."""
    import requests

    monkeypatch.setattr(requests, "get", lambda *a, **k: _Resp(403))
    resultado = evolution.estado_conexao()
    assert resultado["estado"] == "erro_evolution"
    assert "EVOLUTION_API_KEY" not in resultado["mensagem"]


def test_conectar_connect_sem_qr_403_no_create_nao_vira_chave_invalida(_config, monkeypatch):
    """Regressão: connect sem QR + create 403 ('já existe') NÃO pode dizer 'chave inválida'.

    Antes, o fallback recriava sem apagar e o 403 'name already in use' era
    classificado como chave inválida. Agora recriamos do zero (delete + create).
    """
    import requests

    monkeypatch.setattr(
        evolution,
        "estado_conexao",
        lambda: {"configurado": True, "estado": "connecting", "instancia": "atelie-bot"},
    )
    # connect responde 200 sem QR (instância presa em "connecting").
    monkeypatch.setattr(requests, "get", lambda *a, **k: _Resp(200, {"count": 0}))
    apagou = {"chamou": False}

    def _delete(*a, **k):
        apagou["chamou"] = True
        return _Resp(200, {"status": "SUCCESS"})

    monkeypatch.setattr(requests, "delete", _delete)
    # após o delete, o create devolve o QR.
    monkeypatch.setattr(
        requests,
        "post",
        lambda *a, **k: _Resp(201, {"qrcode": {"base64": "data:image/png;base64,QQQ", "pairingCode": "P1"}}),
    )
    resultado = evolution.conectar()
    assert apagou["chamou"] is True  # recriou do zero
    assert resultado["estado"] == "qr"
    assert resultado["qr_base64"].endswith("QQQ")


def test_estado_erro_interno_evolution(_config, monkeypatch):
    import requests

    monkeypatch.setattr(requests, "get", lambda *a, **k: _Resp(500))
    resultado = evolution.estado_conexao()
    assert resultado["estado"] == "erro_evolution"
    assert "evolution" in resultado["mensagem"].lower()


def test_estado_conexao_recusada(_config, monkeypatch):
    import requests

    def _recusa(*a, **k):
        raise requests.exceptions.ConnectionError()

    monkeypatch.setattr(requests, "get", _recusa)
    resultado = evolution.estado_conexao()
    assert resultado["estado"] == "indisponivel"
    assert "fora do ar" in resultado["mensagem"]


def test_conectar_recria_quando_connect_sem_qr(_config, monkeypatch):
    """connect sem QR → tenta criar a instância e retorna o QR de lá."""
    import requests

    monkeypatch.setattr(
        evolution,
        "estado_conexao",
        lambda: {"configurado": True, "estado": "close", "instancia": "atelie-bot"},
    )
    # /instance/connect responde 200 mas sem base64/pairingCode.
    monkeypatch.setattr(requests, "get", lambda *a, **k: _Resp(200, {}))
    # delete da instância antiga (recriação do zero) — best-effort.
    monkeypatch.setattr(requests, "delete", lambda *a, **k: _Resp(200, {"status": "SUCCESS"}))
    # /instance/create devolve o QR aninhado (formato da v2).
    monkeypatch.setattr(
        requests,
        "post",
        lambda *a, **k: _Resp(200, {"qrcode": {"base64": "data:image/png;base64,ZZZ", "pairingCode": "K9"}}),
    )
    resultado = evolution.conectar()
    assert resultado["estado"] == "qr"
    assert resultado["qr_base64"].endswith("ZZZ")
    assert resultado["pairing_code"] == "K9"


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


def test_configurar_webhook_usa_endpoint_da_instancia(_config, settings, monkeypatch):
    import requests

    settings.EVOLUTION_WEBHOOK_URL = "http://backend:8000/api/webhooks/whatsapp/"
    chamadas = []

    def _post(url, **kwargs):
        chamadas.append((url, kwargs))
        return _Resp(201, {"id": "webhook-1"})

    monkeypatch.setattr(requests, "post", _post)

    assert evolution._configurar_webhook() is True
    assert chamadas[0][0].endswith("/webhook/set/atelie-bot")
    assert chamadas[0][1]["json"] == {
        "webhook": {
            "enabled": True,
            "url": "http://backend:8000/api/webhooks/whatsapp/",
            "webhookByEvents": False,
            "events": ["MESSAGES_UPSERT"],
        }
    }


def test_whatsapp_dono_exige_autenticacao(api):
    resp = api.get(reverse("whatsapp-dono"))
    assert resp.status_code == 401


def test_whatsapp_dono_mostra_numero_atual(api, admin_user, settings):
    settings.WHATSAPP_DONO = ["5567999990000"]
    api.force_authenticate(user=admin_user)
    resp = api.get(reverse("whatsapp-dono"))
    assert resp.status_code == 200
    assert resp.data == {"numero": "5567999990000", "configurado": True}


def test_whatsapp_dono_atualiza_env_e_settings(api, admin_user, settings, tmp_path):
    settings.BASE_DIR = tmp_path
    settings.WHATSAPP_DONO = ["5567999990000"]
    env_path = tmp_path / ".env"
    env_path.write_text("WHATSAPP_DONO=5567999990000\nOUTRA=ok\n", encoding="utf-8")

    api.force_authenticate(user=admin_user)
    resp = api.patch(reverse("whatsapp-dono"), {"numero": "+55 (67) 92072-9997"}, format="json")

    assert resp.status_code == 200
    assert resp.data["numero"] == "5567920729997"
    assert settings.WHATSAPP_DONO == ["5567920729997"]
    assert "WHATSAPP_DONO=5567920729997" in env_path.read_text(encoding="utf-8")
    assert "OUTRA=ok" in env_path.read_text(encoding="utf-8")


def test_whatsapp_dono_valida_formato(api, admin_user):
    api.force_authenticate(user=admin_user)
    resp = api.patch(reverse("whatsapp-dono"), {"numero": "123"}, format="json")
    assert resp.status_code == 400
    assert "numero" in resp.data
