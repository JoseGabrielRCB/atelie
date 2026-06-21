"""Testes das validações/limites de campos (peça, cor, categoria, encomenda)."""

from decimal import Decimal

import pytest
from django.urls import reverse

from catalogo.models import Categoria, Cor

pytestmark = pytest.mark.django_db


# --------------------------------------------------------------------------
# Peça: preço (teto) e descrição (limite)
# --------------------------------------------------------------------------


def test_preco_acima_do_teto_retorna_400(api, admin_user, categoria):
    api.force_authenticate(user=admin_user)
    url = reverse("peca-list")
    resp = api.post(
        url,
        {
            "nome": "Peça cara",
            "descricao": "x",
            "preco": "2000000.00",
            "categoria": categoria.id,
        },
        format="json",
    )

    assert resp.status_code == 400
    assert "preco" in resp.data
    assert resp.data["preco"][0] == "Preço acima do permitido."


def test_descricao_da_peca_acima_do_limite_retorna_400(api, admin_user, categoria):
    api.force_authenticate(user=admin_user)
    url = reverse("peca-list")
    resp = api.post(
        url,
        {
            "nome": "Peça com texto longo",
            "descricao": "a" * 601,
            "preco": "100.00",
            "categoria": categoria.id,
        },
        format="json",
    )

    assert resp.status_code == 400
    assert "descricao" in resp.data


# --------------------------------------------------------------------------
# Cor: hex válido/ inválido
# --------------------------------------------------------------------------


def test_criar_cor_com_hex_invalido_retorna_400(api, admin_user):
    api.force_authenticate(user=admin_user)
    url = reverse("cor-list")
    resp = api.post(url, {"nome": "Terracota", "hex": "vermelho"}, format="json")

    assert resp.status_code == 400
    assert "hex" in resp.data
    assert resp.data["hex"][0] == "Use uma cor no formato #RRGGBB."
    assert Cor.objects.count() == 0


def test_criar_cor_valida_retorna_201(api, admin_user):
    api.force_authenticate(user=admin_user)
    url = reverse("cor-list")
    resp = api.post(url, {"nome": "Terracota", "hex": "#B07A56"}, format="json")

    assert resp.status_code == 201
    assert resp.data["nome"] == "Terracota"
    assert resp.data["hex"] == "#B07A56"
    assert Cor.objects.filter(nome="Terracota", hex="#B07A56").exists()


# --------------------------------------------------------------------------
# Categoria: unicidade de nome
# --------------------------------------------------------------------------


def test_categoria_duplicada_retorna_400(api, admin_user, categoria):
    api.force_authenticate(user=admin_user)
    url = reverse("categoria-list")
    resp = api.post(url, {"nome": categoria.nome}, format="json")

    assert resp.status_code == 400
    assert "nome" in resp.data
    assert resp.data["nome"][0] == "Já existe uma categoria com esse nome."


# --------------------------------------------------------------------------
# Encomenda: descrição (limite)
# --------------------------------------------------------------------------


def test_encomenda_com_descricao_acima_do_limite_retorna_400(api):
    url = reverse("encomenda-list")
    resp = api.post(
        url,
        {
            "nome": "Maria",
            "contato": "(81) 99999-0000",
            "descricao": "a" * 601,
        },
        format="multipart",
    )

    assert resp.status_code == 400
    assert "descricao" in resp.data
