"""Correções pós-auditoria de integridade (itens #1, #3, #5, #6).

#1 imagem principal única por peça (forçada no servidor)
#3 arquivos físicos apagados ao excluir/cascata (django-cleanup)
#5 senha provisória bloqueia o painel no backend
#6 máquina de estados do status da Encomenda
"""

import io
import os

import pytest
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse

from catalogo.models import Encomenda, EncomendaImagem, Imagem, Peca, Perfil

User = get_user_model()
pytestmark = pytest.mark.django_db


def _png(nome="img.png"):
    """Imagem PNG válida mínima (passa pela validação do ImageField/serializer)."""
    from PIL import Image

    buf = io.BytesIO()
    Image.new("RGB", (2, 2), "red").save(buf, "PNG")
    buf.seek(0)
    return SimpleUploadedFile(nome, buf.read(), content_type="image/png")


@pytest.fixture
def funcionario_provisorio(db):
    u = User.objects.create_user(username="func", password="senha-func-123")
    Perfil.objects.create(
        usuario=u, papel=Perfil.Papel.FUNCIONARIO, ativo=True, senha_provisoria=True
    )
    return u


# --------------------------------------------------------------------------
# #1 — Imagem principal única por peça
# --------------------------------------------------------------------------
def test_segunda_principal_desmarca_a_primeira(api, admin_user, settings, tmp_path, peca_ativa):
    settings.MEDIA_ROOT = str(tmp_path)
    api.force_authenticate(admin_user)
    url = reverse("imagem-list")
    r1 = api.post(url, {"peca": peca_ativa.id, "arquivo": _png("a.png"), "principal": "true"}, format="multipart")
    r2 = api.post(url, {"peca": peca_ativa.id, "arquivo": _png("b.png"), "principal": "true"}, format="multipart")
    assert r1.status_code == 201 and r2.status_code == 201

    principais = Imagem.objects.filter(peca=peca_ativa, principal=True)
    assert principais.count() == 1
    assert principais.first().id == r2.data["id"]  # a última marcada vence


def test_primeira_imagem_vira_principal_mesmo_sem_marcar(api, admin_user, settings, tmp_path, peca_ativa):
    settings.MEDIA_ROOT = str(tmp_path)
    api.force_authenticate(admin_user)
    url = reverse("imagem-list")
    r = api.post(url, {"peca": peca_ativa.id, "arquivo": _png(), "principal": "false"}, format="multipart")
    assert r.status_code == 201
    assert Imagem.objects.filter(peca=peca_ativa, principal=True).count() == 1


def test_patch_principal_desmarca_as_outras(api, admin_user, settings, tmp_path, peca_ativa):
    settings.MEDIA_ROOT = str(tmp_path)
    api.force_authenticate(admin_user)
    url = reverse("imagem-list")
    a = api.post(url, {"peca": peca_ativa.id, "arquivo": _png("a.png"), "principal": "true"}, format="multipart").data
    b = api.post(url, {"peca": peca_ativa.id, "arquivo": _png("b.png"), "principal": "false"}, format="multipart").data
    # Promove a 'b' como principal via PATCH.
    api.patch(reverse("imagem-detail", args=[b["id"]]), {"principal": True}, format="json")
    assert Imagem.objects.filter(peca=peca_ativa, principal=True).count() == 1
    assert Imagem.objects.get(pk=b["id"]).principal is True
    assert Imagem.objects.get(pk=a["id"]).principal is False


# --------------------------------------------------------------------------
# #3 — Arquivos físicos órfãos (django-cleanup)
# django-cleanup apaga o arquivo no COMMIT da transação (transaction.on_commit);
# por isso estes testes usam transaction=True (senão o rollback impede o commit).
# --------------------------------------------------------------------------
@pytest.mark.django_db(transaction=True)
def test_excluir_imagem_apaga_arquivo(settings, tmp_path, categoria):
    settings.MEDIA_ROOT = str(tmp_path)
    from decimal import Decimal

    peca = Peca.objects.create(nome="Foto Solta", preco=Decimal("10.00"), categoria=categoria)
    img = Imagem.objects.create(peca=peca, arquivo=SimpleUploadedFile("t.jpg", b"conteudo"))
    caminho = img.arquivo.path
    assert os.path.exists(caminho)
    img.delete()
    assert not os.path.exists(caminho)


@pytest.mark.django_db(transaction=True)
def test_excluir_peca_em_cascata_apaga_arquivos(settings, tmp_path, categoria):
    settings.MEDIA_ROOT = str(tmp_path)
    from decimal import Decimal

    peca = Peca.objects.create(nome="Com Foto", preco=Decimal("10.00"), categoria=categoria)
    img = Imagem.objects.create(peca=peca, arquivo=SimpleUploadedFile("c.jpg", b"x"))
    caminho = img.arquivo.path
    assert os.path.exists(caminho)
    peca.delete()  # CASCADE remove a Imagem
    assert not os.path.exists(caminho)


@pytest.mark.django_db(transaction=True)
def test_excluir_encomenda_apaga_imagens_de_referencia(settings, tmp_path):
    settings.MEDIA_ROOT = str(tmp_path)
    enc = Encomenda.objects.create(nome="Ana", contato="x", descricao="d")
    img = EncomendaImagem.objects.create(encomenda=enc, arquivo=SimpleUploadedFile("ref.jpg", b"x"))
    caminho = img.arquivo.path
    assert os.path.exists(caminho)
    enc.delete()
    assert not os.path.exists(caminho)


# --------------------------------------------------------------------------
# #5 — Senha provisória bloqueia o painel (backend)
# --------------------------------------------------------------------------
def test_provisoria_bloqueia_painel(api, funcionario_provisorio, categoria):
    api.force_authenticate(funcionario_provisorio)
    # Leitura/ações do painel barradas.
    assert api.get(reverse("encomenda-list")).status_code == 403
    resp = api.post(
        reverse("peca-list"),
        {"nome": "X", "preco": "10.00", "categoria": categoria.id, "tipo": "pronta"},
        format="json",
    )
    assert resp.status_code == 403
    assert "provis" in str(resp.data).lower()


def test_provisoria_permite_ver_e_trocar_senha(api, funcionario_provisorio):
    api.force_authenticate(funcionario_provisorio)
    assert api.get(reverse("me")).status_code == 200
    resp = api.post(
        reverse("me-senha"),
        {"senha_atual": "senha-func-123", "nova_senha": "nova-senha-forte-987"},
        format="json",
    )
    assert resp.status_code == 200


def test_apos_trocar_senha_acesso_liberado(api, funcionario_provisorio):
    api.force_authenticate(funcionario_provisorio)
    api.post(
        reverse("me-senha"),
        {"senha_atual": "senha-func-123", "nova_senha": "nova-senha-forte-987"},
        format="json",
    )
    # Re-autentica com o usuário fresco (flag senha_provisoria já limpa no banco).
    fresco = User.objects.get(pk=funcionario_provisorio.pk)
    api.force_authenticate(fresco)
    assert api.get(reverse("encomenda-list")).status_code == 200


# --------------------------------------------------------------------------
# #6 — Máquina de estados da Encomenda
# --------------------------------------------------------------------------
def _encomenda(status=Encomenda.Status.RECEBIDO):
    return Encomenda.objects.create(nome="Ana", contato="x", descricao="d", status=status)


def test_transicao_valida_passa(api, admin_user):
    enc = _encomenda()
    api.force_authenticate(admin_user)
    resp = api.patch(reverse("encomenda-detail", args=[enc.id]), {"status": "em_andamento"}, format="json")
    assert resp.status_code == 200
    enc.refresh_from_db()
    assert enc.status == Encomenda.Status.EM_ANDAMENTO


def test_transicao_pulando_etapa_recusada(api, admin_user):
    enc = _encomenda()  # recebido
    api.force_authenticate(admin_user)
    resp = api.patch(reverse("encomenda-detail", args=[enc.id]), {"status": "concluida"}, format="json")
    assert resp.status_code == 400
    enc.refresh_from_db()
    assert enc.status == Encomenda.Status.RECEBIDO


def test_estado_terminal_nao_muda(api, admin_user):
    enc = _encomenda(status=Encomenda.Status.CANCELADA)
    api.force_authenticate(admin_user)
    resp = api.patch(reverse("encomenda-detail", args=[enc.id]), {"status": "em_andamento"}, format="json")
    assert resp.status_code == 400
    assert "não pode mudar" in str(resp.data).lower()
    enc.refresh_from_db()
    assert enc.status == Encomenda.Status.CANCELADA


def test_mesmo_status_e_idempotente(api, admin_user):
    enc = _encomenda(status=Encomenda.Status.EM_ANDAMENTO)
    api.force_authenticate(admin_user)
    resp = api.patch(reverse("encomenda-detail", args=[enc.id]), {"status": "em_andamento"}, format="json")
    assert resp.status_code == 200
