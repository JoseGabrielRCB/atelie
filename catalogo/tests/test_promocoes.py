"""Testes de promoções e cupons (motor de desconto no servidor).

Cobre: promoção automática no preço de exibição, validação de cupom (período,
limite, escopo, ativo), tipos de desconto (% e R$), acúmulo (soma × maior),
checkout aplicando o desconto, contagem de uso no webhook, gate financeiro e
total nunca negativo.
"""

from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from django.utils import timezone

from catalogo import pagamentos
from catalogo.models import Pedido, Perfil, Promocao
from catalogo.views import WebhookMercadoPagoView

User = get_user_model()
pytestmark = pytest.mark.django_db


def _promo(**kw):
    base = dict(
        nome="Promo",
        tipo_aplicacao=Promocao.TipoAplicacao.AUTOMATICA,
        codigo="",
        tipo_desconto=Promocao.TipoDesconto.PERCENTUAL,
        valor=Decimal("10"),
        escopo=Promocao.Escopo.TUDO,
        ativo=True,
    )
    base.update(kw)
    return Promocao.objects.create(**base)


def _cupom(codigo="DEZ", **kw):
    return _promo(
        nome=f"Cupom {codigo}",
        tipo_aplicacao=Promocao.TipoAplicacao.CUPOM,
        codigo=codigo,
        **kw,
    )


def _var_p(peca):
    return peca.variacoes.get(tamanho="P")  # estoque 3 no fixture


def _itens(peca, qtd=1):
    return [{"variacao_id": _var_p(peca).id, "quantidade": qtd}]


def _mock_pref(monkeypatch):
    monkeypatch.setattr(
        pagamentos,
        "criar_preferencia",
        lambda *a, **k: {"id": "PREF-1", "init_point": "https://mp/x"},
    )


@pytest.fixture
def funcionario_sem_fin(db):
    u = User.objects.create_user(username="func", password="senha-func-123")
    Perfil.objects.create(usuario=u, papel=Perfil.Papel.FUNCIONARIO, ativo=True)
    return u


# --------------------------------------------------------------------------
# Promoção automática no preço de exibição (vitrine/detalhe)
# --------------------------------------------------------------------------


def test_peca_expoe_preco_promocional(api, peca_ativa):
    _promo(valor=Decimal("10"))  # 10% em tudo
    resp = api.get(reverse("peca-detail", args=[peca_ativa.id]))
    assert resp.status_code == 200
    assert resp.data["em_promocao"] is True
    # 199.90 - 10% = 179.91
    assert resp.data["preco_promocional"] == "179.91"


def test_peca_sem_promocao(api, peca_ativa):
    resp = api.get(reverse("peca-detail", args=[peca_ativa.id]))
    assert resp.data["em_promocao"] is False
    assert resp.data["preco_promocional"] == "199.90"


def test_promocao_automatica_respeita_escopo(api, peca_ativa, categoria):
    # Promo só para OUTRA categoria não afeta a peça.
    from catalogo.models import Categoria

    outra = Categoria.objects.create(nome="Acessórios")
    promo = _promo(escopo=Promocao.Escopo.CATEGORIA, valor=Decimal("50"))
    promo.categorias.add(outra)
    resp = api.get(reverse("peca-detail", args=[peca_ativa.id]))
    assert resp.data["em_promocao"] is False


# --------------------------------------------------------------------------
# Validação de cupom
# --------------------------------------------------------------------------


def test_cupom_valido(api, peca_ativa):
    _cupom("DEZ", valor=Decimal("10"))
    resp = api.post(
        reverse("cupom-validar"),
        {"codigo": "dez", "itens": _itens(peca_ativa, 1)},
        format="json",
    )
    assert resp.status_code == 200
    assert resp.data["valido"] is True
    assert resp.data["desconto"] == "19.99"  # 10% de 199.90
    assert resp.data["total"] == "179.91"


def test_cupom_inexistente(api, peca_ativa):
    resp = api.post(
        reverse("cupom-validar"),
        {"codigo": "NAOEXISTE", "itens": _itens(peca_ativa)},
        format="json",
    )
    assert resp.data["valido"] is False
    assert "inválido" in resp.data["mensagem"].lower()


def test_cupom_expirado(api, peca_ativa):
    _cupom("VELHO", fim=timezone.now() - timezone.timedelta(days=1))
    resp = api.post(
        reverse("cupom-validar"),
        {"codigo": "VELHO", "itens": _itens(peca_ativa)},
        format="json",
    )
    assert resp.data["valido"] is False
    assert "expirou" in resp.data["mensagem"].lower()


def test_cupom_nao_iniciado(api, peca_ativa):
    _cupom("FUTURO", inicio=timezone.now() + timezone.timedelta(days=1))
    resp = api.post(
        reverse("cupom-validar"),
        {"codigo": "FUTURO", "itens": _itens(peca_ativa)},
        format="json",
    )
    assert resp.data["valido"] is False


def test_cupom_esgotado(api, peca_ativa):
    _cupom("UMUSO", limite_uso=1, usos=1)
    resp = api.post(
        reverse("cupom-validar"),
        {"codigo": "UMUSO", "itens": _itens(peca_ativa)},
        format="json",
    )
    assert resp.data["valido"] is False
    assert "esgot" in resp.data["mensagem"].lower()


def test_cupom_inativo(api, peca_ativa):
    _cupom("OFF", ativo=False)
    resp = api.post(
        reverse("cupom-validar"),
        {"codigo": "OFF", "itens": _itens(peca_ativa)},
        format="json",
    )
    assert resp.data["valido"] is False


def test_cupom_escopo_nao_casa(api, peca_ativa):
    from catalogo.models import Categoria

    outra = Categoria.objects.create(nome="Outra")
    cupom = _cupom("SOOUTRA", escopo=Promocao.Escopo.CATEGORIA)
    cupom.categorias.add(outra)
    resp = api.post(
        reverse("cupom-validar"),
        {"codigo": "SOOUTRA", "itens": _itens(peca_ativa)},
        format="json",
    )
    assert resp.data["valido"] is False
    assert "não vale" in resp.data["mensagem"].lower()


def test_cupom_valor_fixo(api, peca_ativa):
    _cupom("MENOS50", tipo_desconto=Promocao.TipoDesconto.VALOR, valor=Decimal("50.00"))
    resp = api.post(
        reverse("cupom-validar"),
        {"codigo": "MENOS50", "itens": _itens(peca_ativa, 1)},
        format="json",
    )
    assert resp.data["valido"] is True
    assert resp.data["desconto"] == "50.00"
    assert resp.data["total"] == "149.90"


# --------------------------------------------------------------------------
# Acúmulo (soma × maior) — testado pelo motor
# --------------------------------------------------------------------------


def _itens_calc(peca, qtd=1):
    return [{"peca": peca, "quantidade": qtd, "preco": peca.preco}]


def test_acumulo_soma(peca_ativa):
    from catalogo import promocoes as motor

    _promo(valor=Decimal("10"))  # automática 10%
    cupom = _cupom("MAIS10", valor=Decimal("10"), acumulavel=True)
    r = motor.calcular(_itens_calc(peca_ativa), cupom=cupom)
    # auto: 19.99; cupom 10% sobre 179.91 = 17.99 → 37.98
    assert r["desconto_auto"] == Decimal("19.99")
    assert r["desconto_cupom"] == Decimal("17.99")
    assert r["desconto"] == Decimal("37.98")


def test_acumulo_maior_nao_soma(peca_ativa):
    from catalogo import promocoes as motor

    _promo(valor=Decimal("10"))  # automática 10% = 19.99
    cupom = _cupom("CINCO", tipo_desconto=Promocao.TipoDesconto.VALOR, valor=Decimal("5.00"), acumulavel=False)
    r = motor.calcular(_itens_calc(peca_ativa), cupom=cupom)
    # não soma → vale o maior (auto 19.99 > cupom 5.00)
    assert r["desconto"] == Decimal("19.99")


def test_total_nunca_negativo(peca_ativa):
    from catalogo import promocoes as motor

    cupom = _cupom("TUDO", tipo_desconto=Promocao.TipoDesconto.VALOR, valor=Decimal("99999.00"))
    r = motor.calcular(_itens_calc(peca_ativa), cupom=cupom)
    assert r["total"] == Decimal("0.00")
    assert r["desconto"] == Decimal("199.90")


# --------------------------------------------------------------------------
# Checkout aplica o desconto e grava cupom/desconto
# --------------------------------------------------------------------------


def test_checkout_aplica_cupom(api, monkeypatch, peca_ativa, cliente):
    _mock_pref(monkeypatch)
    _cupom("DEZ", valor=Decimal("10"))
    api.force_authenticate(cliente.usuario)
    resp = api.post(
        reverse("checkout"),
        {"cupom": "DEZ", "itens": _itens(peca_ativa, 1)},
        format="json",
    )
    assert resp.status_code == 201, resp.data
    pedido = Pedido.objects.get(pk=resp.data["pedido_id"])
    assert pedido.desconto == Decimal("19.99")
    assert pedido.total == Decimal("179.91")
    assert pedido.cupom is not None and pedido.cupom.codigo == "DEZ"


def test_checkout_promocao_automatica_sem_cupom(api, monkeypatch, peca_ativa, cliente):
    _mock_pref(monkeypatch)
    _promo(valor=Decimal("10"))
    api.force_authenticate(cliente.usuario)
    resp = api.post(reverse("checkout"), {"itens": _itens(peca_ativa, 1)}, format="json")
    assert resp.status_code == 201
    pedido = Pedido.objects.get(pk=resp.data["pedido_id"])
    assert pedido.total == Decimal("179.91")
    assert pedido.desconto == Decimal("19.99")
    assert pedido.cupom is None


# --------------------------------------------------------------------------
# Webhook conta o uso do cupom só quando pago
# --------------------------------------------------------------------------


def test_webhook_incrementa_usos_do_cupom(peca_ativa, cliente):
    cupom = _cupom("USA1")
    v = _var_p(peca_ativa)
    pedido = Pedido.objects.create(
        cliente=cliente,
        nome=cliente.nome,
        contato="x",
        status=Pedido.Status.AGUARDANDO_PAGAMENTO,
        total=Decimal("179.91"),
        desconto=Decimal("19.99"),
        cupom=cupom,
        expira_em=timezone.now() + timezone.timedelta(minutes=30),
    )
    from catalogo.models import ItemPedido

    ItemPedido.objects.create(pedido=pedido, variacao=v, quantidade=1, preco_unit=v.peca.preco)

    WebhookMercadoPagoView()._confirmar_pedido(str(pedido.id), "evt-1")

    pedido.refresh_from_db()
    cupom.refresh_from_db()
    assert pedido.status == Pedido.Status.PAGO
    assert cupom.usos == 1


# --------------------------------------------------------------------------
# Gate financeiro nas promoções (admin)
# --------------------------------------------------------------------------


def test_promocoes_exige_financeiro(api, funcionario_sem_fin):
    api.force_authenticate(funcionario_sem_fin)
    assert api.get(reverse("promocao-list")).status_code == 403


def test_dono_gerencia_promocoes(api, admin_user, categoria):
    api.force_authenticate(admin_user)
    assert api.get(reverse("promocao-list")).status_code == 200
    resp = api.post(
        reverse("promocao-list"),
        {
            "nome": "Cupom de boas-vindas",
            "tipo_aplicacao": "cupom",
            "codigo": "bemvindo",
            "tipo_desconto": "percentual",
            "valor": "15.00",
            "escopo": "tudo",
            "acumulavel": False,
            "ativo": True,
        },
        format="json",
    )
    assert resp.status_code == 201, resp.data
    assert resp.data["codigo"] == "BEMVINDO"  # normalizado p/ maiúsculas


def test_promocao_escopo_varias_pecas(api, admin_user, peca_ativa, categoria):
    from catalogo.models import Peca

    outra = Peca.objects.create(
        nome="Saia Teste", preco=Decimal("80.00"), categoria=categoria, tipo=Peca.Tipo.PRONTA
    )
    api.force_authenticate(admin_user)
    resp = api.post(
        reverse("promocao-list"),
        {
            "nome": "Combo",
            "tipo_aplicacao": "automatica",
            "tipo_desconto": "percentual",
            "valor": "10.00",
            "escopo": "peca",
            "pecas": [peca_ativa.id, outra.id],
            "ativo": True,
        },
        format="json",
    )
    assert resp.status_code == 201, resp.data
    assert set(resp.data["pecas"]) == {peca_ativa.id, outra.id}


def test_valor_maior_que_preco_da_peca_aceito(api, admin_user, peca_ativa):
    # Sem limitador: o desconto pode ser maior que o preço da peça (o motor
    # garante total >= 0 na hora de aplicar — ver test_total_nunca_negativo).
    api.force_authenticate(admin_user)
    resp = api.post(
        reverse("promocao-list"),
        {
            "nome": "Desconto grande",
            "tipo_aplicacao": "cupom",
            "codigo": "GRANDE",
            "tipo_desconto": "valor",
            "valor": "500.00",  # peça custa 199.90
            "escopo": "peca",
            "pecas": [peca_ativa.id],
        },
        format="json",
    )
    assert resp.status_code == 201, resp.data


def test_fim_antes_do_inicio_recusado(api, admin_user):
    api.force_authenticate(admin_user)
    resp = api.post(
        reverse("promocao-list"),
        {
            "nome": "Período inválido",
            "tipo_aplicacao": "automatica",
            "tipo_desconto": "percentual",
            "valor": "10.00",
            "escopo": "tudo",
            "inicio": "2026-07-10T10:00",
            "fim": "2026-07-10T09:00",
        },
        format="json",
    )
    assert resp.status_code == 400
    assert "fim" in resp.data


def test_cupom_codigo_duplicado(api, admin_user):
    _cupom("REPETIDO")
    api.force_authenticate(admin_user)
    resp = api.post(
        reverse("promocao-list"),
        {
            "nome": "Outro",
            "tipo_aplicacao": "cupom",
            "codigo": "repetido",
            "tipo_desconto": "percentual",
            "valor": "10.00",
            "escopo": "tudo",
        },
        format="json",
    )
    assert resp.status_code == 400
    assert "codigo" in resp.data
