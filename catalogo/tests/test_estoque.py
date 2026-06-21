"""Testes das regras de estoque/esgotado."""

import pytest
from django.urls import reverse

from catalogo.models import Variacao

pytestmark = pytest.mark.django_db


def test_variacao_sem_estoque_vem_marcada_como_esgotada(api, peca_ativa):
    url = reverse("peca-detail", args=[peca_ativa.id])
    resp = api.get(url)

    por_tamanho = {v["tamanho"]: v for v in resp.data["variacoes"]}
    assert por_tamanho["M"]["estoque"] == 0
    assert por_tamanho["M"]["esgotado"] is True
    assert por_tamanho["P"]["esgotado"] is False


def test_propriedade_esgotado_no_model(peca_ativa):
    variacao = Variacao.objects.get(peca=peca_ativa, tamanho="M")
    assert variacao.esgotado is True


def test_estoque_negativo_rejeitado_pelo_serializer(api, admin_user, peca_ativa):
    api.force_authenticate(user=admin_user)
    url = reverse("variacao-list")
    resp = api.post(
        url,
        {"peca": peca_ativa.id, "tamanho": "G", "cor": "Verde", "estoque": -5},
        format="json",
    )

    assert resp.status_code == 400
    assert "estoque" in resp.data
    assert "negativo" in str(resp.data["estoque"]).lower()


def test_variacao_aceita_tamanho_livre(api, admin_user, peca_ativa):
    """Tamanhos fora dos choices sugeridos (ex.: numéricos) são aceitos."""
    api.force_authenticate(user=admin_user)
    url = reverse("variacao-list")
    resp = api.post(
        url,
        {"peca": peca_ativa.id, "tamanho": "12", "cor": "Vermelho", "estoque": 4},
        format="json",
    )

    assert resp.status_code == 201, resp.data
    assert resp.data["tamanho"] == "12"
    assert Variacao.objects.filter(peca=peca_ativa, tamanho="12").exists()
