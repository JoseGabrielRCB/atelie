"""Testes de autenticação JWT e proteção de escrita."""

import pytest
from django.urls import reverse

from catalogo.models import Categoria

pytestmark = pytest.mark.django_db


def test_escrita_sem_token_retorna_401(api, categoria):
    url = reverse("peca-list")
    resp = api.post(
        url,
        {"nome": "Nova Peça", "preco": "100.00", "categoria": categoria.id},
        format="json",
    )
    assert resp.status_code == 401


def test_escrita_com_token_admin_funciona(api, admin_user, categoria):
    api.force_authenticate(user=admin_user)
    url = reverse("peca-list")
    resp = api.post(
        url,
        {
            "nome": "Nova Peça",
            "descricao": "Teste",
            "preco": "100.00",
            "categoria": categoria.id,
            "tipo": "pronta",
        },
        format="json",
    )
    assert resp.status_code == 201
    assert resp.data["nome"] == "Nova Peça"


def test_login_retorna_par_de_tokens(api, admin_user):
    url = reverse("login")
    resp = api.post(
        url,
        {"username": "admin", "password": "senha-super-secreta-123"},
        format="json",
    )
    assert resp.status_code == 200
    assert "access" in resp.data
    assert "refresh" in resp.data


def test_token_de_login_autoriza_escrita(api, admin_user, categoria):
    login = api.post(
        reverse("login"),
        {"username": "admin", "password": "senha-super-secreta-123"},
        format="json",
    )
    access = login.data["access"]
    api.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")

    resp = api.post(
        reverse("categoria-list"),
        {"nome": "Saias"},
        format="json",
    )
    assert resp.status_code == 201
    assert Categoria.objects.filter(nome="Saias").exists()


def test_refresh_renova_access_token(api, admin_user):
    login = api.post(
        reverse("login"),
        {"username": "admin", "password": "senha-super-secreta-123"},
        format="json",
    )
    refresh = login.data["refresh"]

    resp = api.post(reverse("refresh"), {"refresh": refresh}, format="json")
    assert resp.status_code == 200
    assert "access" in resp.data


def test_login_com_credenciais_invalidas_falha(api, admin_user):
    resp = api.post(
        reverse("login"),
        {"username": "admin", "password": "errada"},
        format="json",
    )
    assert resp.status_code == 401
