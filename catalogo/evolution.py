"""Gerência da instância da Evolution API (parear o WhatsApp do dono).

Usado pelo painel admin para criar a instância e exibir o QR Code de conexão.
O backend funciona como PROXY: ele guarda a ``EVOLUTION_API_KEY`` (segredo) e a
envia para a Evolution; o navegador NUNCA recebe a chave. Todas as funções
degradam com elegância (não levantam exceção) e nunca logam o segredo nem o QR.

Endpoints da Evolution v2 usados:
- ``GET  /instance/connectionState/{instance}`` — estado da conexão.
- ``GET  /instance/connect/{instance}`` — QR/pareamento de uma instância existente.
- ``POST /instance/create`` — cria a instância (e já devolve o QR).
- ``DELETE /instance/logout/{instance}`` — desconecta o número.
"""

import logging

from django.conf import settings

logger = logging.getLogger(__name__)

TIMEOUT_SEGUNDOS = 15


def _configurado() -> bool:
    """True se há URL, chave e nome de instância configurados (env)."""
    return bool(
        getattr(settings, "EVOLUTION_URL", "")
        and getattr(settings, "EVOLUTION_API_KEY", "")
        and getattr(settings, "EVOLUTION_INSTANCE", "")
    )


def _headers() -> dict:
    return {"apikey": settings.EVOLUTION_API_KEY, "Content-Type": "application/json"}


def _url(caminho: str) -> str:
    return f"{settings.EVOLUTION_URL.rstrip('/')}{caminho}"


def _extrair_qr(dados: dict) -> dict:
    """Normaliza o QR/pareamento das várias formas de resposta da Evolution.

    Procura ``base64``/``pairingCode`` no topo e dentro de ``qrcode``.
    Devolve ``{"qr_base64": <str|None>, "pairing_code": <str|None>}``.
    """
    dados = dados or {}
    qrcode = dados.get("qrcode") or {}
    base64 = dados.get("base64") or qrcode.get("base64")
    pairing = dados.get("pairingCode") or qrcode.get("pairingCode")
    return {"qr_base64": base64, "pairing_code": pairing}


def estado_conexao() -> dict:
    """Consulta o estado da instância. Nunca levanta exceção.

    Retorna ``{"configurado", "estado", "instancia"}`` onde ``estado`` é um de:
    ``open`` (conectado), ``connecting``, ``close``, ``nao_criada``,
    ``nao_configurado``, ``indisponivel`` ou ``desconhecido``.
    """
    instancia = getattr(settings, "EVOLUTION_INSTANCE", "")
    if not _configurado():
        return {"configurado": False, "estado": "nao_configurado", "instancia": instancia}

    import requests  # import tardio: módulo importável sem o pacote/rede

    try:
        resposta = requests.get(
            _url(f"/instance/connectionState/{instancia}"),
            headers=_headers(),
            timeout=TIMEOUT_SEGUNDOS,
        )
        if resposta.status_code == 404:
            return {"configurado": True, "estado": "nao_criada", "instancia": instancia}
        resposta.raise_for_status()
        dados = resposta.json()
        estado = (dados.get("instance") or {}).get("state") or dados.get("state") or "desconhecido"
        return {"configurado": True, "estado": estado, "instancia": instancia}
    except Exception:
        # Não loga corpo/segredo — só uma falha genérica.
        logger.warning("Falha ao consultar o estado da Evolution.")
        return {"configurado": True, "estado": "indisponivel", "instancia": instancia}


def _criar_instancia():
    import requests

    payload = {
        "instanceName": settings.EVOLUTION_INSTANCE,
        "integration": "WHATSAPP-BAILEYS",
        "qrcode": True,
    }
    return requests.post(
        _url("/instance/create"),
        json=payload,
        headers=_headers(),
        timeout=TIMEOUT_SEGUNDOS,
    )


def conectar() -> dict:
    """Garante a instância e devolve o QR Code para parear o número.

    Tenta conectar a instância existente; se ela ainda não existe (404), cria.
    Retorna ``{"estado", "qr_base64", "pairing_code", "mensagem"}``. Em caso de
    erro/instância indisponível, ``estado`` indica o problema e ``qr_base64`` é
    ``None`` (a UI mostra a ``mensagem``). Nunca levanta exceção.
    """
    instancia = getattr(settings, "EVOLUTION_INSTANCE", "")
    if not _configurado():
        return {
            "estado": "nao_configurado",
            "qr_base64": None,
            "pairing_code": None,
            "mensagem": "Bot não configurado. Defina EVOLUTION_URL, EVOLUTION_API_KEY e EVOLUTION_INSTANCE no .env.",
        }

    import requests

    try:
        # Já conectado? Não precisa de QR.
        estado = estado_conexao().get("estado")
        if estado == "open":
            return {
                "estado": "open",
                "qr_base64": None,
                "pairing_code": None,
                "mensagem": "WhatsApp já está conectado.",
            }

        resposta = requests.get(
            _url(f"/instance/connect/{instancia}"),
            headers=_headers(),
            timeout=TIMEOUT_SEGUNDOS,
        )
        # Instância ainda não existe → cria (a criação já devolve o QR).
        if resposta.status_code == 404:
            resposta = _criar_instancia()
        resposta.raise_for_status()
        qr = _extrair_qr(resposta.json())
        if not qr["qr_base64"] and not qr["pairing_code"]:
            return {
                "estado": "indisponivel",
                "qr_base64": None,
                "pairing_code": None,
                "mensagem": "A Evolution não retornou o QR Code. Tente novamente em instantes.",
            }
        return {
            "estado": "qr",
            "qr_base64": qr["qr_base64"],
            "pairing_code": qr["pairing_code"],
            "mensagem": "Escaneie o QR Code com o WhatsApp do número dedicado.",
        }
    except Exception:
        logger.warning("Falha ao conectar a instância da Evolution.")
        return {
            "estado": "indisponivel",
            "qr_base64": None,
            "pairing_code": None,
            "mensagem": "Não foi possível falar com a Evolution API. Verifique se o serviço está no ar.",
        }


def desconectar() -> dict:
    """Desconecta (logout) o número da instância. Nunca levanta exceção."""
    instancia = getattr(settings, "EVOLUTION_INSTANCE", "")
    if not _configurado():
        return {"ok": False, "mensagem": "Bot não configurado."}

    import requests

    try:
        resposta = requests.delete(
            _url(f"/instance/logout/{instancia}"),
            headers=_headers(),
            timeout=TIMEOUT_SEGUNDOS,
        )
        resposta.raise_for_status()
        return {"ok": True, "mensagem": "WhatsApp desconectado."}
    except Exception:
        logger.warning("Falha ao desconectar a instância da Evolution.")
        return {"ok": False, "mensagem": "Não foi possível desconectar agora. Tente novamente."}
