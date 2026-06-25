"""Pedido 'em revisão' — pago no MP mas NÃO atendido (precisa de ação do dono).

Cobre os três tratamentos do webhook (valor divergente, pago após expiração, sem
estoque na confirmação), a reserva travada no checkout e a idempotência em todos.
Estoque nunca baixa indevidamente.
"""

from decimal import Decimal

import pytest
from django.urls import reverse
from django.utils import timezone

from catalogo import pagamentos
from catalogo.models import EventoPagamento, ItemPedido, Pedido, Variacao

pytestmark = pytest.mark.django_db


def _var_p(peca):
    return peca.variacoes.get(tamanho="P")  # estoque 3, preço 199.90


def _pendente(peca, qtd=1, expira_min=30):
    v = _var_p(peca)
    pedido = Pedido.objects.create(
        nome="Maria",
        contato="x",
        status=Pedido.Status.AGUARDANDO_PAGAMENTO,
        total=v.peca.preco * qtd,
        expira_em=timezone.now() + timezone.timedelta(minutes=expira_min),
    )
    ItemPedido.objects.create(pedido=pedido, variacao=v, quantidade=qtd, preco_unit=v.peca.preco)
    return pedido


def _webhook(api, monkeypatch, pedido, payment_id="PAY-1", amount=None):
    monkeypatch.setattr(pagamentos, "assinatura_valida", lambda request, data_id: True)
    resposta = {"status": "approved", "external_reference": str(pedido.id)}
    if amount is not None:
        resposta["transaction_amount"] = amount
    monkeypatch.setattr(pagamentos, "consultar_pagamento", lambda pid: resposta)
    url = reverse("webhook-mercadopago")
    return api.post(
        f"{url}?type=payment&data.id={payment_id}",
        {"type": "payment", "data": {"id": payment_id}},
        format="json",
    )


def _mock_pref(monkeypatch):
    monkeypatch.setattr(
        pagamentos, "criar_preferencia",
        lambda *a, **k: {"id": "PREF", "init_point": "https://mp/x"},
    )


# --------------------------------------------------------------------------
# (1) Valor divergente → em revisão / divergencia_valor
# --------------------------------------------------------------------------
def test_valor_divergente_vai_para_revisao(api, monkeypatch, peca_ativa):
    pedido = _pendente(peca_ativa, 1)  # total 199.90
    _webhook(api, monkeypatch, pedido, amount=100.00)
    pedido.refresh_from_db()
    assert pedido.status == Pedido.Status.EM_REVISAO
    assert pedido.motivo_revisao == Pedido.MotivoRevisao.DIVERGENCIA_VALOR
    assert _var_p(peca_ativa).estoque == 3  # não baixou


# --------------------------------------------------------------------------
# (2) Pago após a expiração → em revisão / pago_apos_expiracao
# --------------------------------------------------------------------------
def test_pago_apos_expiracao_vai_para_revisao(api, monkeypatch, peca_ativa):
    pedido = _pendente(peca_ativa, 1, expira_min=-5)  # já vencido
    _webhook(api, monkeypatch, pedido, amount=199.90)  # valor certo
    pedido.refresh_from_db()
    assert pedido.status == Pedido.Status.EM_REVISAO
    assert pedido.motivo_revisao == Pedido.MotivoRevisao.PAGO_APOS_EXPIRACAO
    assert _var_p(peca_ativa).estoque == 3  # não baixou


def test_pago_apos_expirar_pedidos_marcado_expirado(api, monkeypatch, peca_ativa):
    from django.core.management import call_command

    pedido = _pendente(peca_ativa, 1, expira_min=-5)
    call_command("expirar_pedidos")  # marca EXPIRADO
    pedido.refresh_from_db()
    assert pedido.status == Pedido.Status.EXPIRADO
    _webhook(api, monkeypatch, pedido, amount=199.90)
    pedido.refresh_from_db()
    assert pedido.status == Pedido.Status.EM_REVISAO
    assert pedido.motivo_revisao == Pedido.MotivoRevisao.PAGO_APOS_EXPIRACAO


# --------------------------------------------------------------------------
# (3) Sem estoque na confirmação (corrida) → em revisão / sem_estoque_apos_pago
# --------------------------------------------------------------------------
def test_sem_estoque_na_confirmacao_vai_para_revisao(api, monkeypatch, peca_ativa):
    v = _var_p(peca_ativa)
    v.estoque = 1
    v.save()
    pedido_a = _pendente(peca_ativa, 1)
    pedido_b = _pendente(peca_ativa, 1)

    _webhook(api, monkeypatch, pedido_a, payment_id="PAY-A", amount=199.90)
    _webhook(api, monkeypatch, pedido_b, payment_id="PAY-B", amount=199.90)

    v.refresh_from_db()
    pedido_a.refresh_from_db()
    pedido_b.refresh_from_db()
    assert v.estoque == 0  # nunca negativo
    assert pedido_a.status == Pedido.Status.PAGO
    assert pedido_b.status == Pedido.Status.EM_REVISAO
    assert pedido_b.motivo_revisao == Pedido.MotivoRevisao.SEM_ESTOQUE_APOS_PAGO


# --------------------------------------------------------------------------
# Idempotência: evento duplicado é no-op em cada caso
# --------------------------------------------------------------------------
def test_idempotencia_revisao_divergencia(api, monkeypatch, peca_ativa):
    pedido = _pendente(peca_ativa, 1)
    _webhook(api, monkeypatch, pedido, payment_id="PAY-D", amount=50.00)
    _webhook(api, monkeypatch, pedido, payment_id="PAY-D", amount=50.00)  # duplicado
    pedido.refresh_from_db()
    assert pedido.status == Pedido.Status.EM_REVISAO
    assert _var_p(peca_ativa).estoque == 3
    assert EventoPagamento.objects.filter(evento_id="PAY-D").count() == 1


def test_idempotencia_pago_normal(api, monkeypatch, peca_ativa):
    pedido = _pendente(peca_ativa, 2)
    _webhook(api, monkeypatch, pedido, payment_id="PAY-OK", amount=399.80)
    _webhook(api, monkeypatch, pedido, payment_id="PAY-OK", amount=399.80)  # duplicado
    pedido.refresh_from_db()
    assert pedido.status == Pedido.Status.PAGO
    assert _var_p(peca_ativa).estoque == 1  # baixou só uma vez (3 - 2)


# --------------------------------------------------------------------------
# Reserva travada no checkout: o segundo checkout da última unidade vê a reserva
# do primeiro e recebe 409 (a transação com lock serializa os concorrentes).
# --------------------------------------------------------------------------
def test_reserva_bloqueia_dupla_reserva_da_ultima_unidade(api, monkeypatch, peca_ativa, cliente):
    _mock_pref(monkeypatch)
    v = _var_p(peca_ativa)
    v.estoque = 1
    v.save()
    api.force_authenticate(cliente.usuario)
    url = reverse("checkout")
    corpo = {"itens": [{"variacao_id": v.id, "quantidade": 1}]}

    r1 = api.post(url, corpo, format="json")
    r2 = api.post(url, corpo, format="json")

    assert r1.status_code == 201
    assert r2.status_code == 409  # a reserva do 1º já tomou a última unidade
    assert "disponibilidade" in r2.data
