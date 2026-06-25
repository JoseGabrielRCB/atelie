"""Motor de descontos (promoções automáticas + cupons) — SEMPRE no servidor.

Nunca confiar em preço/desconto/total vindos do cliente. Tudo é recalculado a
partir do banco. Regras (ver CLAUDE.md):
- Automática: aplica ao preço de exibição das peças no escopo (peça/categoria/tudo).
- Cupom: válido se vigente e o escopo casa com algum item do carrinho.
- Acúmulo: cupom ``acumulavel=True`` soma por cima da automática; senão vale o
  MAIOR desconto entre os dois. Total final nunca < 0.
"""

from decimal import Decimal, ROUND_HALF_UP

from django.db.models import F, Q
from django.utils import timezone

from .models import Promocao

CENTAVO = Decimal("0.01")
# Dinheiro arredonda para centavos com ROUND_HALF_UP (não o HALF_EVEN padrão do
# Decimal). Usado em todo o motor para o cálculo bater com a expectativa comercial.


def promocoes_automaticas_ativas(agora=None):
    """Promoções automáticas vigentes (ativas, no período, sem estourar usos)."""
    agora = agora or timezone.now()
    return list(
        Promocao.objects.filter(
            tipo_aplicacao=Promocao.TipoAplicacao.AUTOMATICA, ativo=True
        )
        .filter(Q(inicio__isnull=True) | Q(inicio__lte=agora))
        .filter(Q(fim__isnull=True) | Q(fim__gte=agora))
        .filter(Q(limite_uso__isnull=True) | Q(usos__lt=F("limite_uso")))
        .prefetch_related("pecas", "categorias")
    )


def melhor_automatica(peca, promos):
    """Promoção automática que dá o MAIOR desconto sobre ``peca`` (ou None)."""
    melhor = None
    melhor_desc = Decimal("0.00")
    for promo in promos:
        if not promo.casa_peca(peca):
            continue
        desc = promo.desconto_unitario(peca.preco)
        if desc > melhor_desc:
            melhor_desc = desc
            melhor = promo
    return melhor


def preco_com_promocao(peca, promos):
    """(preco_promocional, em_promocao) para a vitrine/detalhe. Sem promo → (preco, False)."""
    preco = Decimal(peca.preco)
    promo = melhor_automatica(peca, promos)
    if promo is None:
        return preco, False
    novo = (preco - promo.desconto_unitario(preco)).quantize(CENTAVO, rounding=ROUND_HALF_UP)
    return novo, novo < preco


def buscar_cupom(codigo):
    """Cupom (Promocao) pelo código normalizado, ou None."""
    codigo = (codigo or "").strip().upper()
    if not codigo:
        return None
    return (
        Promocao.objects.filter(
            tipo_aplicacao=Promocao.TipoAplicacao.CUPOM, codigo__iexact=codigo
        )
        .prefetch_related("pecas", "categorias")
        .first()
    )


def validar_cupom(codigo, itens, agora=None):
    """Valida o cupom contra os itens do carrinho.

    ``itens``: lista de dicts ``{"peca": Peca, "quantidade": int, "preco": Decimal}``.
    Retorna ``(cupom, None)`` se válido ou ``(None, "mensagem PT-BR")`` se não.
    """
    agora = agora or timezone.now()
    cupom = buscar_cupom(codigo)
    if cupom is None:
        return None, "Cupom inválido."
    if not cupom.ativo:
        return None, "Este cupom não está mais disponível."
    if cupom.inicio and agora < cupom.inicio:
        return None, "Este cupom ainda não está válido."
    if cupom.fim and agora > cupom.fim:
        return None, "Este cupom expirou."
    if cupom.limite_uso is not None and cupom.usos >= cupom.limite_uso:
        return None, "Este cupom esgotou o limite de usos."
    if not any(cupom.casa_peca(item["peca"]) for item in itens):
        return None, "Este cupom não vale para os itens do carrinho."
    return cupom, None


def _desconto_cupom(cupom, itens, precos_base):
    """Desconto (R$) do cupom sobre os itens no escopo, usando ``precos_base[i]``.

    Percentual: aplica % em cada item do escopo. Valor (R$): abate uma vez do
    subtotal dos itens do escopo (nunca além dele).
    """
    if cupom.tipo_desconto == Promocao.TipoDesconto.PERCENTUAL:
        total = Decimal("0.00")
        for item, base in zip(itens, precos_base):
            if cupom.casa_peca(item["peca"]):
                total += (base * item["quantidade"] * cupom.valor / Decimal(100))
        return total.quantize(CENTAVO, rounding=ROUND_HALF_UP)
    # Valor fixo: abate do subtotal (no escopo), limitado a ele.
    subtotal = sum(
        (base * item["quantidade"] for item, base in zip(itens, precos_base) if cupom.casa_peca(item["peca"])),
        Decimal("0.00"),
    )
    return min(cupom.valor, subtotal).quantize(CENTAVO, rounding=ROUND_HALF_UP)


def calcular(itens, cupom=None, promos_auto=None, agora=None):
    """Calcula bruto, descontos e total final dos ``itens``.

    ``itens``: ``[{"peca", "quantidade", "preco"}]`` (preço de catálogo do banco).
    Devolve dict: ``bruto``, ``desconto_auto``, ``desconto_cupom``, ``desconto``,
    ``total`` (nunca < 0).
    """
    agora = agora or timezone.now()
    if promos_auto is None:
        promos_auto = promocoes_automaticas_ativas(agora)

    bruto = Decimal("0.00")
    desconto_auto = Decimal("0.00")
    precos_pos_auto = []  # preço unitário após a melhor automática (p/ acúmulo)
    for item in itens:
        preco = Decimal(item["preco"])
        promo = melhor_automatica(item["peca"], promos_auto)
        desc_unit = promo.desconto_unitario(preco) if promo else Decimal("0.00")
        bruto += preco * item["quantidade"]
        desconto_auto += desc_unit * item["quantidade"]
        precos_pos_auto.append(preco - desc_unit)

    desconto_cupom = Decimal("0.00")
    if cupom is not None:
        if cupom.acumulavel:
            # Soma: cupom incide sobre os preços já com a automática.
            desconto_cupom = _desconto_cupom(cupom, itens, precos_pos_auto)
            desconto = desconto_auto + desconto_cupom
        else:
            # Não soma: vale o MAIOR entre automática e cupom (sobre preço cheio).
            base_cheio = [Decimal(i["preco"]) for i in itens]
            desconto_cupom = _desconto_cupom(cupom, itens, base_cheio)
            if desconto_cupom >= desconto_auto:
                desconto = desconto_cupom
                desconto_auto = Decimal("0.00")  # foi substituída pelo cupom
            else:
                desconto = desconto_auto
                desconto_cupom = Decimal("0.00")
    else:
        desconto = desconto_auto

    desconto = min(desconto, bruto).quantize(CENTAVO, rounding=ROUND_HALF_UP)
    total = (bruto - desconto).quantize(CENTAVO, rounding=ROUND_HALF_UP)
    if total < 0:
        total = Decimal("0.00")
    return {
        "bruto": bruto.quantize(CENTAVO, rounding=ROUND_HALF_UP),
        "desconto_auto": desconto_auto.quantize(CENTAVO, rounding=ROUND_HALF_UP),
        "desconto_cupom": desconto_cupom.quantize(CENTAVO, rounding=ROUND_HALF_UP),
        "desconto": desconto,
        "total": total,
    }
