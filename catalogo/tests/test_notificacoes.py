"""Testes das notificações do bot de WhatsApp do DONO (privado).

Não tocam a rede nem deixam threads escaparem: monkeypatcham o envio real
(``enviar_whatsapp`` / ``_enviar_para``) e capturam o texto produzido.
"""

import io
from decimal import Decimal

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from PIL import Image

from catalogo import notificacoes
from catalogo.models import Encomenda, ItemPedido, Pedido, Variacao
from catalogo.signals import compra_paga

pytestmark = pytest.mark.django_db


@pytest.fixture
def capturar(monkeypatch):
    """Captura as mensagens enviadas, sem rede nem threads."""
    enviadas = []
    monkeypatch.setattr(
        notificacoes, "enviar_whatsapp", lambda texto, **kw: enviadas.append(texto)
    )
    return enviadas


def _png(nome="ref.png"):
    buffer = io.BytesIO()
    Image.new("RGB", (10, 10), (200, 100, 50)).save(buffer, format="PNG")
    return SimpleUploadedFile(nome, buffer.getvalue(), content_type="image/png")


def _pedido_pago(peca_ativa, variacao, quantidade=1, estoque_final=2):
    """Cria um Pedido pago com um item na ``variacao`` e ajusta o estoque."""
    pedido = Pedido.objects.create(
        nome="Cliente",
        contato="123",
        status=Pedido.Status.PAGO,
        total=peca_ativa.preco * quantidade,
        expira_em="2099-01-01T00:00:00Z",
    )
    ItemPedido.objects.create(
        pedido=pedido,
        variacao=variacao,
        quantidade=quantidade,
        preco_unit=peca_ativa.preco,
    )
    # Simula o estoque já decrementado (o sinal dispara após o commit).
    variacao.estoque = estoque_final
    variacao.save(update_fields=["estoque"])
    return pedido


# (a) compra_paga → mensagem "Venda paga" com item/estoque corretos -----------


def test_compra_paga_gera_mensagem_venda_paga(capturar, peca_ativa):
    variacao = peca_ativa.variacoes.get(tamanho="P", cor="Azul")
    pedido = _pedido_pago(peca_ativa, variacao, quantidade=1, estoque_final=2)

    compra_paga.send(sender=Pedido, pedido=pedido)

    venda = [m for m in capturar if "Venda paga" in m]
    assert venda, capturar
    texto = venda[0]
    assert "1× Vestido Floral P/Azul" in texto
    assert "R$ 199,90" in texto
    assert "Estoque agora: 2" in texto


# (b) variação no/abaixo do limiar → alerta "Estoque baixo" -------------------


def test_compra_paga_estoque_no_limiar_gera_alerta(capturar, peca_ativa, settings):
    settings.ESTOQUE_BAIXO_LIMIAR = 1
    variacao = peca_ativa.variacoes.get(tamanho="P", cor="Azul")
    pedido = _pedido_pago(peca_ativa, variacao, quantidade=2, estoque_final=1)

    compra_paga.send(sender=Pedido, pedido=pedido)

    baixo = [m for m in capturar if "Estoque baixo" in m]
    assert baixo, capturar
    assert "Vestido Floral P/Azul = 1." in baixo[0]


def test_estoque_acima_do_limiar_nao_alerta(capturar, peca_ativa, settings):
    settings.ESTOQUE_BAIXO_LIMIAR = 1
    variacao = peca_ativa.variacoes.get(tamanho="P", cor="Azul")
    pedido = _pedido_pago(peca_ativa, variacao, quantidade=1, estoque_final=5)

    compra_paga.send(sender=Pedido, pedido=pedido)

    assert not [m for m in capturar if "Estoque baixo" in m]


# (c) criar encomenda → mensagem "Nova encomenda" com nome + descrição truncada


def test_nova_encomenda_gera_mensagem(capturar, api):
    url = reverse("encomenda-list")
    descricao_longa = "Vestido de festa azul godê com muitos detalhes bordados à mão na saia toda"
    payload = {
        "nome": "Maria",
        "contato": "(81) 99999-0000",
        "descricao": descricao_longa,
        "imagens": [_png("a.png")],
    }

    resp = api.post(url, payload, format="multipart")

    assert resp.status_code == 201
    nova = [m for m in capturar if "Nova encomenda" in m]
    assert nova, capturar
    texto = nova[0]
    assert "Maria" in texto
    assert texto.endswith("Veja no painel.")
    # Descrição truncada para ~60 chars (com reticências).
    assert "…" in texto
    assert descricao_longa not in texto


# (d) sem configuração → enviar_whatsapp é no-op seguro -----------------------


def test_enviar_whatsapp_sem_config_e_noop(settings):
    settings.EVOLUTION_URL = ""
    settings.EVOLUTION_API_KEY = ""
    settings.WHATSAPP_DONO = []

    # Não deve levantar exceção nem tentar rede (bloquear=True força síncrono).
    notificacoes.enviar_whatsapp("oi", bloquear=True)


def test_enviar_whatsapp_configurado_chama_envio(monkeypatch, settings):
    settings.EVOLUTION_URL = "http://evolution:8080"
    settings.EVOLUTION_API_KEY = "chave"
    settings.EVOLUTION_INSTANCE = "atelie-bot"
    settings.WHATSAPP_DONO = ["5581999990000", "5581988880000"]

    chamadas = []
    monkeypatch.setattr(
        notificacoes, "_enviar_para", lambda num, txt: chamadas.append((num, txt))
    )

    notificacoes.enviar_whatsapp("alô", bloquear=True)

    assert chamadas == [
        ("5581999990000", "alô"),
        ("5581988880000", "alô"),
    ]
