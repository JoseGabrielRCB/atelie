"""Testes dos comandos remotos do bot de WhatsApp do DONO (privado).

Cobrem o interpretador puro (``comandos.interpretar``) e o webhook de entrada
(``/api/webhooks/whatsapp/``): autorização de remetente e idempotência.

Não tocam a rede nem deixam threads escaparem: monkeypatcham ``enviar_whatsapp``.
"""

import pytest
from django.urls import reverse

from catalogo import comandos, notificacoes, views
from catalogo.comandos import interpretar
from catalogo.models import MensagemWhatsApp, Variacao

pytestmark = pytest.mark.django_db

DONO = "5567999990000"


@pytest.fixture
def sem_rede(monkeypatch):
    """Captura mensagens enviadas e evita rede/threads em todos os módulos."""
    enviadas = []
    fake = lambda texto, **kw: enviadas.append(texto)
    monkeypatch.setattr(views, "enviar_whatsapp", fake)
    monkeypatch.setattr(notificacoes, "enviar_whatsapp", fake)
    monkeypatch.setattr(comandos, "checar_estoque_baixo", lambda *a, **k: None)
    return enviadas


def _evento(texto, *, msg_id="MSG1", remote=DONO + "@s.whatsapp.net", from_me=False):
    return {
        "event": "messages.upsert",
        "instance": "atelie-bot",
        "data": {
            "key": {"remoteJid": remote, "fromMe": from_me, "id": msg_id},
            "message": {"conversation": texto},
            "pushName": "Dono",
        },
    }


# (a) estoque <peça> ----------------------------------------------------------


def test_interpretar_estoque_lista_variacoes(peca_ativa):
    resp = interpretar("estoque Vestido")
    assert "Vestido Floral:" in resp
    assert "P/Azul: 3" in resp
    assert "M/Azul: 0 (esgotado)" in resp


def test_interpretar_estoque_sem_resultado(db):
    assert "Nenhuma peça encontrada" in interpretar("estoque Inexistente")


# (b) baixa decrementa com lock e nunca fica negativo -------------------------


def test_interpretar_baixa_decrementa(peca_ativa):
    resp = interpretar("baixa 1 Vestido Floral P Azul")
    assert "estoque agora 2" in resp
    assert Variacao.objects.get(peca=peca_ativa, tamanho="P", cor="Azul").estoque == 2


def test_interpretar_baixa_acima_do_estoque_recusa(peca_ativa):
    resp = interpretar("baixa 99 Vestido Floral P Azul")
    assert "insuficiente" in resp.lower()
    # Estoque inalterado.
    assert Variacao.objects.get(peca=peca_ativa, tamanho="P", cor="Azul").estoque == 3


def test_interpretar_baixa_qtd_invalida(peca_ativa):
    assert "Comandos disponíveis" in interpretar("baixa abc Vestido Floral P Azul")
    assert "positivo" in interpretar("baixa 0 Vestido Floral P Azul")


# (c) repor incrementa --------------------------------------------------------


def test_interpretar_repor_incrementa(peca_ativa):
    resp = interpretar("repor 2 Vestido Floral M Azul")
    assert "estoque agora 2" in resp
    assert Variacao.objects.get(peca=peca_ativa, tamanho="M", cor="Azul").estoque == 2


def test_interpretar_ambiguo_pede_especificidade(peca_ativa, categoria):
    from decimal import Decimal

    from catalogo.models import Peca

    outra = Peca.objects.create(
        nome="Vestido Festa", preco=Decimal("10.00"), categoria=categoria
    )
    Variacao.objects.create(peca=outra, tamanho="P", cor="Azul", estoque=5)
    resp = interpretar("baixa 1 Vestido P Azul")
    assert "mais de uma" in resp.lower()


# (d) ajuda / não reconhecido -------------------------------------------------


def test_interpretar_desconhecido_retorna_ajuda(db):
    assert "Comandos disponíveis" in interpretar("blablabla")
    assert "Comandos disponíveis" in interpretar("ajuda")


# (e) webhook: autorização ----------------------------------------------------


def test_webhook_remetente_nao_autorizado_e_ignorado(api, peca_ativa, sem_rede, settings):
    settings.WHATSAPP_DONO = [DONO]
    url = reverse("webhook-whatsapp")
    payload = _evento("baixa 1 Vestido Floral P Azul", remote="5511000000000@s.whatsapp.net")

    resp = api.post(url, payload, format="json")

    assert resp.status_code == 200
    assert sem_rede == []  # não respondeu
    # Estoque intacto.
    assert Variacao.objects.get(peca=peca_ativa, tamanho="P", cor="Azul").estoque == 3


def test_webhook_remetente_autorizado_processa(api, peca_ativa, sem_rede, settings):
    settings.WHATSAPP_DONO = [DONO]
    url = reverse("webhook-whatsapp")
    payload = _evento("baixa 1 Vestido Floral P Azul")

    resp = api.post(url, payload, format="json")

    assert resp.status_code == 200
    assert any("estoque agora 2" in m for m in sem_rede)
    assert Variacao.objects.get(peca=peca_ativa, tamanho="P", cor="Azul").estoque == 2


def test_webhook_from_me_ignorado(api, peca_ativa, sem_rede, settings):
    settings.WHATSAPP_DONO = [DONO]
    url = reverse("webhook-whatsapp")
    payload = _evento("baixa 1 Vestido Floral P Azul", from_me=True)

    resp = api.post(url, payload, format="json")

    assert resp.status_code == 200
    assert sem_rede == []
    assert Variacao.objects.get(peca=peca_ativa, tamanho="P", cor="Azul").estoque == 3


# (f) idempotência: mesmo data.key.id duas vezes ------------------------------


def test_webhook_idempotente(api, peca_ativa, sem_rede, settings):
    settings.WHATSAPP_DONO = [DONO]
    url = reverse("webhook-whatsapp")
    payload = _evento("baixa 1 Vestido Floral P Azul", msg_id="REPETIDO")

    r1 = api.post(url, payload, format="json")
    r2 = api.post(url, payload, format="json")

    assert r1.status_code == 200 and r2.status_code == 200
    # Só ajustou uma vez (3 → 2), não duas (não foi a 1).
    assert Variacao.objects.get(peca=peca_ativa, tamanho="P", cor="Azul").estoque == 2
    assert MensagemWhatsApp.objects.filter(mensagem_id="REPETIDO").count() == 1
