"""Testes do código de rastreio dos Correios (admin grava; cliente lê).

Regras: só edita rastreio em pedido PAGO; gate financeiro; o status NÃO muda; o
cliente vê o código no próprio histórico.
"""

from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from django.utils import timezone

from catalogo.models import ItemPedido, Pedido, Perfil

User = get_user_model()
pytestmark = pytest.mark.django_db


def _pedido(cliente, peca, status=Pedido.Status.PAGO):
    v = peca.variacoes.get(tamanho="P")
    pedido = Pedido.objects.create(
        cliente=cliente,
        nome=cliente.nome,
        contato="x",
        status=status,
        total=v.peca.preco,
        expira_em=timezone.now() + timezone.timedelta(minutes=30),
    )
    ItemPedido.objects.create(pedido=pedido, variacao=v, quantidade=1, preco_unit=v.peca.preco)
    return pedido


@pytest.fixture
def funcionario_sem_fin(db):
    u = User.objects.create_user(username="func", password="senha-func-123")
    Perfil.objects.create(usuario=u, papel=Perfil.Papel.FUNCIONARIO, ativo=True)
    return u


def test_admin_grava_rastreio_em_pedido_pago(api, admin_user, peca_ativa, cliente):
    pedido = _pedido(cliente, peca_ativa, status=Pedido.Status.PAGO)
    api.force_authenticate(admin_user)
    resp = api.patch(
        reverse("pedido-rastreio", args=[pedido.id]),
        {"codigo_rastreio": "AA123456785BR"},
        format="json",
    )
    assert resp.status_code == 200, resp.data
    assert resp.data["codigo_rastreio"] == "AA123456785BR"
    pedido.refresh_from_db()
    assert pedido.codigo_rastreio == "AA123456785BR"
    # O status NÃO muda.
    assert pedido.status == Pedido.Status.PAGO


def test_rastreio_recusado_em_pedido_nao_pago(api, admin_user, peca_ativa, cliente):
    pedido = _pedido(cliente, peca_ativa, status=Pedido.Status.AGUARDANDO_PAGAMENTO)
    api.force_authenticate(admin_user)
    resp = api.patch(
        reverse("pedido-rastreio", args=[pedido.id]),
        {"codigo_rastreio": "AA123456785BR"},
        format="json",
    )
    assert resp.status_code == 400
    assert "codigo_rastreio" in resp.data
    pedido.refresh_from_db()
    assert pedido.codigo_rastreio == ""


def test_rastreio_pode_ser_limpo(api, admin_user, peca_ativa, cliente):
    pedido = _pedido(cliente, peca_ativa, status=Pedido.Status.PAGO)
    pedido.codigo_rastreio = "AA123456785BR"
    pedido.save(update_fields=["codigo_rastreio"])
    api.force_authenticate(admin_user)
    resp = api.patch(
        reverse("pedido-rastreio", args=[pedido.id]),
        {"codigo_rastreio": ""},
        format="json",
    )
    assert resp.status_code == 200
    pedido.refresh_from_db()
    assert pedido.codigo_rastreio == ""


def test_rastreio_exige_financeiro(api, funcionario_sem_fin, peca_ativa, cliente):
    pedido = _pedido(cliente, peca_ativa, status=Pedido.Status.PAGO)
    api.force_authenticate(funcionario_sem_fin)
    resp = api.patch(
        reverse("pedido-rastreio", args=[pedido.id]),
        {"codigo_rastreio": "AA123456785BR"},
        format="json",
    )
    assert resp.status_code == 403


def test_cliente_ve_rastreio_no_historico(api, peca_ativa, cliente):
    pedido = _pedido(cliente, peca_ativa, status=Pedido.Status.PAGO)
    pedido.codigo_rastreio = "AA123456785BR"
    pedido.save(update_fields=["codigo_rastreio"])
    api.force_authenticate(cliente.usuario)
    resp = api.get(reverse("conta-pedido-list"))
    assert resp.status_code == 200
    item = resp.data["results"][0]
    assert item["codigo_rastreio"] == "AA123456785BR"
