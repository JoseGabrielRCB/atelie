"""Auditoria financeira — prova as propriedades do fluxo do dinheiro.

Complementa ``test_pagamentos.py`` / ``test_promocoes.py`` cobrindo o que faltava:
- os TRÊS totais batem (Σ itens − desconto == Pedido.total == total ao MP);
- dinheiro em Decimal com arredondamento ROUND_HALF_UP;
- o valor aprovado no MP é conferido contra Pedido.total (anti-fraude);
- snapshot de preço por item; Variacao paga é PROTECT;
- cupom incrementa `usos` uma única vez mesmo com webhook duplicado.

Mapa do fluxo (arquivo:linha):
- Carrinho → checkout: ``catalogo/views.py`` ``CheckoutView.post`` (~238).
- Reserva/disponibilidade: ``catalogo/estoque.py`` ``disponibilidade`` (33).
- Preferência MP: ``catalogo/pagamentos.py`` ``criar_preferencia`` (32).
- Webhook (assinatura/idempotência/baixa/pago): ``views.py`` ``WebhookMercadoPagoView`` (~395)
  e ``_confirmar_pedido`` (~470).
- Expiração: ``catalogo/management/commands/expirar_pedidos.py``.
- Relatórios: ``catalogo/relatorios.py`` (só pedidos pagos).
"""

from decimal import Decimal

import pytest
from django.db.models import ProtectedError
from django.urls import reverse
from django.utils import timezone

from catalogo import pagamentos
from catalogo.models import EventoPagamento, ItemPedido, Pedido, Promocao, Variacao

pytestmark = pytest.mark.django_db


# --------------------------------------------------------------------------
# Helpers
# --------------------------------------------------------------------------
def _var_p(peca):
    return peca.variacoes.get(tamanho="P")  # estoque 3, preço 199.90


def _itens(peca, qtd=1):
    return [{"variacao_id": _var_p(peca).id, "quantidade": qtd}]


def _mock_pref(monkeypatch, capturado=None):
    def fake(pedido, itens, base_url, frontend_url, notification_url, payer=None):
        if capturado is not None:
            capturado["itens"] = itens
        return {"id": "PREF-1", "init_point": "https://mp/x"}

    monkeypatch.setattr(pagamentos, "criar_preferencia", fake)


def _total_mp(itens):
    """Total que o Mercado Pago cobraria a partir das linhas enviadas."""
    return sum(
        (Decimal(str(i["unit_price"])) * i["quantity"] for i in itens), Decimal("0.00")
    )


def _pedido_pendente(peca, qtd=1, expira_min=30):
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


def _webhook(api, monkeypatch, pedido, payment_id="PAY-1", amount=None, aprovado=True, assinatura_ok=True):
    monkeypatch.setattr(pagamentos, "assinatura_valida", lambda request, data_id: assinatura_ok)
    resposta = {
        "status": "approved" if aprovado else "rejected",
        "external_reference": str(pedido.id),
    }
    if amount is not None:
        resposta["transaction_amount"] = amount
    monkeypatch.setattr(pagamentos, "consultar_pagamento", lambda pid: resposta)
    url = reverse("webhook-mercadopago")
    return api.post(
        f"{url}?type=payment&data.id={payment_id}",
        {"type": "payment", "data": {"id": payment_id}},
        format="json",
    )


# --------------------------------------------------------------------------
# Preço e total — os TRÊS batem
# --------------------------------------------------------------------------
def test_tres_totais_batem_sem_desconto(api, monkeypatch, peca_ativa, cliente):
    capturado = {}
    _mock_pref(monkeypatch, capturado)
    api.force_authenticate(cliente.usuario)
    resp = api.post(reverse("checkout"), {"itens": _itens(peca_ativa, 2)}, format="json")
    assert resp.status_code == 201, resp.data
    pedido = Pedido.objects.get(pk=resp.data["pedido_id"])

    soma_itens = sum((i.preco_unit * i.quantidade for i in pedido.itens.all()), Decimal("0.00"))
    # Σ itens − desconto == Pedido.total == total enviado ao MP.
    assert soma_itens - pedido.desconto == pedido.total
    assert _total_mp(capturado["itens"]) == pedido.total
    assert pedido.total == Decimal("399.80")


def test_tres_totais_batem_com_desconto_automatico(api, monkeypatch, peca_ativa, cliente):
    Promocao.objects.create(
        nome="Auto 10",
        tipo_aplicacao=Promocao.TipoAplicacao.AUTOMATICA,
        tipo_desconto=Promocao.TipoDesconto.PERCENTUAL,
        valor=Decimal("10"),
        escopo=Promocao.Escopo.TUDO,
        ativo=True,
    )
    capturado = {}
    _mock_pref(monkeypatch, capturado)
    api.force_authenticate(cliente.usuario)
    resp = api.post(reverse("checkout"), {"itens": _itens(peca_ativa, 2)}, format="json")
    assert resp.status_code == 201, resp.data
    pedido = Pedido.objects.get(pk=resp.data["pedido_id"])

    # bruto 399.80; desconto 2×19.99 = 39.98; total 359.82.
    soma_itens = sum((i.preco_unit * i.quantidade for i in pedido.itens.all()), Decimal("0.00"))
    assert soma_itens == Decimal("399.80")  # itens guardam o preço CHEIO (snapshot)
    assert pedido.desconto == Decimal("39.98")
    assert pedido.total == Decimal("359.82")
    # Com desconto, o MP recebe UMA linha com o total já descontado.
    assert _total_mp(capturado["itens"]) == pedido.total


def test_preco_recalculado_ignora_cliente(api, monkeypatch, peca_ativa, cliente):
    _mock_pref(monkeypatch)
    api.force_authenticate(cliente.usuario)
    resp = api.post(
        reverse("checkout"),
        {
            "total": "0.01",
            "itens": [{"variacao_id": _var_p(peca_ativa).id, "quantidade": 1, "preco_unit": "0.01"}],
        },
        format="json",
    )
    assert resp.status_code == 201
    pedido = Pedido.objects.get(pk=resp.data["pedido_id"])
    assert pedido.total == Decimal("199.90")
    assert pedido.itens.first().preco_unit == Decimal("199.90")


# --------------------------------------------------------------------------
# Arredondamento (Decimal, ROUND_HALF_UP)
# --------------------------------------------------------------------------
def test_arredondamento_half_up_no_desconto_unitario():
    # 10.10 × 25% = 2.5250 → ROUND_HALF_UP = 2.53 (HALF_EVEN daria 2.52).
    promo = Promocao(
        tipo_aplicacao=Promocao.TipoAplicacao.AUTOMATICA,
        tipo_desconto=Promocao.TipoDesconto.PERCENTUAL,
        valor=Decimal("25"),
    )
    assert promo.desconto_unitario(Decimal("10.10")) == Decimal("2.53")


def test_total_sempre_decimal_quantizado(api, monkeypatch, peca_ativa, cliente):
    _mock_pref(monkeypatch)
    api.force_authenticate(cliente.usuario)
    resp = api.post(reverse("checkout"), {"itens": _itens(peca_ativa, 1)}, format="json")
    pedido = Pedido.objects.get(pk=resp.data["pedido_id"])
    assert isinstance(pedido.total, Decimal)
    assert pedido.total.as_tuple().exponent == -2  # exatamente 2 casas


# --------------------------------------------------------------------------
# Webhook confere o valor pago contra o total (anti-fraude)
# --------------------------------------------------------------------------
def test_webhook_valor_correto_confirma(api, monkeypatch, peca_ativa):
    pedido = _pedido_pendente(peca_ativa, 2)  # total 399.80
    resp = _webhook(api, monkeypatch, pedido, amount=399.80)
    assert resp.status_code == 200
    pedido.refresh_from_db()
    assert pedido.status == Pedido.Status.PAGO
    assert _var_p(peca_ativa).estoque == 1


def test_webhook_valor_divergente_nao_confirma(api, monkeypatch, peca_ativa):
    pedido = _pedido_pendente(peca_ativa, 2)  # total 399.80
    resp = _webhook(api, monkeypatch, pedido, amount=349.80)  # pagou MENOS
    assert resp.status_code == 200  # sempre 200 ao MP
    pedido.refresh_from_db()
    # NÃO confirma: vira "em revisão" e o estoque não baixa.
    assert pedido.status == Pedido.Status.EM_REVISAO
    assert pedido.motivo_revisao == Pedido.MotivoRevisao.DIVERGENCIA_VALOR
    assert _var_p(peca_ativa).estoque == 3


def test_webhook_valor_a_maior_tambem_recusa(api, monkeypatch, peca_ativa):
    pedido = _pedido_pendente(peca_ativa, 1)  # total 199.90
    _webhook(api, monkeypatch, pedido, amount=999.00)
    pedido.refresh_from_db()
    assert pedido.status == Pedido.Status.EM_REVISAO
    assert pedido.motivo_revisao == Pedido.MotivoRevisao.DIVERGENCIA_VALOR


def test_webhook_sem_amount_confirma(api, monkeypatch, peca_ativa):
    # MP normalmente envia transaction_amount; se faltar, não dá pra conferir →
    # mantém o comportamento de confirmar (fail-open só quando ausente).
    pedido = _pedido_pendente(peca_ativa, 1)
    _webhook(api, monkeypatch, pedido, amount=None)
    pedido.refresh_from_db()
    assert pedido.status == Pedido.Status.PAGO


# --------------------------------------------------------------------------
# Idempotência: cupom incrementa usos uma única vez (webhook duplicado)
# --------------------------------------------------------------------------
def test_cupom_usos_incrementa_uma_vez_com_webhook_duplicado(api, monkeypatch, peca_ativa, cliente):
    cupom = Promocao.objects.create(
        nome="Cupom",
        tipo_aplicacao=Promocao.TipoAplicacao.CUPOM,
        codigo="DEZ",
        tipo_desconto=Promocao.TipoDesconto.PERCENTUAL,
        valor=Decimal("10"),
        escopo=Promocao.Escopo.TUDO,
        ativo=True,
    )
    v = _var_p(peca_ativa)
    pedido = Pedido.objects.create(
        cliente=cliente, nome=cliente.nome, contato="x",
        status=Pedido.Status.AGUARDANDO_PAGAMENTO,
        total=Decimal("179.91"), desconto=Decimal("19.99"), cupom=cupom,
        expira_em=timezone.now() + timezone.timedelta(minutes=30),
    )
    ItemPedido.objects.create(pedido=pedido, variacao=v, quantidade=1, preco_unit=v.peca.preco)

    _webhook(api, monkeypatch, pedido, payment_id="PAY-X", amount=179.91)
    _webhook(api, monkeypatch, pedido, payment_id="PAY-X", amount=179.91)  # duplicado

    cupom.refresh_from_db()
    assert cupom.usos == 1
    assert EventoPagamento.objects.filter(evento_id="PAY-X").count() == 1


# --------------------------------------------------------------------------
# Snapshot de preço + PROTECT da variação paga
# --------------------------------------------------------------------------
def test_preco_unit_e_snapshot(api, monkeypatch, peca_ativa, cliente):
    _mock_pref(monkeypatch)
    api.force_authenticate(cliente.usuario)
    resp = api.post(reverse("checkout"), {"itens": _itens(peca_ativa, 1)}, format="json")
    pedido = Pedido.objects.get(pk=resp.data["pedido_id"])

    # Preço da peça muda DEPOIS da compra — o item mantém o preço travado.
    peca_ativa.preco = Decimal("999.99")
    peca_ativa.save(update_fields=["preco"])
    item = pedido.itens.first()
    item.refresh_from_db()
    assert item.preco_unit == Decimal("199.90")


def test_variacao_de_pedido_pago_e_protegida(peca_ativa, cliente):
    v = _var_p(peca_ativa)
    pedido = Pedido.objects.create(
        cliente=cliente, nome=cliente.nome, contato="x",
        status=Pedido.Status.PAGO, total=v.peca.preco,
        expira_em=timezone.now() + timezone.timedelta(minutes=30),
    )
    ItemPedido.objects.create(pedido=pedido, variacao=v, quantidade=1, preco_unit=v.peca.preco)
    with pytest.raises(ProtectedError):
        v.delete()


# --------------------------------------------------------------------------
# Expiração não toca pedido pago
# --------------------------------------------------------------------------
def test_expirar_nao_mexe_em_pago(peca_ativa, cliente):
    from django.core.management import call_command

    v = _var_p(peca_ativa)
    pago = Pedido.objects.create(
        cliente=cliente, nome=cliente.nome, contato="x",
        status=Pedido.Status.PAGO, total=v.peca.preco,
        expira_em=timezone.now() - timezone.timedelta(minutes=5),  # vencido, mas PAGO
    )
    call_command("expirar_pedidos")
    pago.refresh_from_db()
    assert pago.status == Pedido.Status.PAGO
