"""Testes do multiusuário do painel: papéis (Dono/Funcionário) e permissões.

A regra de ouro: as permissões são forçadas no BACKEND. Aqui validamos cada
fronteira (catálogo/estoque/encomendas, Vendas/financeiro, Funcionários e
Configurações) por papel, além de criação/reset de senha, alternância do
financeiro, troca da própria senha e bloqueio de conta inativa.
"""

from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework_simplejwt.tokens import AccessToken

from catalogo.models import Perfil

User = get_user_model()
pytestmark = pytest.mark.django_db


@pytest.fixture
def dono(db):
    u = User.objects.create_user(username="dona", password="senha-dona-123", is_staff=True)
    Perfil.objects.create(usuario=u, papel=Perfil.Papel.DONO, ativo=True)
    return u


@pytest.fixture
def funcionario(db):
    u = User.objects.create_user(username="func", password="senha-func-123")
    Perfil.objects.create(usuario=u, papel=Perfil.Papel.FUNCIONARIO, ativo=True)
    return u


@pytest.fixture
def funcionario_financeiro(db):
    u = User.objects.create_user(username="func-fin", password="senha-fin-123")
    Perfil.objects.create(
        usuario=u, papel=Perfil.Papel.FUNCIONARIO, ativo=True, acesso_financeiro=True
    )
    return u


# --------------------------------------------------------------------------
# Fronteiras por papel
# --------------------------------------------------------------------------


def test_funcionario_nao_acessa_funcionarios(api, funcionario):
    api.force_authenticate(funcionario)
    assert api.get(reverse("usuario-list")).status_code == 403
    assert api.post(reverse("usuario-list"), {}, format="json").status_code == 403


def test_funcionario_nao_acessa_configuracoes(api, funcionario):
    api.force_authenticate(funcionario)
    assert api.get(reverse("whatsapp-status")).status_code == 403
    assert api.get(reverse("whatsapp-dono")).status_code == 403


def test_funcionario_sem_financeiro_nao_acessa_vendas(api, funcionario):
    api.force_authenticate(funcionario)
    assert api.get(reverse("pedido-list")).status_code == 403


def test_funcionario_com_financeiro_acessa_vendas(api, funcionario_financeiro):
    api.force_authenticate(funcionario_financeiro)
    assert api.get(reverse("pedido-list")).status_code == 200


def test_funcionario_escreve_catalogo_e_estoque(api, funcionario, categoria):
    api.force_authenticate(funcionario)
    resp = api.post(
        reverse("peca-list"),
        {
            "nome": "Saia Midi",
            "descricao": "Linda saia.",
            "preco": "120.00",
            "categoria": categoria.id,
            "tipo": "pronta",
        },
        format="json",
    )
    assert resp.status_code == 201
    peca_id = resp.data["id"]
    # estoque (variação) também é liberado para o funcionário.
    resp_var = api.post(
        reverse("variacao-list"),
        {"peca": peca_id, "tamanho": "M", "cor": "Preto", "estoque": 5},
        format="json",
    )
    assert resp_var.status_code == 201


def test_funcionario_ve_encomendas(api, funcionario):
    api.force_authenticate(funcionario)
    assert api.get(reverse("encomenda-list")).status_code == 200


def test_dono_acessa_tudo(api, dono):
    api.force_authenticate(dono)
    assert api.get(reverse("usuario-list")).status_code == 200
    assert api.get(reverse("pedido-list")).status_code == 200
    assert api.get(reverse("whatsapp-status")).status_code == 200
    assert api.get(reverse("encomenda-list")).status_code == 200


# --------------------------------------------------------------------------
# Gestão de funcionários (só Dono)
# --------------------------------------------------------------------------


def test_dono_cria_funcionario_com_senha_provisoria(api, dono):
    api.force_authenticate(dono)
    resp = api.post(
        reverse("usuario-list"),
        {"nome": "Ana Lima", "usuario": "ana", "senha": "senha-prov-789"},
        format="json",
    )
    assert resp.status_code == 201
    assert resp.data["papel"] == "funcionario"
    assert resp.data["senha_provisoria"] is True
    assert resp.data["acesso_financeiro"] is False
    novo = User.objects.get(username="ana")
    assert novo.perfil.papel == "funcionario"
    assert novo.perfil.criado_por_id == dono.id


def test_cria_funcionario_usuario_duplicado(api, dono, funcionario):
    api.force_authenticate(dono)
    resp = api.post(
        reverse("usuario-list"),
        {"usuario": "func", "senha": "senha-prov-789"},
        format="json",
    )
    assert resp.status_code == 400
    assert "usuario" in resp.data


def test_cria_funcionario_senha_fraca(api, dono):
    api.force_authenticate(dono)
    resp = api.post(
        reverse("usuario-list"),
        {"usuario": "joao", "senha": "123"},
        format="json",
    )
    assert resp.status_code == 400
    assert "senha" in resp.data


def test_dono_alterna_financeiro(api, dono, funcionario):
    api.force_authenticate(dono)
    resp = api.patch(
        reverse("usuario-detail", args=[funcionario.id]),
        {"acesso_financeiro": True},
        format="json",
    )
    assert resp.status_code == 200
    assert resp.data["acesso_financeiro"] is True
    funcionario.refresh_from_db()
    assert funcionario.perfil.acesso_financeiro is True


def test_dono_reseta_senha_gera_provisoria(api, dono, funcionario):
    api.force_authenticate(dono)
    resp = api.patch(
        reverse("usuario-detail", args=[funcionario.id]),
        {"resetar_senha": True},
        format="json",
    )
    assert resp.status_code == 200
    assert resp.data["senha_provisoria"] is True
    nova = resp.data.get("senha_provisoria_gerada")
    assert nova  # mostrada UMA vez ao Dono
    funcionario.refresh_from_db()
    assert funcionario.check_password(nova)
    assert funcionario.perfil.senha_provisoria is True


def test_dono_desativa_funcionario_bloqueia_uso(api, dono, funcionario):
    api.force_authenticate(dono)
    resp = api.patch(
        reverse("usuario-detail", args=[funcionario.id]),
        {"ativo": False},
        format="json",
    )
    assert resp.status_code == 200
    funcionario.refresh_from_db()
    assert funcionario.perfil.ativo is False
    assert funcionario.is_active is False
    # Inativo é bloqueado mesmo em áreas que o funcionário normalmente acessa.
    api.force_authenticate(funcionario)
    assert api.get(reverse("encomenda-list")).status_code == 403


def test_dono_exclui_funcionario(api, dono, funcionario):
    api.force_authenticate(dono)
    resp = api.delete(reverse("usuario-detail", args=[funcionario.id]))
    assert resp.status_code == 204
    assert not User.objects.filter(username="func").exists()


# --------------------------------------------------------------------------
# Login com claims, /me/, troca de senha e bloqueio de inativo no login
# --------------------------------------------------------------------------


def test_login_inclui_papel_nas_claims(api, dono):
    resp = api.post(
        reverse("login"), {"username": "dona", "password": "senha-dona-123"}, format="json"
    )
    assert resp.status_code == 200
    token = AccessToken(resp.data["access"])
    assert token["papel"] == "dono"


def test_login_bloqueia_inativo(api, funcionario):
    funcionario.perfil.ativo = False
    funcionario.perfil.save()
    funcionario.is_active = False
    funcionario.save()
    resp = api.post(
        reverse("login"), {"username": "func", "password": "senha-func-123"}, format="json"
    )
    assert resp.status_code == 401


def test_me_retorna_identidade(api, funcionario_financeiro):
    api.force_authenticate(funcionario_financeiro)
    resp = api.get(reverse("me"))
    assert resp.status_code == 200
    assert resp.data["usuario"] == "func-fin"
    assert resp.data["papel"] == "funcionario"
    assert resp.data["acesso_financeiro"] is True
    assert resp.data["senha_provisoria"] is False


def test_me_exige_login(api):
    assert api.get(reverse("me")).status_code == 401


def test_troca_senha_limpa_provisoria(api, funcionario):
    funcionario.perfil.senha_provisoria = True
    funcionario.perfil.save()
    api.force_authenticate(funcionario)
    resp = api.post(
        reverse("me-senha"),
        {"senha_atual": "senha-func-123", "nova_senha": "outra-senha-456"},
        format="json",
    )
    assert resp.status_code == 200
    funcionario.refresh_from_db()
    assert funcionario.check_password("outra-senha-456")
    assert funcionario.perfil.senha_provisoria is False


def test_troca_senha_atual_incorreta(api, funcionario):
    api.force_authenticate(funcionario)
    resp = api.post(
        reverse("me-senha"),
        {"senha_atual": "errada", "nova_senha": "outra-senha-456"},
        format="json",
    )
    assert resp.status_code == 400
    assert "senha_atual" in resp.data
