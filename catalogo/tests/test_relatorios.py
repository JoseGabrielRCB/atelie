"""Testes dos relatórios financeiros (agregações no servidor + exportação).

Cobre: gate financeiro, vendas por período (dia/mês + totais), produtos mais
vendidos (ranking), resumo do mês (faturamento/ticket/desconto/cupons),
exportação CSV/PDF e o recorte por status=pago + intervalo de datas.
"""

from datetime import datetime
from decimal import Decimal
from zoneinfo import ZoneInfo

import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from django.utils import timezone

from catalogo.models import ItemPedido, Pedido, Perfil, Promocao

User = get_user_model()
pytestmark = pytest.mark.django_db

TZ = ZoneInfo("America/Recife")


def _quando(ano, mes, dia, hora=12):
    return datetime(ano, mes, dia, hora, 0, tzinfo=TZ)


def _pedido_pago(cliente, peca, *, quando, qtd=1, desconto="0.00", cupom=None,
                 status=Pedido.Status.PAGO):
    """Cria um pedido (pago por padrão) com 1 item, na data ``quando``."""
    v = peca.variacoes.get(tamanho="P")
    preco = v.peca.preco
    total = (preco * qtd) - Decimal(desconto)
    pedido = Pedido.objects.create(
        cliente=cliente,
        nome=cliente.nome,
        contato="x",
        status=status,
        total=total,
        desconto=Decimal(desconto),
        cupom=cupom,
        expira_em=quando + timezone.timedelta(minutes=30),
    )
    ItemPedido.objects.create(pedido=pedido, variacao=v, quantidade=qtd, preco_unit=preco)
    # criado_em é auto_now_add (ignora valor no create): força via update.
    Pedido.objects.filter(pk=pedido.pk).update(criado_em=quando)
    pedido.refresh_from_db()
    return pedido


@pytest.fixture
def funcionario_sem_fin(db):
    u = User.objects.create_user(username="func", password="senha-func-123")
    Perfil.objects.create(usuario=u, papel=Perfil.Papel.FUNCIONARIO, ativo=True)
    return u


# --------------------------------------------------------------------------
# Gate financeiro
# --------------------------------------------------------------------------
ROTAS = [
    "relatorio-vendas-periodo",
    "relatorio-produtos-vendidos",
    "relatorio-resumo-mes",
]


@pytest.mark.parametrize("rota", ROTAS)
def test_relatorio_exige_financeiro(api, funcionario_sem_fin, rota):
    api.force_authenticate(funcionario_sem_fin)
    assert api.get(reverse(rota)).status_code == 403


@pytest.mark.parametrize("rota", ROTAS)
def test_relatorio_anonimo_negado(api, rota):
    assert api.get(reverse(rota)).status_code in (401, 403)


@pytest.mark.parametrize("rota", ROTAS)
def test_dono_acessa_relatorio(api, admin_user, rota):
    api.force_authenticate(admin_user)
    assert api.get(reverse(rota)).status_code == 200


# --------------------------------------------------------------------------
# Vendas por período
# --------------------------------------------------------------------------
def test_vendas_por_periodo_dia(api, admin_user, peca_ativa, cliente):
    _pedido_pago(cliente, peca_ativa, quando=_quando(2026, 6, 10), qtd=1)  # 199.90
    _pedido_pago(cliente, peca_ativa, quando=_quando(2026, 6, 10), qtd=2)  # 399.80
    _pedido_pago(cliente, peca_ativa, quando=_quando(2026, 6, 11), qtd=1)  # 199.90
    # Pedido NÃO pago não entra.
    _pedido_pago(
        cliente, peca_ativa, quando=_quando(2026, 6, 10),
        status=Pedido.Status.AGUARDANDO_PAGAMENTO,
    )

    api.force_authenticate(admin_user)
    resp = api.get(
        reverse("relatorio-vendas-periodo"),
        {"de": "2026-06-01", "ate": "2026-06-30", "granularidade": "dia"},
    )
    assert resp.status_code == 200
    assert resp.data["totais"]["pedidos"] == 3
    assert resp.data["totais"]["faturamento"] == "799.60"
    assert resp.data["totais"]["ticket_medio"] == "266.53"
    # Duas datas distintas no período.
    series = resp.data["series"]
    assert len(series) == 2
    dia10 = next(s for s in series if s["data"] == "2026-06-10")
    assert dia10["pedidos"] == 2
    assert dia10["faturamento"] == "599.70"


def test_vendas_por_periodo_mes(api, admin_user, peca_ativa, cliente):
    _pedido_pago(cliente, peca_ativa, quando=_quando(2026, 6, 10), qtd=1)
    _pedido_pago(cliente, peca_ativa, quando=_quando(2026, 6, 20), qtd=1)
    api.force_authenticate(admin_user)
    resp = api.get(
        reverse("relatorio-vendas-periodo"),
        {"de": "2026-06-01", "ate": "2026-06-30", "granularidade": "mes"},
    )
    assert resp.status_code == 200
    assert len(resp.data["series"]) == 1
    assert resp.data["series"][0]["periodo"] == "06/2026"
    assert resp.data["series"][0]["pedidos"] == 2


def test_vendas_periodo_data_invalida(api, admin_user):
    api.force_authenticate(admin_user)
    resp = api.get(reverse("relatorio-vendas-periodo"), {"de": "10-06-2026"})
    assert resp.status_code == 400


def test_vendas_periodo_inicio_depois_do_fim(api, admin_user):
    api.force_authenticate(admin_user)
    resp = api.get(
        reverse("relatorio-vendas-periodo"),
        {"de": "2026-06-30", "ate": "2026-06-01"},
    )
    assert resp.status_code == 400


# --------------------------------------------------------------------------
# Produtos mais vendidos
# --------------------------------------------------------------------------
def test_produtos_mais_vendidos(api, admin_user, peca_ativa, cliente):
    _pedido_pago(cliente, peca_ativa, quando=_quando(2026, 6, 10), qtd=1)
    _pedido_pago(cliente, peca_ativa, quando=_quando(2026, 6, 11), qtd=2)
    api.force_authenticate(admin_user)
    resp = api.get(
        reverse("relatorio-produtos-vendidos"),
        {"de": "2026-06-01", "ate": "2026-06-30"},
    )
    assert resp.status_code == 200
    itens = resp.data["itens"]
    assert len(itens) == 1
    assert itens[0]["quantidade"] == 3
    assert itens[0]["receita"] == "599.70"  # 3 × 199.90
    assert itens[0]["peca_nome"] == "Vestido Floral"


# --------------------------------------------------------------------------
# Resumo do mês (com análise de cupons)
# --------------------------------------------------------------------------
def test_resumo_do_mes_com_cupom(api, admin_user, peca_ativa, cliente):
    cupom = Promocao.objects.create(
        nome="Cupom Junho",
        tipo_aplicacao=Promocao.TipoAplicacao.CUPOM,
        codigo="JUNHO",
        tipo_desconto=Promocao.TipoDesconto.VALOR,
        valor=Decimal("20.00"),
        escopo=Promocao.Escopo.TUDO,
    )
    _pedido_pago(
        cliente, peca_ativa, quando=_quando(2026, 6, 15),
        qtd=1, desconto="20.00", cupom=cupom,
    )  # total 179.90
    _pedido_pago(cliente, peca_ativa, quando=_quando(2026, 6, 16), qtd=1)  # 199.90, sem cupom

    api.force_authenticate(admin_user)
    resp = api.get(reverse("relatorio-resumo-mes"), {"mes": "2026-06"})
    assert resp.status_code == 200
    d = resp.data
    assert d["num_vendas"] == 2
    assert d["faturamento"] == "379.80"  # 179.90 + 199.90
    assert d["desconto_concedido"] == "20.00"
    assert d["ticket_medio"] == "189.90"
    assert len(d["cupons"]) == 1
    assert d["cupons"][0]["codigo"] == "JUNHO"
    assert d["cupons"][0]["usos"] == 1
    assert d["cupons"][0]["valor_descontado"] == "20.00"


def test_resumo_do_mes_isola_outro_mes(api, admin_user, peca_ativa, cliente):
    _pedido_pago(cliente, peca_ativa, quando=_quando(2026, 5, 10), qtd=1)  # maio
    api.force_authenticate(admin_user)
    resp = api.get(reverse("relatorio-resumo-mes"), {"mes": "2026-06"})
    assert resp.data["num_vendas"] == 0
    assert resp.data["faturamento"] == "0.00"


# --------------------------------------------------------------------------
# Exportação CSV / PDF
# --------------------------------------------------------------------------
def test_exporta_csv(api, admin_user, peca_ativa, cliente):
    _pedido_pago(cliente, peca_ativa, quando=_quando(2026, 6, 10), qtd=1)
    api.force_authenticate(admin_user)
    resp = api.get(
        reverse("relatorio-vendas-periodo"),
        {"de": "2026-06-01", "ate": "2026-06-30", "formato": "csv"},
    )
    assert resp.status_code == 200
    assert resp["Content-Type"].startswith("text/csv")
    assert "attachment" in resp["Content-Disposition"]
    assert ".csv" in resp["Content-Disposition"]


def test_exporta_pdf(api, admin_user, peca_ativa, cliente):
    _pedido_pago(cliente, peca_ativa, quando=_quando(2026, 6, 10), qtd=1)
    api.force_authenticate(admin_user)
    resp = api.get(
        reverse("relatorio-resumo-mes"),
        {"mes": "2026-06", "formato": "pdf"},
    )
    assert resp.status_code == 200
    assert resp["Content-Type"] == "application/pdf"
    assert resp.content[:4] == b"%PDF"
