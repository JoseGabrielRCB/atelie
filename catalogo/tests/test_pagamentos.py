"""Testes do pagamento online (Checkout Pro do Mercado Pago).

Todas as chamadas ao Mercado Pago são mockadas via monkeypatch das funções de
``catalogo.pagamentos`` — nenhum teste toca a rede.
"""

from decimal import Decimal

import pytest
from django.urls import reverse
from django.utils import timezone

from catalogo import pagamentos
from catalogo.models import (
    EventoPagamento,
    ItemPedido,
    Peca,
    Pedido,
    Variacao,
)

pytestmark = pytest.mark.django_db


# --------------------------------------------------------------------------
# Fixtures / helpers
# --------------------------------------------------------------------------


@pytest.fixture
def variacao_p(peca_ativa):
    return Variacao.objects.get(peca=peca_ativa, tamanho="P")  # estoque=3


@pytest.fixture
def peca_sob_medida(db, categoria):
    return Peca.objects.create(
        nome="Vestido Sob Medida",
        preco=Decimal("500.00"),
        categoria=categoria,
        tipo=Peca.Tipo.SOB_MEDIDA,
        ativo=True,
    )


def _mock_preferencia(monkeypatch, pref_id="PREF-123", init="https://mp/checkout/123"):
    def fake(pedido, itens, base_url, frontend_url, notification_url, payer=None):
        return {"id": pref_id, "init_point": init}

    monkeypatch.setattr(pagamentos, "criar_preferencia", fake)


def _criar_pedido_pendente(variacao, qtd, expira_minutos=30):
    pedido = Pedido.objects.create(
        nome="Maria",
        contato="81999999999",
        status=Pedido.Status.AGUARDANDO_PAGAMENTO,
        total=variacao.peca.preco * qtd,
        expira_em=timezone.now() + timezone.timedelta(minutes=expira_minutos),
    )
    ItemPedido.objects.create(
        pedido=pedido, variacao=variacao, quantidade=qtd, preco_unit=variacao.peca.preco
    )
    return pedido


# --------------------------------------------------------------------------
# (a) disponibilidade subtrai reservas ativas não expiradas
# --------------------------------------------------------------------------


def test_disponivel_subtrai_reserva_ativa(api, peca_ativa, variacao_p):
    # estoque=3; reserva 2 com pedido pendente válido => disponivel=1
    _criar_pedido_pendente(variacao_p, 2)

    url = reverse("peca-detail", args=[peca_ativa.id])
    resp = api.get(url)
    por_tamanho = {v["tamanho"]: v for v in resp.data["variacoes"]}
    assert por_tamanho["P"]["estoque"] == 3
    assert por_tamanho["P"]["disponivel"] == 1


def test_reserva_expirada_nao_conta(api, peca_ativa, variacao_p):
    _criar_pedido_pendente(variacao_p, 2, expira_minutos=-5)  # já expirado
    url = reverse("peca-detail", args=[peca_ativa.id])
    resp = api.get(url)
    por_tamanho = {v["tamanho"]: v for v in resp.data["variacoes"]}
    assert por_tamanho["P"]["disponivel"] == 3


def test_disponivel_nunca_negativo(api, peca_ativa, variacao_p):
    _criar_pedido_pendente(variacao_p, 3)
    variacao_p.estoque = 1
    variacao_p.save()
    url = reverse("peca-detail", args=[peca_ativa.id])
    resp = api.get(url)
    por_tamanho = {v["tamanho"]: v for v in resp.data["variacoes"]}
    assert por_tamanho["P"]["disponivel"] == 0


# --------------------------------------------------------------------------
# (b) checkout recalcula preço no servidor; rejeita sob_medida/inativa
# --------------------------------------------------------------------------


def test_checkout_recalcula_preco_ignora_cliente(api, monkeypatch, variacao_p, cliente):
    _mock_preferencia(monkeypatch)
    api.force_authenticate(cliente.usuario)
    url = reverse("checkout")
    resp = api.post(
        url,
        {
            # tenta enviar preço/total maliciosos — devem ser ignorados
            "total": "0.01",
            "itens": [{"variacao_id": variacao_p.id, "quantidade": 2, "preco_unit": "0.01"}],
        },
        format="json",
    )
    assert resp.status_code == 201, resp.data
    pedido = Pedido.objects.get(pk=resp.data["pedido_id"])
    assert pedido.total == Decimal("199.90") * 2
    assert pedido.itens.first().preco_unit == Decimal("199.90")
    assert resp.data["init_point"] == "https://mp/checkout/123"
    assert pedido.mp_preference_id == "PREF-123"
    # pedido associado à conta do cliente; nome vem da conta
    assert pedido.cliente_id == cliente.id
    assert pedido.nome == cliente.nome
    # estoque NÃO decrementado ainda
    variacao_p.refresh_from_db()
    assert variacao_p.estoque == 3


def test_checkout_exige_conta_de_cliente(api, monkeypatch, variacao_p, admin_user):
    """Anônimo → 401; staff → 403 (checkout é só de cliente)."""
    _mock_preferencia(monkeypatch)
    url = reverse("checkout")
    corpo = {"itens": [{"variacao_id": variacao_p.id, "quantidade": 1}]}
    assert api.post(url, corpo, format="json").status_code == 401
    api.force_authenticate(admin_user)
    assert api.post(url, corpo, format="json").status_code == 403


def test_checkout_rejeita_sob_medida(api, monkeypatch, peca_sob_medida, cliente):
    _mock_preferencia(monkeypatch)
    api.force_authenticate(cliente.usuario)
    v = Variacao.objects.create(peca=peca_sob_medida, tamanho="Único", cor="", estoque=5)
    url = reverse("checkout")
    resp = api.post(
        url,
        {"itens": [{"variacao_id": v.id, "quantidade": 1}]},
        format="json",
    )
    assert resp.status_code == 400
    assert "itens" in resp.data


def test_checkout_rejeita_peca_inativa(api, monkeypatch, peca_inativa, cliente):
    _mock_preferencia(monkeypatch)
    api.force_authenticate(cliente.usuario)
    v = Variacao.objects.create(peca=peca_inativa, tamanho="P", cor="", estoque=5)
    url = reverse("checkout")
    resp = api.post(
        url,
        {"itens": [{"variacao_id": v.id, "quantidade": 1}]},
        format="json",
    )
    assert resp.status_code == 400
    assert "itens" in resp.data


def test_checkout_estoque_insuficiente_409(api, monkeypatch, variacao_p, cliente):
    _mock_preferencia(monkeypatch)
    api.force_authenticate(cliente.usuario)
    url = reverse("checkout")
    resp = api.post(
        url,
        {"itens": [{"variacao_id": variacao_p.id, "quantidade": 99}]},
        format="json",
    )
    assert resp.status_code == 409
    assert "disponibilidade" in resp.data


# --------------------------------------------------------------------------
# (c) webhook aprovado decrementa exatamente uma vez (idempotência)
# --------------------------------------------------------------------------


def _post_webhook(api, monkeypatch, pedido, payment_id="PAY-1", aprovado=True, assinatura_ok=True):
    monkeypatch.setattr(pagamentos, "assinatura_valida", lambda request, data_id: assinatura_ok)
    monkeypatch.setattr(
        pagamentos,
        "consultar_pagamento",
        lambda pid: {
            "status": "approved" if aprovado else "rejected",
            "external_reference": str(pedido.id),
        },
    )
    url = reverse("webhook-mercadopago")
    return api.post(
        f"{url}?type=payment&data.id={payment_id}",
        {"type": "payment", "data": {"id": payment_id}},
        format="json",
    )


def test_webhook_aprovado_decrementa_uma_vez(api, monkeypatch, variacao_p):
    pedido = _criar_pedido_pendente(variacao_p, 2)
    resp = _post_webhook(api, monkeypatch, pedido)
    assert resp.status_code == 200
    variacao_p.refresh_from_db()
    pedido.refresh_from_db()
    assert variacao_p.estoque == 1  # 3 - 2
    assert pedido.status == Pedido.Status.PAGO
    assert pedido.mp_payment_id == "PAY-1"
    assert EventoPagamento.objects.filter(evento_id="PAY-1").count() == 1


def test_webhook_evento_duplicado_nao_decrementa_de_novo(api, monkeypatch, variacao_p):
    pedido = _criar_pedido_pendente(variacao_p, 2)
    _post_webhook(api, monkeypatch, pedido)
    # segunda notificação com o mesmo payment id
    resp = _post_webhook(api, monkeypatch, pedido)
    assert resp.status_code == 200
    variacao_p.refresh_from_db()
    assert variacao_p.estoque == 1  # não decrementou de novo
    assert EventoPagamento.objects.filter(evento_id="PAY-1").count() == 1


def test_webhook_nao_aprovado_nao_decrementa(api, monkeypatch, variacao_p):
    pedido = _criar_pedido_pendente(variacao_p, 2)
    resp = _post_webhook(api, monkeypatch, pedido, aprovado=False)
    assert resp.status_code == 200
    variacao_p.refresh_from_db()
    pedido.refresh_from_db()
    assert variacao_p.estoque == 3
    assert pedido.status == Pedido.Status.AGUARDANDO_PAGAMENTO


# --------------------------------------------------------------------------
# (d) concorrência: dois pedidos para o último item -> só um fica pago
# --------------------------------------------------------------------------


def test_concorrencia_ultimo_item(api, monkeypatch, peca_ativa):
    variacao = Variacao.objects.get(peca=peca_ativa, tamanho="P")
    variacao.estoque = 1
    variacao.save()
    pedido_a = _criar_pedido_pendente(variacao, 1)
    pedido_b = _criar_pedido_pendente(variacao, 1)

    _post_webhook(api, monkeypatch, pedido_a, payment_id="PAY-A")
    _post_webhook(api, monkeypatch, pedido_b, payment_id="PAY-B")

    variacao.refresh_from_db()
    pedido_a.refresh_from_db()
    pedido_b.refresh_from_db()

    assert variacao.estoque == 0  # nunca negativo
    pagos = [p for p in (pedido_a, pedido_b) if p.status == Pedido.Status.PAGO]
    # O 2º pagamento (sem estoque) vai para "em revisão" (precisa estorno no MP).
    em_revisao = [p for p in (pedido_a, pedido_b) if p.status == Pedido.Status.EM_REVISAO]
    assert len(pagos) == 1
    assert len(em_revisao) == 1
    assert em_revisao[0].motivo_revisao == Pedido.MotivoRevisao.SEM_ESTOQUE_APOS_PAGO


# --------------------------------------------------------------------------
# (e) assinatura inválida -> 401
# --------------------------------------------------------------------------


def test_webhook_assinatura_invalida_401(api, monkeypatch, variacao_p):
    pedido = _criar_pedido_pendente(variacao_p, 1)
    resp = _post_webhook(api, monkeypatch, pedido, assinatura_ok=False)
    assert resp.status_code == 401
    variacao_p.refresh_from_db()
    assert variacao_p.estoque == 3


# --------------------------------------------------------------------------
# Admin: listagem de pedidos exige autenticação
# --------------------------------------------------------------------------


def test_pedidos_anonimo_nao_lista(api, variacao_p):
    _criar_pedido_pendente(variacao_p, 1)
    resp = api.get(reverse("pedido-list"))
    assert resp.status_code in (401, 403)


def test_pedidos_admin_lista_com_itens(api, admin_user, variacao_p):
    _criar_pedido_pendente(variacao_p, 2)
    api.force_authenticate(user=admin_user)
    resp = api.get(reverse("pedido-list"))
    assert resp.status_code == 200
    assert resp.data["count"] == 1
    assert "itens" in resp.data["results"][0]
    assert resp.data["results"][0]["itens"][0]["quantidade"] == 2


# --------------------------------------------------------------------------
# Comando de expiração
# --------------------------------------------------------------------------


def test_expirar_pedidos(variacao_p):
    from django.core.management import call_command

    vencido = _criar_pedido_pendente(variacao_p, 1, expira_minutos=-1)
    valido = _criar_pedido_pendente(variacao_p, 1, expira_minutos=30)
    call_command("expirar_pedidos")
    vencido.refresh_from_db()
    valido.refresh_from_db()
    assert vencido.status == Pedido.Status.EXPIRADO
    assert valido.status == Pedido.Status.AGUARDANDO_PAGAMENTO
