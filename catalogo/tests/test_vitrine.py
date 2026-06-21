"""Testes da vitrine pública."""

import pytest
from django.urls import reverse

pytestmark = pytest.mark.django_db


def test_vitrine_retorna_apenas_pecas_ativas(api, peca_ativa, peca_inativa):
    url = reverse("peca-list")
    resp = api.get(url)

    assert resp.status_code == 200
    nomes = [p["nome"] for p in resp.data["results"]]
    assert peca_ativa.nome in nomes
    assert peca_inativa.nome not in nomes


def test_pecas_trazem_variacoes_e_imagens_aninhadas(api, peca_ativa):
    url = reverse("peca-detail", args=[peca_ativa.id])
    resp = api.get(url)

    assert resp.status_code == 200
    assert "variacoes" in resp.data
    assert "imagens" in resp.data
    assert len(resp.data["variacoes"]) == 2


def test_filtro_por_categoria(api, peca_ativa, categoria):
    url = reverse("peca-list")
    resp = api.get(url, {"categoria": categoria.id})

    assert resp.status_code == 200
    assert resp.data["count"] == 1


def test_busca_por_nome(api, peca_ativa):
    url = reverse("peca-list")
    resp = api.get(url, {"search": "Floral"})

    assert resp.status_code == 200
    assert resp.data["count"] == 1

    resp_vazia = api.get(url, {"search": "inexistente"})
    assert resp_vazia.data["count"] == 0


def test_lista_categorias_publica(api, categoria):
    url = reverse("categoria-list")
    resp = api.get(url)

    assert resp.status_code == 200
    assert resp.data["count"] == 1
