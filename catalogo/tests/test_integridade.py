"""Auditoria de integridade — preenche lacunas não cobertas por outros testes.

Foco: unicidade (variação/cor), edição sem corromper, promoção por escopo +
vigência + sobreposição, consistência preço exibido × checkout, IDOR e
separação de audiência (RBAC).
"""

from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from django.utils import timezone

from catalogo import pagamentos
from catalogo.models import Cliente, Cor, Pedido, Promocao, Variacao

User = get_user_model()
pytestmark = pytest.mark.django_db


def _promo_auto(**kw):
    base = dict(
        nome="Auto",
        tipo_aplicacao=Promocao.TipoAplicacao.AUTOMATICA,
        tipo_desconto=Promocao.TipoDesconto.PERCENTUAL,
        valor=Decimal("10"),
        escopo=Promocao.Escopo.TUDO,
        ativo=True,
    )
    base.update(kw)
    return Promocao.objects.create(**base)


@pytest.fixture
def cliente2(db):
    u = User.objects.create_user(
        username="bia@cliente.com", email="bia@cliente.com",
        password="senha-cliente-456", first_name="Bia",
    )
    return Cliente.objects.create(usuario=u, nome="Bia Cliente", cpf="39053344705", telefone="")


# --------------------------------------------------------------------------
# Unicidade / sem duplicatas
# --------------------------------------------------------------------------
def test_variacao_duplicada_barrada_sem_500(api, admin_user, peca_ativa):
    """Mesma (peça, tamanho, cor) não pode duplicar — e o erro é 400 amigável."""
    api.force_authenticate(admin_user)
    # peca_ativa já tem P/Azul (fixture). Tenta criar de novo.
    resp = api.post(
        reverse("variacao-list"),
        {"peca": peca_ativa.id, "tamanho": "P", "cor": "Azul", "estoque": 5},
        format="json",
    )
    assert resp.status_code == 400, f"esperava 400, veio {resp.status_code}: {resp.data}"
    assert Variacao.objects.filter(peca=peca_ativa, tamanho="P", cor="Azul").count() == 1
    # Mensagem amigável em PT-BR (não o texto técnico padrão do DRF).
    texto = str(resp.data)
    assert "variação" in texto and "set único" not in texto


def test_variacao_mesma_combinacao_outra_peca_ok(api, admin_user, peca_ativa, categoria):
    from catalogo.models import Peca

    outra = Peca.objects.create(
        nome="Outra Peça", preco=Decimal("50.00"), categoria=categoria, tipo=Peca.Tipo.PRONTA
    )
    api.force_authenticate(admin_user)
    resp = api.post(
        reverse("variacao-list"),
        {"peca": outra.id, "tamanho": "P", "cor": "Azul", "estoque": 1},
        format="json",
    )
    assert resp.status_code == 201


def test_cor_nome_duplicada_barrada(api, admin_user):
    Cor.objects.create(nome="Azul Royal", hex="#0000AA")
    api.force_authenticate(admin_user)
    resp = api.post(
        reverse("cor-list"), {"nome": "Azul Royal", "hex": "#0000BB"}, format="json"
    )
    assert resp.status_code == 400
    assert "nome" in resp.data


def test_editar_variacao_mantendo_combinacao_funciona(api, admin_user, peca_ativa):
    """Editar a própria variação (só o estoque) não dispara falso 'duplicado'."""
    api.force_authenticate(admin_user)
    v = peca_ativa.variacoes.get(tamanho="P")
    resp = api.patch(reverse("variacao-detail", args=[v.id]), {"estoque": 9}, format="json")
    assert resp.status_code == 200
    v.refresh_from_db()
    assert v.estoque == 9


# --------------------------------------------------------------------------
# Promoções — escopo, vigência, sobreposição
# --------------------------------------------------------------------------
def test_promo_automatica_vencida_some(api, peca_ativa):
    _promo_auto(valor=Decimal("10"), fim=timezone.now() - timezone.timedelta(days=1))
    resp = api.get(reverse("peca-detail", args=[peca_ativa.id]))
    assert resp.data["em_promocao"] is False
    assert resp.data["preco_promocional"] == "199.90"


def test_promo_automatica_futura_nao_aplica(api, peca_ativa):
    _promo_auto(valor=Decimal("10"), inicio=timezone.now() + timezone.timedelta(days=1))
    resp = api.get(reverse("peca-detail", args=[peca_ativa.id]))
    assert resp.data["em_promocao"] is False


def test_promo_automatica_inativa_nao_aplica(api, peca_ativa):
    _promo_auto(valor=Decimal("10"), ativo=False)
    resp = api.get(reverse("peca-detail", args=[peca_ativa.id]))
    assert resp.data["em_promocao"] is False


def test_promos_sobrepostas_vale_o_maior(api, peca_ativa):
    _promo_auto(valor=Decimal("10"))
    _promo_auto(nome="Auto25", valor=Decimal("25"))
    resp = api.get(reverse("peca-detail", args=[peca_ativa.id]))
    # 199.90 − 25% (49.98) = 149.92 (não soma os dois descontos).
    assert resp.data["em_promocao"] is True
    assert resp.data["preco_promocional"] == "149.92"


def test_preco_exibido_igual_ao_checkout(api, monkeypatch, peca_ativa, cliente):
    """O preço promocional da vitrine == preço aplicado no checkout (mesmo motor)."""
    _promo_auto(valor=Decimal("10"))
    monkeypatch.setattr(
        pagamentos, "criar_preferencia",
        lambda *a, **k: {"id": "P", "init_point": "x"},
    )
    detalhe = api.get(reverse("peca-detail", args=[peca_ativa.id]))
    preco_vitrine = Decimal(detalhe.data["preco_promocional"])  # 179.91

    api.force_authenticate(cliente.usuario)
    v = peca_ativa.variacoes.get(tamanho="P")
    resp = api.post(
        reverse("checkout"), {"itens": [{"variacao_id": v.id, "quantidade": 1}]}, format="json"
    )
    pedido = Pedido.objects.get(pk=resp.data["pedido_id"])
    assert pedido.total == preco_vitrine == Decimal("179.91")


# --------------------------------------------------------------------------
# IDOR — cliente só vê os próprios pedidos
# --------------------------------------------------------------------------
def test_cliente_nao_acessa_pedido_de_outro(api, peca_ativa, cliente, cliente2):
    v = peca_ativa.variacoes.get(tamanho="P")
    pedido_de_bia = Pedido.objects.create(
        cliente=cliente2, nome=cliente2.nome, contato="x",
        status=Pedido.Status.PAGO, total=v.peca.preco,
        expira_em=timezone.now() + timezone.timedelta(minutes=30),
    )
    api.force_authenticate(cliente.usuario)  # Ana tenta ver o pedido da Bia
    resp = api.get(reverse("conta-pedido-detail", args=[pedido_de_bia.id]))
    assert resp.status_code == 404  # não vaza pedido de outro cliente


# --------------------------------------------------------------------------
# Separação de audiência (RBAC) — cliente não escreve no catálogo do admin
# --------------------------------------------------------------------------
def test_cliente_nao_escreve_catalogo(api, categoria, cliente):
    api.force_authenticate(cliente.usuario)
    resp = api.post(
        reverse("peca-list"),
        {"nome": "Hack", "preco": "10.00", "categoria": categoria.id, "tipo": "pronta"},
        format="json",
    )
    assert resp.status_code == 403  # tem login, mas não é staff


def test_cliente_nao_acessa_vendas(api, cliente):
    api.force_authenticate(cliente.usuario)
    assert api.get(reverse("pedido-list")).status_code == 403
