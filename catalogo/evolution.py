"""Gerência da instância da Evolution API (parear o WhatsApp do dono).

Usado pelo painel admin para criar a instância e exibir o QR Code de conexão.
O backend funciona como PROXY: ele guarda a ``EVOLUTION_API_KEY`` (segredo) e a
envia para a Evolution; o navegador NUNCA recebe a chave. Todas as funções
degradam com elegância (não levantam exceção) e nunca logam o segredo nem o QR.

Endpoints da Evolution v2 usados:
- ``GET  /instance/connectionState/{instance}`` — estado da conexão.
- ``GET  /instance/connect/{instance}`` — QR/pareamento de uma instância existente.
- ``POST /instance/create`` — cria a instância (e já devolve o QR).
- ``POST /webhook/set/{instance}`` — garante webhook de mensagens recebidas.
- ``DELETE /instance/delete/{instance}`` — remove a instância (para recriar limpa).
- ``DELETE /instance/logout/{instance}`` — desconecta o número.
"""

import logging
import os

from django.conf import settings

logger = logging.getLogger(__name__)

TIMEOUT_SEGUNDOS = 15
# QR às vezes é emitido logo após criar a instância: tentativas/espera curtas.
QR_TENTATIVAS = 3
QR_ESPERA_SEGUNDOS = 2




def _so_digitos(valor) -> str:
    """Devolve apenas os digitos de ``valor`` (str)."""
    return "".join(c for c in str(valor or "") if c.isdigit())


def whatsapp_dono_atual() -> dict:
    """Numero autorizado atual para receber avisos e comandar o bot."""
    numeros = [_so_digitos(n) for n in getattr(settings, "WHATSAPP_DONO", [])]
    numeros = [n for n in numeros if n]
    numero = numeros[0] if numeros else ""
    return {"numero": numero, "configurado": bool(numero)}


def _salvar_env(chave: str, valor: str) -> bool:
    """Atualiza uma chave simples no .env da raiz. Retorna False se nao houver .env."""
    env_path = settings.BASE_DIR / ".env"
    if not env_path.exists():
        return False
    linhas = env_path.read_text(encoding="utf-8").splitlines()
    prefixo = f"{chave}="
    nova_linha = f"{chave}={valor}"
    for i, linha in enumerate(linhas):
        if linha.startswith(prefixo):
            linhas[i] = nova_linha
            break
    else:
        if linhas and linhas[-1].strip():
            linhas.append("")
        linhas.append(nova_linha)
    env_path.write_text("\n".join(linhas) + "\n", encoding="utf-8")
    return True


def atualizar_whatsapp_dono(numero: str) -> dict:
    """Valida, persiste no .env e aplica em memoria o numero do dono."""
    digitos = _so_digitos(numero)
    if not 10 <= len(digitos) <= 15:
        raise ValueError("Informe o numero em formato internacional, com DDI e DDD.")

    _salvar_env("WHATSAPP_DONO", digitos)
    os.environ["WHATSAPP_DONO"] = digitos
    settings.WHATSAPP_DONO = [digitos]
    return whatsapp_dono_atual()

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

    if status_code == 401:
        # Chave inválida na Evolution responde 401 (NÃO 403). Só aqui é "chave inválida".
        logger.warning("Evolution recusou a chave (status 401).")
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
    if status_code == 403:
        # 403 na Evolution é regra de negócio (ex.: "instância já existe"), NUNCA
        # chave inválida (essa dá 401). Não confundir o dono com "chave inválida".
        logger.warning("Evolution recusou a operação (status 403).")
        return {
            "estado": "erro_evolution",
            "mensagem": "A Evolution recusou a operação. Tente novamente em instantes.",
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


def _deletar_instancia() -> None:
    """Remove a instância (best-effort). Engole qualquer falha — é só limpeza."""
    import requests

    try:
        requests.delete(
            _url(f"/instance/delete/{settings.EVOLUTION_INSTANCE}"),
            headers=_headers(),
            timeout=TIMEOUT_SEGUNDOS,
        )
    except Exception:  # noqa: BLE001 — limpeza opcional, nunca quebra o fluxo
        logger.info("Falha ao remover a instância antiga da Evolution (ignorado).")


def _configurar_webhook() -> bool:
    """Garante o webhook de entrada da instância na Evolution (best-effort)."""
    import requests

    url = getattr(
        settings,
        "EVOLUTION_WEBHOOK_URL",
        "http://backend:8000/api/webhooks/whatsapp/",
    )
    payload = {
        "webhook": {
            "enabled": True,
            "url": url,
            "webhookByEvents": False,
            "events": ["MESSAGES_UPSERT"],
        }
    }
    try:
        resposta = requests.post(
            _url(f"/webhook/set/{settings.EVOLUTION_INSTANCE}"),
            json=payload,
            headers=_headers(),
            timeout=TIMEOUT_SEGUNDOS,
        )
        if resposta.status_code >= 400:
            logger.warning(
                "Falha ao configurar webhook da Evolution (status %s).",
                resposta.status_code,
            )
            return False
        return True
    except Exception:  # noqa: BLE001 — webhook não pode quebrar pareamento
        logger.warning("Falha ao configurar webhook da Evolution.")
        return False


def _criar_e_responder() -> dict:
    """Cria a instância e devolve o QR. Classifica erros sem vazar segredos.

    Após criar, o QR às vezes é emitido de forma assíncrona: se não veio na
    resposta do create, busca-o no ``/instance/connect`` por algumas tentativas
    curtas. Se ainda assim não houver QR, devolve ``aguardando_qr`` (a sessão
    não está conectando ao WhatsApp — ver EVOLUTION_WA_VERSION no README).
    """
    import time

    import requests

    resposta = _criar_instancia()
    # 403 "instância já existe" (delete anterior ainda não propagou): apaga e recria.
    if resposta.status_code == 403:
        _deletar_instancia()
        time.sleep(QR_ESPERA_SEGUNDOS)
        resposta = _criar_instancia()
    if resposta.status_code == 401 or resposta.status_code == 403 or resposta.status_code >= 500:
        return _falha_conectar(**_classificar_erro(status_code=resposta.status_code))
    if resposta.ok:
        qr = _extrair_qr(resposta.json())
        if qr["qr_base64"] or qr["pairing_code"]:
            return _resposta_qr(qr)

    # QR assíncrono: tenta buscá-lo no connect logo após a criação.
    instancia = settings.EVOLUTION_INSTANCE
    for tentativa in range(QR_TENTATIVAS):
        time.sleep(QR_ESPERA_SEGUNDOS)
        try:
            r = requests.get(
                _url(f"/instance/connect/{instancia}"),
                headers=_headers(),
                timeout=TIMEOUT_SEGUNDOS,
            )
        except Exception:  # noqa: BLE001
            break
        if r.ok:
            qr = _extrair_qr(r.json())
            if qr["qr_base64"] or qr["pairing_code"]:
                return _resposta_qr(qr)

    return _falha_conectar(
        "aguardando_qr",
        "A Evolution criou a sessão mas não emitiu o QR Code (não conecta ao "
        "WhatsApp). Geralmente é a versão do WhatsApp Web desatualizada — ajuste "
        "EVOLUTION_WA_VERSION e recrie o serviço (veja o README).",
    )


def _resposta_qr(qr: dict) -> dict:
    _configurar_webhook()
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

    Fluxo: se já conectado, nada a fazer. Senão pede o QR no ``/instance/connect``.
    Se a instância não existe (404), cria do zero (a criação devolve o QR). Se o
    connect responde mas vem SEM QR, a instância existe porém está presa (em geral
    em ``connecting``, sem emitir QR novo); então a instância é **recriada do zero**
    (delete + create) para forçar um QR — recriar com a instância existente daria
    403 "já existe", que NÃO é problema de chave. Retorna
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
            _configurar_webhook()
            return _falha_conectar("open", "WhatsApp já está conectado.")

        resposta = requests.get(
            _url(f"/instance/connect/{instancia}"),
            headers=_headers(),
            timeout=TIMEOUT_SEGUNDOS,
        )
        # Instância ainda não existe → cria do zero (a criação já devolve o QR).
        if resposta.status_code == 404:
            return _criar_e_responder()
        if resposta.status_code in (401, 403) or resposta.status_code >= 500:
            return _falha_conectar(**_classificar_erro(status_code=resposta.status_code))
        resposta.raise_for_status()

        qr = _extrair_qr(resposta.json())
        if qr["qr_base64"] or qr["pairing_code"]:
            return _resposta_qr(qr)

        # Connect sem QR: a instância existe mas não emite o QR (presa). Recria do
        # zero (delete + create) para forçar um QR novo.
        logger.info("Connect sem QR; recriando a instância da Evolution para forçar novo QR.")
        _deletar_instancia()
        return _criar_e_responder()
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
