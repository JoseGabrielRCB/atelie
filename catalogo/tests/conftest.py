"""Fixtures compartilhadas pelos testes do catálogo."""

from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from django.core.cache import cache
from rest_framework.test import APIClient

from catalogo.models import Categoria, Cliente, Peca, Variacao

# CPF válido (dígitos verificadores corretos) para os testes de cliente.
CPF_VALIDO = "52998224725"


@pytest.fixture(autouse=True)
def _limpar_throttle_cache():
    """Zera o cache entre testes para o throttle (escopo ``encomendas``) não
    vazar contagem de um teste para outro (causaria 429 espúrio)."""
    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def api():
    return APIClient()


@pytest.fixture
def admin_user(db):
    return get_user_model().objects.create_superuser(
        username="admin", password="senha-super-secreta-123"
    )


@pytest.fixture
def cliente(db):
    """Conta de CLIENTE (User sem Perfil/is_staff + Cliente com CPF válido)."""
    user = get_user_model().objects.create_user(
        username="ana@cliente.com",
        email="ana@cliente.com",
        password="senha-cliente-123",
        first_name="Ana",
    )
    return Cliente.objects.create(
        usuario=user,
        nome="Ana Cliente",
        cpf=CPF_VALIDO,
        telefone="67999990000",
    )


@pytest.fixture
def categoria(db):
    return Categoria.objects.create(nome="Vestidos")


@pytest.fixture
def peca_ativa(db, categoria):
    peca = Peca.objects.create(
        nome="Vestido Floral",
        descricao="Um vestido lindo.",
        preco=Decimal("199.90"),
        categoria=categoria,
        tipo=Peca.Tipo.PRONTA,
        ativo=True,
    )
    Variacao.objects.create(peca=peca, tamanho="P", cor="Azul", estoque=3)
    Variacao.objects.create(peca=peca, tamanho="M", cor="Azul", estoque=0)
    return peca


@pytest.fixture
def peca_inativa(db, categoria):
    return Peca.objects.create(
        nome="Vestido Fora de Linha",
        descricao="Descontinuado.",
        preco=Decimal("99.90"),
        categoria=categoria,
        tipo=Peca.Tipo.PRONTA,
        ativo=False,
    )
