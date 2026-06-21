"""Testes de exclusão em cascata e unicidade do nome da peça."""

from decimal import Decimal

import pytest
from django.urls import reverse

from catalogo.models import Categoria, Imagem, Peca, Variacao

pytestmark = pytest.mark.django_db


def test_excluir_categoria_remove_pecas_em_cascata(api, admin_user, categoria):
    """Excluir categoria apaga as peças (e variações/imagens) dela."""
    peca = Peca.objects.create(
        nome="Vestido em Cascata",
        preco=Decimal("100.00"),
        categoria=categoria,
    )
    var = Variacao.objects.create(peca=peca, tamanho="P", cor="Azul", estoque=1)

    api.force_authenticate(user=admin_user)
    url = reverse("categoria-detail", args=[categoria.id])
    resp = api.delete(url)

    assert resp.status_code == 204
    assert not Categoria.objects.filter(id=categoria.id).exists()
    assert not Peca.objects.filter(id=peca.id).exists()
    assert not Variacao.objects.filter(id=var.id).exists()


def test_excluir_peca_remove_variacoes_e_imagens(api, admin_user, peca_ativa):
    Imagem.objects.create(peca=peca_ativa, arquivo="pecas/x.jpg", principal=True)
    ids_variacoes = list(peca_ativa.variacoes.values_list("id", flat=True))

    api.force_authenticate(user=admin_user)
    url = reverse("peca-detail", args=[peca_ativa.id])
    resp = api.delete(url)

    assert resp.status_code == 204
    assert not Peca.objects.filter(id=peca_ativa.id).exists()
    assert not Variacao.objects.filter(id__in=ids_variacoes).exists()
    assert not Imagem.objects.filter(peca_id=peca_ativa.id).exists()


def test_excluir_variacao_remove_apenas_ela(api, admin_user, peca_ativa):
    var = peca_ativa.variacoes.first()

    api.force_authenticate(user=admin_user)
    url = reverse("variacao-detail", args=[var.id])
    resp = api.delete(url)

    assert resp.status_code == 204
    assert not Variacao.objects.filter(id=var.id).exists()
    # A peça e as outras variações continuam.
    assert Peca.objects.filter(id=peca_ativa.id).exists()
    assert peca_ativa.variacoes.exists()


def test_criar_peca_com_nome_repetido_falha(api, admin_user, peca_ativa, categoria):
    api.force_authenticate(user=admin_user)
    url = reverse("peca-list")
    resp = api.post(
        url,
        {
            "nome": peca_ativa.nome,  # já existe
            "preco": "50.00",
            "categoria": categoria.id,
        },
        format="json",
    )

    assert resp.status_code == 400
    assert "nome" in resp.data
    assert "Já existe uma peça com esse nome." in str(resp.data["nome"])


def test_editar_peca_mantendo_proprio_nome_funciona(api, admin_user, peca_ativa):
    """Editar a peça sem trocar o nome não dispara o erro de unicidade."""
    api.force_authenticate(user=admin_user)
    url = reverse("peca-detail", args=[peca_ativa.id])
    resp = api.patch(url, {"nome": peca_ativa.nome, "preco": "150.00"}, format="json")

    assert resp.status_code == 200, resp.data
    assert resp.data["preco"] == "150.00"


def test_editar_peca_para_nome_de_outra_falha(api, admin_user, peca_ativa, categoria):
    outra = Peca.objects.create(
        nome="Outra Peça",
        preco=Decimal("80.00"),
        categoria=categoria,
    )
    api.force_authenticate(user=admin_user)
    url = reverse("peca-detail", args=[outra.id])
    resp = api.patch(url, {"nome": peca_ativa.nome}, format="json")

    assert resp.status_code == 400
    assert "nome" in resp.data
