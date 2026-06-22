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


def _classificar_erro(exc=None, status_code=None) -> dict:
    """Mapeia uma falha para ``{"estado", "mensagem"}`` da UI, sem vazar segredos.

    Loga o status HTTP e uma razão curta (connection refused / timeout / 4xx /
    5xx) — nunca a apikey, o corpo completo ou o QR.
    """
    import requests

    if status_code in (401, 403):
        logger.warning("Evolution recusou a chave (status %s).", status_code)
        return {
            "estado": "nao_autorizado",
            "mensagem": "Chave da Evolution inválida (EVOLUTION_API_KEY).",
        }
    if status_code is not None and status_code >= 500:
        logger.warning("Evolution respondeu erro interno (status %s).", status_code)
        return {
            "estado": "erro_evolution",
            "mensagem": "Evolution respondeu com erro (possível banco 'evolution' ausente).",
        }
    if isinstance(exc, requests.exceptions.Timeout):
        logger.warning("Timeout ao falar com a Evolution.")
        return {
            "estado": "indisponivel",
            "mensagem": "A Evolution demorou para responder. Verifique o serviço evolution-api.",
        }
    if isinstance(exc, requests.exceptions.ConnectionError):
        logger.warning("Conexão recusada ao falar com a Evolution.")
        return {
            "estado": "indisponivel",
            "mensagem": "Serviço Evolution fora do ar — verifique 'docker compose up evolution-api'.",
        }
    logger.warning(
        "Falha ao falar com a Evolution (status %s).",
        status_code if status_code is not None else "sem resposta",
    )
    return {
        "estado": "indisponivel",
        "mensagem": "Não foi possível falar com a Evolution API. Tente novamente em instantes.",
    }


def estado_conexao() -> dict:
    """Consulta o estado da instância. Nunca levanta exceção.

    Retorna ``{"configurado", "estado", "instancia"}`` (e ``"mensagem"`` quando há
    falha) onde ``estado`` é um de: ``open`` (conectado), ``connecting``,
    ``close``, ``nao_criada``, ``nao_configurado``, ``nao_autorizado``,
    ``erro_evolution``, ``indisponivel`` ou ``desconhecido``.
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
        if resposta.status_code >= 400:
            erro = _classificar_erro(status_code=resposta.status_code)
            return {"configurado": True, "instancia": instancia, **erro}
        dados = resposta.json()
        estado = (dados.get("instance") or {}).get("state") or dados.get("state") or "desconhecido"
        return {"configurado": True, "estado": estado, "instancia": instancia}
    except Exception as exc:  # noqa: BLE001 — degrada com elegância
        erro = _classificar_erro(exc=exc)
        return {"configurado": True, "instancia": instancia, **erro}


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


def _resposta_qr(qr: dict) -> dict:
    return {
        "estado": "qr",
        "qr_base64": qr["qr_base64"],
        "pairing_code": qr["pairing_code"],
        "mensagem": "Escaneie o QR Code com o WhatsApp do número dedicado.",
    }


def _falha_conectar(estado, mensagem) -> dict:
    return {"estado": estado, "qr_base64": None, "pairing_code": None, "mensagem": mensagem}


def conectar() -> dict:
    """Garante a instância e devolve o QR Code para parear o número.

    Tenta conectar a instância existente; se não existe (404), cria. Se o connect
    vier SEM ``base64`` e SEM ``pairingCode`` (a Evolution às vezes só emite o QR
    após (re)criar), tenta criar uma vez antes de desistir. Retorna
    ``{"estado", "qr_base64", "pairing_code", "mensagem"}``; em erro, ``estado``
    indica o problema e ``qr_base64`` é ``None``. Nunca levanta exceção.
    """
    instancia = getattr(settings, "EVOLUTION_INSTANCE", "")
    if not _configurado():
        return _falha_conectar(
            "nao_configurado",
            "Bot não configurado. Defina EVOLUTION_URL, EVOLUTION_API_KEY e EVOLUTION_INSTANCE no .env.",
        )

    import requests

    try:
        # Já conectado? Não precisa de QR.
        if estado_conexao().get("estado") == "open":
            return _falha_conectar("open", "WhatsApp já está conectado.")

        resposta = requests.get(
            _url(f"/instance/connect/{instancia}"),
            headers=_headers(),
            timeout=TIMEOUT_SEGUNDOS,
        )
        # Instância ainda não existe → cria (a criação já devolve o QR).
        if resposta.status_code == 404:
            resposta = _criar_instancia()
        if resposta.status_code in (401, 403) or resposta.status_code >= 500:
            return _falha_conectar(**_classificar_erro(status_code=resposta.status_code))
        resposta.raise_for_status()

        qr = _extrair_qr(resposta.json())
        if qr["qr_base64"] or qr["pairing_code"]:
            return _resposta_qr(qr)

        # Sem QR no connect: tenta recriar a instância uma vez (caso comum na v2).
        logger.info("Connect sem QR; tentando (re)criar a instância da Evolution.")
        recriar = _criar_instancia()
        if recriar.status_code in (401, 403) or recriar.status_code >= 500:
            return _falha_conectar(**_classificar_erro(status_code=recriar.status_code))
        if recriar.ok:
            qr = _extrair_qr(recriar.json())
            if qr["qr_base64"] or qr["pairing_code"]:
                return _resposta_qr(qr)

        return _falha_conectar(
            "indisponivel",
            "A Evolution não retornou o QR Code. Tente novamente em instantes.",
        )
    except Exception as exc:  # noqa: BLE001 — degrada com elegância
        return _falha_conectar(**_classificar_erro(exc=exc))


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
