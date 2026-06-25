"""Testes da conta do CLIENTE da loja (cadastro/login/perfil/histórico).

Cobre a separação de audiência (cliente × staff), unicidade/validação de CPF e
e-mail, edição restrita do perfil, troca de senha e o isolamento do histórico
(cada cliente só vê os próprios pedidos).
"""

from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from django.utils import timezone

from catalogo.models import Cliente, Perfil, Pedido

from .conftest import CPF_VALIDO

User = get_user_model()
pytestmark = pytest.mark.django_db

# Outro CPF válido (diferente do CPF_VALIDO do fixture `cliente`).
CPF_VALIDO_2 = "16899535009"


def _pedido(cliente, total="100.00"):
    return Pedido.objects.create(
        cliente=cliente,
        nome=cliente.nome,
        contato="x",
        status=Pedido.Status.PAGO,
        total=Decimal(total),
        expira_em=timezone.now() + timezone.timedelta(minutes=30),
    )


# --------------------------------------------------------------------------
# Cadastro
# --------------------------------------------------------------------------


def test_cadastro_cria_conta(api):
    resp = api.post(
        reverse("conta-cadastro"),
        {
            "nome": "João Silva",
            "email": "joao@email.com",
            "cpf": "529.982.247-25",  # com máscara — o backend normaliza
            "telefone": "(67) 99999-0000",
            "senha": "senha-forte-123",
        },
        format="json",
    )
    assert resp.status_code == 201
    user = User.objects.get(username="joao@email.com")
    assert user.is_staff is False
    assert user.cliente.cpf == CPF_VALIDO  # guardado só com dígitos
    # não ecoa CPF/senha
    assert "cpf" not in resp.data and "senha" not in resp.data


def test_cadastro_email_duplicado(api, cliente):
    resp = api.post(
        reverse("conta-cadastro"),
        {"nome": "Outro", "email": "ana@cliente.com", "cpf": CPF_VALIDO_2, "senha": "senha-forte-123"},
        format="json",
    )
    assert resp.status_code == 400
    assert "email" in resp.data


def test_cadastro_cpf_duplicado(api, cliente):
    resp = api.post(
        reverse("conta-cadastro"),
        {"nome": "Outro", "email": "novo@email.com", "cpf": CPF_VALIDO, "senha": "senha-forte-123"},
        format="json",
    )
    assert resp.status_code == 400
    assert "cpf" in resp.data


def test_cadastro_cpf_invalido(api):
    resp = api.post(
        reverse("conta-cadastro"),
        {"nome": "Zé", "email": "ze@email.com", "cpf": "111.111.111-11", "senha": "senha-forte-123"},
        format="json",
    )
    assert resp.status_code == 400
    assert "cpf" in resp.data


def test_cadastro_nome_com_numeros(api):
    resp = api.post(
        reverse("conta-cadastro"),
        {"nome": "Maria 123", "email": "m@email.com", "cpf": CPF_VALIDO_2, "senha": "senha-forte-123"},
        format="json",
    )
    assert resp.status_code == 400
    assert "nome" in resp.data


def test_cadastro_senha_fraca(api):
    resp = api.post(
        reverse("conta-cadastro"),
        {"nome": "Zé", "email": "ze@email.com", "cpf": CPF_VALIDO_2, "senha": "123"},
        format="json",
    )
    assert resp.status_code == 400
    assert "senha" in resp.data


# --------------------------------------------------------------------------
# Login e separação de audiência (cliente × staff)
# --------------------------------------------------------------------------


def test_login_cliente_ok(api, cliente):
    resp = api.post(
        reverse("conta-login"),
        {"email": "ana@cliente.com", "password": "senha-cliente-123"},
        format="json",
    )
    assert resp.status_code == 200
    assert "access" in resp.data and "refresh" in resp.data


def test_staff_nao_loga_como_cliente(api):
    # staff com e-mail como username + Perfil → recusado no login de cliente.
    u = User.objects.create_user(
        username="dona@atelie.com", email="dona@atelie.com", password="senha-staff-123", is_staff=True
    )
    Perfil.objects.create(usuario=u, papel=Perfil.Papel.DONO, ativo=True)
    resp = api.post(
        reverse("conta-login"),
        {"email": "dona@atelie.com", "password": "senha-staff-123"},
        format="json",
    )
    assert resp.status_code == 400


def test_cliente_nao_loga_no_painel(api, cliente):
    # O login do admin (TokenComPapelSerializer) recusa quem não tem Perfil.
    resp = api.post(
        reverse("login"),
        {"username": "ana@cliente.com", "password": "senha-cliente-123"},
        format="json",
    )
    assert resp.status_code == 400


# --------------------------------------------------------------------------
# Perfil (/conta/me/) e troca de senha
# --------------------------------------------------------------------------


def test_me_exige_login(api):
    assert api.get(reverse("conta-me")).status_code == 401


def test_me_retorna_dados(api, cliente):
    api.force_authenticate(cliente.usuario)
    resp = api.get(reverse("conta-me"))
    assert resp.status_code == 200
    assert resp.data["nome"] == "Ana Cliente"
    assert resp.data["email"] == "ana@cliente.com"
    assert resp.data["cpf"] == "529.982.247-25"  # formatado para exibição


def test_me_edita_so_nome_e_telefone(api, cliente):
    api.force_authenticate(cliente.usuario)
    resp = api.patch(
        reverse("conta-me"),
        {"nome": "Ana Maria", "telefone": "67988887777", "cpf": "00000000000", "email": "hack@x.com"},
        format="json",
    )
    assert resp.status_code == 200
    cliente.refresh_from_db()
    assert cliente.nome == "Ana Maria"
    assert cliente.telefone == "67988887777"
    # CPF e e-mail NÃO mudam (read-only no MVP)
    assert cliente.cpf == CPF_VALIDO
    assert cliente.usuario.email == "ana@cliente.com"


def test_troca_senha(api, cliente):
    api.force_authenticate(cliente.usuario)
    resp = api.post(
        reverse("conta-senha"),
        {"senha_atual": "senha-cliente-123", "nova_senha": "outra-senha-456"},
        format="json",
    )
    assert resp.status_code == 200
    cliente.usuario.refresh_from_db()
    assert cliente.usuario.check_password("outra-senha-456")


def test_troca_senha_atual_incorreta(api, cliente):
    api.force_authenticate(cliente.usuario)
    resp = api.post(
        reverse("conta-senha"),
        {"senha_atual": "errada", "nova_senha": "outra-senha-456"},
        format="json",
    )
    assert resp.status_code == 400


# --------------------------------------------------------------------------
# Histórico de pedidos (isolamento por cliente)
# --------------------------------------------------------------------------


def test_pedidos_so_do_proprio_cliente(api, cliente):
    meu = _pedido(cliente)
    # outro cliente, com outro pedido
    outro_user = User.objects.create_user(
        username="bia@cliente.com", email="bia@cliente.com", password="senha-bia-123"
    )
    outro = Cliente.objects.create(usuario=outro_user, nome="Bia", cpf=CPF_VALIDO_2)
    alheio = _pedido(outro)

    api.force_authenticate(cliente.usuario)
    resp = api.get(reverse("conta-pedido-list"))
    assert resp.status_code == 200
    ids = [p["id"] for p in resp.data["results"]]
    assert meu.id in ids
    assert alheio.id not in ids


def test_pedidos_exige_login(api):
    assert api.get(reverse("conta-pedido-list")).status_code == 401


def test_staff_nao_acessa_conta_de_cliente(api, admin_user):
    # Token de staff não vale na área de cliente.
    api.force_authenticate(admin_user)
    assert api.get(reverse("conta-me")).status_code == 403
    assert api.get(reverse("conta-pedido-list")).status_code == 403
