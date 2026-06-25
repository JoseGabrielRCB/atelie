"""Camada fina sobre o SDK do Mercado Pago (Checkout Pro).

Todo acesso ao SDK do Mercado Pago passa por aqui. Isso isola a integração
externa do resto do código e permite que os testes façam monkeypatch destas
funções sem tocar a rede.

Regras de segurança (ver CLAUDE.md):
- Checkout HOSPEDADO: o cliente paga na página do Mercado Pago. Nenhum dado de
  cartão passa por nós.
- O ``access_token`` e o segredo do webhook vêm SOMENTE de variáveis de
  ambiente (``settings.MP_ACCESS_TOKEN`` / ``settings.MP_WEBHOOK_SECRET``).
  Nunca logue esses valores nem dados sensíveis do pagamento.
"""

import hashlib
import hmac

from django.conf import settings


def _cliente():
    """Constrói o SDK do Mercado Pago a partir do token do ambiente.

    O import é tardio para que este módulo seja importável mesmo sem o pacote
    instalado / sem rede (importante para coleta de testes).
    """
    import mercadopago  # import tardio: evita exigir o pacote em tempo de import

    return mercadopago.SDK(settings.MP_ACCESS_TOKEN)


def criar_preferencia(pedido, itens, base_url, frontend_url, notification_url, payer=None):
    """Cria uma preferência de Checkout Pro e devolve o dict de resposta do MP.

    ``itens`` é uma lista de dicts já calculados NO SERVIDOR no formato do MP:
    ``{"title", "quantity", "unit_price", "currency_id"}``.

    ``payer`` (opcional) identifica o comprador (vem da conta do cliente), ex.:
    ``{"name", "email", "identification": {"type": "CPF", "number": "..."}}``.
    Nunca logamos esse conteúdo (dados sensíveis — LGPD).

    Retorna o corpo (``response["response"]``) com, entre outros, ``id`` e
    ``init_point``.
    """
    sucesso = f"{frontend_url.rstrip('/')}/pagamento/sucesso"
    pendente = f"{frontend_url.rstrip('/')}/pagamento/pendente"
    falha = f"{frontend_url.rstrip('/')}/pagamento/falha"

    dados = {
        "items": itens,
        "external_reference": str(pedido.id),
        "notification_url": notification_url,
        "back_urls": {
            "success": sucesso,
            "pending": pendente,
            "failure": falha,
        },
        "auto_return": "approved",
        # Checkout Pro habilita Pix + cartão por padrão.
    }
    if payer:
        dados["payer"] = payer

    resultado = _cliente().preference().create(dados)
    return resultado["response"]


def consultar_pagamento(payment_id):
    """Consulta um pagamento no MP e devolve o dict de resposta (``response``).

    Contém ``status`` (ex.: ``"approved"``) e ``external_reference``.
    """
    resultado = _cliente().payment().get(payment_id)
    return resultado["response"]


def assinatura_valida(request, data_id):
    """Valida a assinatura HMAC do webhook do Mercado Pago.

    Esquema padrão do MP: o header ``x-signature`` traz ``ts=<timestamp>`` e
    ``v1=<hmac>``. O manifesto é ``id:<data.id>;request-id:<x-request-id>;ts:<ts>;``
    e o HMAC-SHA256 (hex) é calculado com ``MP_WEBHOOK_SECRET``.

    Retorna ``True``/``False``. Não levanta exceção nem loga dados sensíveis.
    """
    segredo = settings.MP_WEBHOOK_SECRET
    if not segredo:
        # Sem segredo configurado não há como validar — recusa por segurança.
        return False

    assinatura = request.headers.get("x-signature", "")
    request_id = request.headers.get("x-request-id", "")
    if not assinatura:
        return False

    # x-signature: "ts=1700000000,v1=abcdef..."
    ts = None
    v1 = None
    for parte in assinatura.split(","):
        if "=" not in parte:
            continue
        chave, _, valor = parte.partition("=")
        chave = chave.strip()
        valor = valor.strip()
        if chave == "ts":
            ts = valor
        elif chave == "v1":
            v1 = valor

    if not ts or not v1:
        return False

    manifesto = f"id:{data_id};request-id:{request_id};ts:{ts};"
    esperado = hmac.new(
        segredo.encode("utf-8"),
        manifesto.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()

    return hmac.compare_digest(esperado, v1)
