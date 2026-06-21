"""Testes do recurso de encomendas (pedidos sob medida com imagens)."""

import io

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from PIL import Image

from catalogo.models import Encomenda

pytestmark = pytest.mark.django_db


def _png(nome="ref.png", content_type="image/png", size=(10, 10)):
    """Gera um PNG minúsculo em memória como arquivo de upload."""
    buffer = io.BytesIO()
    Image.new("RGB", size, (200, 100, 50)).save(buffer, format="PNG")
    return SimpleUploadedFile(nome, buffer.getvalue(), content_type=content_type)


def _dados_validos():
    return {
        "nome": "Maria",
        "contato": "(81) 99999-0000",
        "descricao": "Vestido de festa azul, godê.",
        "tamanho_medidas": "Busto 90, cintura 70",
        "prazo_desejado": "2026-08-01",
    }


def test_criacao_publica_com_imagens_retorna_201(api):
    url = reverse("encomenda-list")
    payload = {**_dados_validos(), "imagens": [_png("a.png"), _png("b.png")]}

    resp = api.post(url, payload, format="multipart")

    assert resp.status_code == 201
    assert resp.data["status"] == "recebido"
    assert "id" in resp.data
    assert "mensagem" in resp.data
    # Não pode ecoar dados sensíveis do cliente.
    assert "nome" not in resp.data
    assert "contato" not in resp.data

    encomenda = Encomenda.objects.get(id=resp.data["id"])
    assert encomenda.status == Encomenda.Status.RECEBIDO
    assert encomenda.imagens.count() == 2


def test_criacao_sem_campos_obrigatorios_retorna_400(api):
    url = reverse("encomenda-list")
    resp = api.post(url, {"tamanho_medidas": "x"}, format="multipart")

    assert resp.status_code == 400
    assert "nome" in resp.data
    assert "contato" in resp.data
    assert "descricao" in resp.data


def test_anonimo_nao_pode_listar(api, peca_ativa):
    url = reverse("encomenda-list")
    resp = api.get(url)
    assert resp.status_code == 401


def test_admin_pode_listar(api, admin_user):
    Encomenda.objects.create(
        nome="Ana", contato="123", descricao="Saia longa."
    )
    api.force_authenticate(user=admin_user)
    url = reverse("encomenda-list")
    resp = api.get(url)

    assert resp.status_code == 200
    assert resp.data["count"] == 1
    assert "imagens" in resp.data["results"][0]
    assert resp.data["results"][0]["nome"] == "Ana"


def test_admin_pode_alterar_status_via_patch(api, admin_user):
    encomenda = Encomenda.objects.create(
        nome="Ana", contato="123", descricao="Saia longa."
    )
    api.force_authenticate(user=admin_user)
    url = reverse("encomenda-detail", args=[encomenda.id])

    resp = api.patch(url, {"status": "em_andamento"}, format="json")

    assert resp.status_code == 200
    encomenda.refresh_from_db()
    assert encomenda.status == Encomenda.Status.EM_ANDAMENTO


def test_admin_pode_excluir(api, admin_user):
    encomenda = Encomenda.objects.create(
        nome="Ana", contato="123", descricao="Saia longa."
    )
    api.force_authenticate(user=admin_user)
    url = reverse("encomenda-detail", args=[encomenda.id])

    resp = api.delete(url)

    assert resp.status_code == 204
    assert not Encomenda.objects.filter(id=encomenda.id).exists()


def test_mais_de_cinco_imagens_retorna_400(api):
    url = reverse("encomenda-list")
    payload = {
        **_dados_validos(),
        "imagens": [_png(f"img{i}.png") for i in range(6)],
    }
    resp = api.post(url, payload, format="multipart")

    assert resp.status_code == 400
    assert "imagens" in resp.data
    assert Encomenda.objects.count() == 0


def test_tipo_de_imagem_invalido_retorna_400(api):
    url = reverse("encomenda-list")
    payload = {
        **_dados_validos(),
        "imagens": [
            SimpleUploadedFile("doc.pdf", b"%PDF-1.4", content_type="application/pdf")
        ],
    }
    resp = api.post(url, payload, format="multipart")

    assert resp.status_code == 400
    assert "imagens" in resp.data
    assert Encomenda.objects.count() == 0


def test_imagem_muito_grande_retorna_400(api):
    url = reverse("encomenda-list")
    grande = SimpleUploadedFile(
        "grande.png", b"x" * (5 * 1024 * 1024 + 1), content_type="image/png"
    )
    payload = {**_dados_validos(), "imagens": [grande]}
    resp = api.post(url, payload, format="multipart")

    assert resp.status_code == 400
    assert "imagens" in resp.data
    assert Encomenda.objects.count() == 0
