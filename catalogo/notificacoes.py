"""Bot de WhatsApp do DONO (privado) — serviço de envio + receivers de sinais.

Notifica APENAS o(s) número(s) do dono (``settings.WHATSAPP_DONO``) via
Evolution API. NUNCA fala com clientes. Mensagens em PT-BR.

Resiliência (ver CLAUDE.md):
- Uma falha de WhatsApp/Evolution NUNCA pode quebrar o fluxo de venda/encomenda.
  O envio HTTP roda em uma thread daemon, com timeout curto, dentro de
  try/except que loga apenas uma falha genérica (+ status code) — nunca o
  conteúdo da mensagem nem a apikey.
- Se ``EVOLUTION_URL`` / ``EVOLUTION_API_KEY`` / ``WHATSAPP_DONO`` não estiverem
  configurados, o envio é um no-op silencioso (dev/testes não tocam a rede).

Segurança: dados sensíveis (nome/contato do cliente, apikey) NUNCA são logados.
"""

import logging
import threading

from django.conf import settings
from django.dispatch import receiver

from .signals import compra_paga, encomenda_criada

logger = logging.getLogger(__name__)

# Timeout curto: a integração externa não pode segurar a thread por muito tempo.
TIMEOUT_SEGUNDOS = 10


def _configurado() -> bool:
    """True se o bot está minimamente configurado para enviar mensagens."""
    return bool(
        getattr(settings, "EVOLUTION_URL", "")
        and getattr(settings, "EVOLUTION_API_KEY", "")
        and getattr(settings, "WHATSAPP_DONO", [])
    )


def _enviar_para(numero: str, texto: str) -> None:
    """Envia ``texto`` para UM número via Evolution API (sendText).

    Import tardio de ``requests`` para manter o módulo importável sem o pacote
    (coleta de testes). Em caso de erro, loga apenas uma falha genérica — nunca
    o conteúdo nem a apikey.
    """
    import requests  # import tardio: não exige o pacote em tempo de import

    url = f"{settings.EVOLUTION_URL.rstrip('/')}/message/sendText/{settings.EVOLUTION_INSTANCE}"
    headers = {
        "apikey": settings.EVOLUTION_API_KEY,
        "Content-Type": "application/json",
    }
    try:
        resposta = requests.post(
            url,
            json={"number": numero, "text": texto},
            headers=headers,
            timeout=TIMEOUT_SEGUNDOS,
        )
        if resposta.status_code >= 400:
            # Não logamos o corpo (pode ecoar dados) nem a apikey.
            logger.warning(
                "Falha ao enviar WhatsApp ao dono (status %s).",
                resposta.status_code,
            )
    except Exception:
        # Qualquer falha de rede/Evolution é engolida: não pode quebrar o fluxo.
        logger.warning("Falha ao enviar WhatsApp ao dono (erro de conexão).")


def _enviar_todos(texto: str) -> None:
    """Envia ``texto`` para todos os números do dono (alvo da thread)."""
    for numero in settings.WHATSAPP_DONO:
        _enviar_para(numero, texto)


def enviar_whatsapp(texto: str, bloquear: bool = False) -> None:
    """Notifica o(s) dono(s) com ``texto`` de forma resiliente e não-bloqueante.

    - No-op silencioso se o bot não estiver configurado (dev/testes).
    - Por padrão, o envio HTTP roda em thread daemon (não bloqueia a venda/
      encomenda). ``bloquear=True`` envia de forma síncrona (útil em testes).
    """
    if not texto or not _configurado():
        return

    if bloquear:
        _enviar_todos(texto)
        return

    thread = threading.Thread(
        target=_enviar_todos,
        args=(texto,),
        daemon=True,
    )
    thread.start()


# --------------------------------------------------------------------------
# Formatação de mensagens (PT-BR)
# --------------------------------------------------------------------------


def _brl(valor) -> str:
    """Formata um Decimal/numero como R$ 1.234,56 (PT-BR)."""
    texto = f"{valor:,.2f}"  # 1,234.56
    texto = texto.replace(",", "_").replace(".", ",").replace("_", ".")
    return f"R$ {texto}"


def _rotulo_variacao(variacao) -> str:
    """Ex.: 'Vestido Floral M/Azul' (ignora tamanho/cor vazios)."""
    partes = [p for p in (variacao.tamanho, variacao.cor) if p]
    sufixo = f" {'/'.join(partes)}" if partes else ""
    return f"{variacao.peca.nome}{sufixo}"


def checar_estoque_baixo(variacoes) -> None:
    """Alerta o dono sobre variações com estoque <= limiar (estoque fresco).

    Recebe um iterável de ``Variacao`` (com estoque já atualizado). Exportada
    para reuso (ex.: comando de "baixa" manual do bot).
    """
    limiar = getattr(settings, "ESTOQUE_BAIXO_LIMIAR", 1)
    for variacao in variacoes:
        if variacao.estoque <= limiar:
            enviar_whatsapp(
                f"⚠️ Estoque baixo: {_rotulo_variacao(variacao)} = {variacao.estoque}."
            )


# --------------------------------------------------------------------------
# Receivers de sinais
# --------------------------------------------------------------------------


@receiver(compra_paga)
def notificar_compra_paga(sender, pedido, **kwargs):
    """Notifica o dono de uma venda paga: itens, valor e estoque resultante.

    Lê o estoque FRESCO de cada variação (o sinal dispara após o decremento ser
    commitado). Depois dispara o alerta de estoque baixo para as variações no
    limiar ou abaixo.
    """
    itens = list(pedido.itens.select_related("variacao__peca").all())
    variacoes = []
    linhas = []
    for item in itens:
        variacao = item.variacao
        variacao.refresh_from_db(fields=["estoque"])  # estoque já decrementado
        variacoes.append(variacao)
        linhas.append(
            f"🛒 Venda paga: {item.quantidade}× {_rotulo_variacao(variacao)} — "
            f"{_brl(item.preco_unit)}. Estoque agora: {variacao.estoque}."
        )

    if linhas:
        enviar_whatsapp("\n".join(linhas))

    checar_estoque_baixo(variacoes)


@receiver(encomenda_criada)
def notificar_encomenda_criada(sender, encomenda, **kwargs):
    """Notifica o dono de uma nova encomenda (único lugar com nome do cliente).

    O nome do cliente vai para o dono (ok), mas NUNCA é logado. A descrição é
    truncada para ~60 caracteres.
    """
    descricao = (encomenda.descricao or "").strip()
    if len(descricao) > 60:
        descricao = descricao[:60].rstrip() + "…"
    enviar_whatsapp(
        f"📩 Nova encomenda de {encomenda.nome} — '{descricao}'. Veja no painel."
    )
