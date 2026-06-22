"""Interpretador de comandos do bot de WhatsApp do DONO (privado).

A função pura :func:`interpretar` recebe o texto de uma mensagem do dono, faz o
trabalho de banco (consulta/ajuste de estoque) e devolve a resposta em PT-BR —
sem HTTP, para ser testável diretamente.

Comandos (case-insensitive, tolerante a acentos):
- ``estoque <peça>``            → lista variações e estoque das peças que casam.
- ``baixa <qtd> <peça> <tam> <cor>``  → subtrai do estoque (nunca abaixo de 0).
- ``repor <qtd> <peça> <tam> <cor>``  → soma ao estoque.
- ``ajuda`` / ``help`` / qualquer outra coisa → mensagem de ajuda.

Resolução de variação (baixa/repor): o ÚLTIMO token é a ``cor``, o penúltimo é o
``tamanho`` e os tokens iniciais formam o nome da peça. Casamento por
``nome icontains`` + ``tamanho iexact`` + ``cor iexact``. Se 0 ou >1 variações
casarem, pede para o dono ser mais específico (mostrando candidatos).

Segurança: nenhum dado sensível é logado por este módulo (só fala estoque).
"""

import unicodedata

from django.db import transaction

from .models import Peca, Variacao
from .notificacoes import checar_estoque_baixo

# Quantos itens listar no máximo, para não estourar a mensagem.
MAX_LISTAGEM = 30

TEXTO_AJUDA = (
    "🤖 Comandos disponíveis:\n"
    "• estoque <peça>\n"
    "   ex.: estoque Vestido Floral\n"
    "• baixa <qtd> <peça> <tamanho> <cor>\n"
    "   ex.: baixa 1 Vestido Floral P Azul\n"
    "• repor <qtd> <peça> <tamanho> <cor>\n"
    "   ex.: repor 2 Vestido Floral P Azul\n"
    "• ajuda\n"
    "Obs.: no baixa/repor, a última palavra é a COR e a penúltima é o TAMANHO; "
    "o resto é o nome da peça."
)


def _normalizar(texto: str) -> str:
    """Minúsculas + sem acentos (para comparar palavras-chave de comando)."""
    texto = unicodedata.normalize("NFKD", texto)
    texto = "".join(c for c in texto if not unicodedata.combining(c))
    return texto.casefold()


def _rotulo(variacao) -> str:
    """Ex.: 'P/Azul' (ignora tamanho/cor vazios)."""
    partes = [p for p in (variacao.tamanho, variacao.cor) if p]
    return "/".join(partes) if partes else "(sem variação)"


def interpretar(texto: str) -> str:
    """Interpreta ``texto`` e devolve a resposta do bot (PT-BR)."""
    texto = (texto or "").strip()
    if not texto:
        return TEXTO_AJUDA

    palavras = texto.split()
    comando = _normalizar(palavras[0])
    resto = palavras[1:]

    if comando == "estoque":
        return _cmd_estoque(" ".join(resto).strip())
    if comando == "baixa":
        return _cmd_ajuste(resto, sinal=-1)
    if comando == "repor":
        return _cmd_ajuste(resto, sinal=+1)
    return TEXTO_AJUDA


# --------------------------------------------------------------------------
# estoque <peça>
# --------------------------------------------------------------------------


def _cmd_estoque(nome: str) -> str:
    if not nome:
        return TEXTO_AJUDA

    pecas = list(
        Peca.objects.filter(nome__icontains=nome)
        .prefetch_related("variacoes")
        .order_by("nome")[:MAX_LISTAGEM]
    )
    if not pecas:
        return f"Nenhuma peça encontrada para '{nome}'."

    blocos = []
    for peca in pecas:
        linhas = [f"{peca.nome}:"]
        variacoes = list(peca.variacoes.all())
        if not variacoes:
            linhas.append("• (sem variações)")
        for variacao in variacoes:
            marca = " (esgotado)" if variacao.estoque == 0 else ""
            linhas.append(f"• {_rotulo(variacao)}: {variacao.estoque}{marca}")
        blocos.append("\n".join(linhas))
    return "\n\n".join(blocos)


# --------------------------------------------------------------------------
# baixa <qtd> <resto>  /  repor <qtd> <resto>
# --------------------------------------------------------------------------


def _cmd_ajuste(tokens, sinal: int) -> str:
    acao = "baixa" if sinal < 0 else "repor"
    if not tokens:
        return TEXTO_AJUDA

    # qtd deve ser inteiro positivo.
    try:
        qtd = int(tokens[0])
    except ValueError:
        return TEXTO_AJUDA
    if qtd <= 0:
        return f"A quantidade do '{acao}' deve ser um número inteiro positivo."

    # resto: peça (vários tokens) + tamanho (penúltimo) + cor (último).
    resto = tokens[1:]
    if len(resto) < 3:
        return (
            "Faltam dados. Use: "
            f"{acao} <qtd> <peça> <tamanho> <cor>\n"
            f"ex.: {acao} {qtd} Vestido Floral P Azul"
        )

    cor = resto[-1]
    tamanho = resto[-2]
    nome = " ".join(resto[:-2]).strip()

    variacoes = list(
        Variacao.objects.select_related("peca").filter(
            peca__nome__icontains=nome,
            tamanho__iexact=tamanho,
            cor__iexact=cor,
        )
    )

    if not variacoes:
        return (
            f"Nenhuma variação encontrada para '{nome}' tamanho '{tamanho}' "
            f"cor '{cor}'. Confira o nome/tamanho/cor."
        )
    if len(variacoes) > 1:
        candidatos = "\n".join(
            f"• {v.peca.nome} {_rotulo(v)} (estoque {v.estoque})"
            for v in variacoes[:MAX_LISTAGEM]
        )
        return (
            "Encontrei mais de uma variação. Seja mais específico:\n" + candidatos
        )

    variacao_id = variacoes[0].id

    with transaction.atomic():
        variacao = Variacao.objects.select_for_update().select_related("peca").get(
            pk=variacao_id
        )
        if sinal < 0 and qtd > variacao.estoque:
            return (
                f"Estoque insuficiente: {variacao.peca.nome} {_rotulo(variacao)} "
                f"tem {variacao.estoque}. Não dá para baixar {qtd} (não pode ficar "
                "negativo)."
            )
        variacao.estoque += sinal * qtd
        variacao.save(update_fields=["estoque"])

    resposta = (
        f"OK! {variacao.peca.nome} {_rotulo(variacao)}: "
        f"estoque agora {variacao.estoque}."
    )

    if sinal < 0:
        # Alerta de estoque baixo reutilizando a regra de B.
        checar_estoque_baixo([variacao])

    return resposta
