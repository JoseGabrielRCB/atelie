"""Relatórios financeiros — agregações no servidor (sem mudança de schema).

Tudo é calculado a partir de ``Pedido`` com ``status="pago"`` + ``ItemPedido`` +
o cupom (``Pedido.cupom``/``Pedido.desconto``). Nunca confia em valores do
cliente. Respeita o fuso de ``settings.TIME_ZONE`` (os instantes são gravados em
UTC; aqui agrupamos/filtramos pelo dia LOCAL).

Quatro relatórios:
- ``vendas_por_periodo`` — faturamento e nº de pedidos pagos, por dia/semana/mês.
- ``produtos_mais_vendidos`` — ranking de variações por quantidade e receita.
- ``resumo_do_mes`` — faturamento, nº de vendas, ticket médio, desconto concedido
  e a análise de cupons (quais foram usados, nº de usos e valor descontado).
- ``financeiro`` — visão consolidada (Fase 1): KPIs com comparativo (período
  anterior de mesma duração) + DRE parcial. Campos de fases futuras (CMV, lucro
  bruto, margem, despesas, resultado operacional) vêm com ``disponivel=False`` e
  ``valor=None`` para não quebrar o contrato quando forem preenchidos depois.

Exportação: ``exportar(formato, ...)`` devolve um ``HttpResponse`` em CSV (nativo)
ou PDF (reportlab, import tardio). Os relatórios são agregados — não expõem dados
sensíveis do cliente (sem nome/contato/CPF).
"""

from datetime import date, datetime, time, timedelta
from decimal import ROUND_HALF_UP, Decimal
from pathlib import Path
from zoneinfo import ZoneInfo

from django.conf import settings
from django.db.models import Count, DecimalField, F, Sum
from django.db.models.functions import TruncDay, TruncMonth, TruncWeek
from django.http import HttpResponse
from django.utils import timezone

from .models import ItemPedido, Pedido

CENTAVO = Decimal("0.01")

# Granularidade aceita → função de truncamento do Django.
GRANULARIDADES = {"dia": TruncDay, "semana": TruncWeek, "mes": TruncMonth}


# --------------------------------------------------------------------------
# Datas / fuso
# --------------------------------------------------------------------------
def _tz():
    return ZoneInfo(settings.TIME_ZONE)


def _parse_data(valor):
    """``"AAAA-MM-DD"`` → ``date``; vazio → ``None``; inválido → ValueError."""
    if not valor:
        return None
    try:
        return datetime.strptime(str(valor), "%Y-%m-%d").date()
    except (ValueError, TypeError):
        raise ValueError("Data inválida. Use o formato AAAA-MM-DD.")


def _intervalo(de, ate):
    """Intervalo aware (local) a partir de ``de``/``ate`` (strings ou None).

    Default: últimos 30 dias (``ate`` = hoje, ``de`` = hoje − 29). Devolve
    ``(inicio_dt, fim_dt, de_date, ate_date)``.
    """
    tz = _tz()
    hoje = timezone.localdate()
    ate_date = _parse_data(ate) or hoje
    de_date = _parse_data(de) or (ate_date - timedelta(days=29))
    if de_date > ate_date:
        raise ValueError("A data inicial não pode ser depois da data final.")
    inicio = datetime.combine(de_date, time.min, tzinfo=tz)
    fim = datetime.combine(ate_date, time.max, tzinfo=tz)
    return inicio, fim, de_date, ate_date


def _mes_intervalo(mes):
    """``"AAAA-MM"`` (ou None = mês atual) → ``(primeiro_dia, inicio, fim)``."""
    tz = _tz()
    if mes:
        try:
            ano_s, mes_s = str(mes).split("-")
            primeiro = date(int(ano_s), int(mes_s), 1)
        except (ValueError, AttributeError):
            raise ValueError("Mês inválido. Use o formato AAAA-MM.")
    else:
        primeiro = timezone.localdate().replace(day=1)

    if primeiro.month == 12:
        prox = date(primeiro.year + 1, 1, 1)
    else:
        prox = date(primeiro.year, primeiro.month + 1, 1)

    inicio = datetime.combine(primeiro, time.min, tzinfo=tz)
    fim = datetime.combine(prox, time.min, tzinfo=tz) - timedelta(microseconds=1)
    return primeiro, inicio, fim


def data_br(iso):
    """``"AAAA-MM-DD"`` → ``"dd/mm/aaaa"`` (para títulos de exportação)."""
    try:
        return datetime.strptime(iso, "%Y-%m-%d").strftime("%d/%m/%Y")
    except (ValueError, TypeError):
        return iso


def _rotulo_periodo(dt_local, granularidade):
    if granularidade == "mes":
        return dt_local.strftime("%m/%Y")
    if granularidade == "semana":
        return "Semana de " + dt_local.strftime("%d/%m/%Y")
    return dt_local.strftime("%d/%m/%Y")


def _pedidos_pagos(inicio, fim):
    return Pedido.objects.filter(
        status=Pedido.Status.PAGO,
        criado_em__gte=inicio,
        criado_em__lte=fim,
    )


# --------------------------------------------------------------------------
# Relatórios
# --------------------------------------------------------------------------
def vendas_por_periodo(de=None, ate=None, granularidade="dia"):
    """Faturamento (R$) e nº de pedidos pagos no intervalo, agrupados no tempo."""
    gran = granularidade if granularidade in GRANULARIDADES else "dia"
    inicio, fim, de_date, ate_date = _intervalo(de, ate)
    tz = _tz()
    trunc = GRANULARIDADES[gran]

    linhas = (
        _pedidos_pagos(inicio, fim)
        .annotate(periodo=trunc("criado_em", tzinfo=tz))
        .values("periodo")
        .annotate(faturamento=Sum("total"), pedidos=Count("id"))
        .order_by("periodo")
    )

    series = []
    fat_total = Decimal("0.00")
    ped_total = 0
    for row in linhas:
        local = timezone.localtime(row["periodo"]) if row["periodo"] else None
        fat = (row["faturamento"] or Decimal("0")).quantize(CENTAVO)
        series.append(
            {
                "periodo": _rotulo_periodo(local, gran) if local else "-",
                "data": local.date().isoformat() if local else None,
                "faturamento": f"{fat:.2f}",
                "pedidos": row["pedidos"],
            }
        )
        fat_total += fat
        ped_total += row["pedidos"]

    ticket = (fat_total / ped_total).quantize(CENTAVO) if ped_total else Decimal("0.00")
    return {
        "de": de_date.isoformat(),
        "ate": ate_date.isoformat(),
        "granularidade": gran,
        "series": series,
        "totais": {
            "faturamento": f"{fat_total:.2f}",
            "pedidos": ped_total,
            "ticket_medio": f"{ticket:.2f}",
        },
    }


def produtos_mais_vendidos(de=None, ate=None, top=20):
    """Ranking das variações por quantidade (e receita) em pedidos pagos."""
    inicio, fim, de_date, ate_date = _intervalo(de, ate)
    try:
        top = max(1, min(int(top or 20), 100))
    except (ValueError, TypeError):
        top = 20

    linhas = (
        ItemPedido.objects.filter(
            pedido__status=Pedido.Status.PAGO,
            pedido__criado_em__gte=inicio,
            pedido__criado_em__lte=fim,
        )
        .values(
            "variacao_id",
            "variacao__peca__nome",
            "variacao__tamanho",
            "variacao__cor",
        )
        .annotate(
            qtd_total=Sum("quantidade"),
            receita=Sum(
                F("quantidade") * F("preco_unit"),
                output_field=DecimalField(max_digits=12, decimal_places=2),
            ),
        )
        .order_by("-qtd_total", "-receita")[:top]
    )

    itens = []
    for r in linhas:
        receita = (r["receita"] or Decimal("0")).quantize(CENTAVO)
        descricao = (
            " / ".join(p for p in [r["variacao__tamanho"], r["variacao__cor"]] if p)
            or "-"
        )
        itens.append(
            {
                "variacao_id": r["variacao_id"],
                "peca_nome": r["variacao__peca__nome"],
                "variacao_descricao": descricao,
                "quantidade": r["qtd_total"] or 0,
                "receita": f"{receita:.2f}",
            }
        )
    return {
        "de": de_date.isoformat(),
        "ate": ate_date.isoformat(),
        "top": top,
        "itens": itens,
    }


def resumo_do_mes(mes=None):
    """Faturamento, nº de vendas, ticket médio, desconto e análise de cupons."""
    primeiro, inicio, fim = _mes_intervalo(mes)
    pagos = _pedidos_pagos(inicio, fim)

    agg = pagos.aggregate(
        faturamento=Sum("total"), num=Count("id"), desconto=Sum("desconto")
    )
    faturamento = (agg["faturamento"] or Decimal("0")).quantize(CENTAVO)
    num = agg["num"] or 0
    desconto = (agg["desconto"] or Decimal("0")).quantize(CENTAVO)
    ticket = (faturamento / num).quantize(CENTAVO) if num else Decimal("0.00")

    # Análise de cupons: por cupom usado em pedidos PAGOS no mês, nº de usos e o
    # valor descontado (o `desconto` do pedido — total, automática + cupom).
    cupons = [
        {
            "nome": c["cupom__nome"],
            "codigo": c["cupom__codigo"],
            "usos": c["usos"],
            "valor_descontado": f"{(c['valor_descontado'] or Decimal('0')).quantize(CENTAVO):.2f}",
        }
        for c in (
            pagos.filter(cupom__isnull=False)
            .values("cupom_id", "cupom__nome", "cupom__codigo")
            .annotate(usos=Count("id"), valor_descontado=Sum("desconto"))
            .order_by("-valor_descontado")
        )
    ]

    return {
        "mes": primeiro.strftime("%Y-%m"),
        "mes_rotulo": primeiro.strftime("%m/%Y"),
        "faturamento": f"{faturamento:.2f}",
        "num_vendas": num,
        "ticket_medio": f"{ticket:.2f}",
        "desconto_concedido": f"{desconto:.2f}",
        "cupons": cupons,
    }


# --------------------------------------------------------------------------
# Visão financeira consolidada (Fase 1) — KPIs com comparativo + DRE parcial
# --------------------------------------------------------------------------
def _kpis_intervalo(inicio, fim):
    """Agrega faturamento, nº de vendas, ticket e desconto dos pedidos PAGOS."""
    agg = _pedidos_pagos(inicio, fim).aggregate(
        faturamento=Sum("total"), num=Count("id"), desconto=Sum("desconto")
    )
    faturamento = (agg["faturamento"] or Decimal("0")).quantize(CENTAVO)
    num = agg["num"] or 0
    desconto = (agg["desconto"] or Decimal("0")).quantize(CENTAVO)
    ticket = (faturamento / num).quantize(CENTAVO) if num else Decimal("0.00")
    return {"faturamento": faturamento, "num": num, "desconto": desconto, "ticket": ticket}


def _variacao_pct(atual, anterior):
    """``(atual−ant)/ant×100`` com 1 casa; ``None`` se ``ant == 0`` (sem base)."""
    atual = Decimal(str(atual))
    anterior = Decimal(str(anterior))
    if anterior == 0:
        return None
    pct = (atual - anterior) / anterior * Decimal("100")
    return float(pct.quantize(Decimal("0.1"), rounding=ROUND_HALF_UP))


def _taxa_recompra():
    """% de clientes (lifetime) com 2+ pedidos pagos. Definição FIXADA.

    Universo: clientes com pelo menos 1 pedido PAGO (em toda a vida da loja).
    Recompra: a fração desse universo com 2 ou mais pedidos pagos. É uma métrica
    de carteira — NÃO é recortada pelo período do filtro (por isso não tem
    comparativo de período no resumo). Devolve ``(taxa_decimal, total, recorrentes)``.
    """
    por_cliente = (
        Pedido.objects.filter(status=Pedido.Status.PAGO, cliente__isnull=False)
        .values("cliente_id")
        .annotate(n=Count("id"))
    )
    total = 0
    recorrentes = 0
    for row in por_cliente:
        total += 1
        if row["n"] >= 2:
            recorrentes += 1
    if not total:
        return Decimal("0.0"), 0, 0
    taxa = (Decimal(recorrentes) / Decimal(total) * Decimal("100")).quantize(
        Decimal("0.1"), rounding=ROUND_HALF_UP
    )
    return taxa, total, recorrentes


def _em_revisao(inicio, fim):
    """Total (R$) e nº de pedidos ``em_revisao`` criados no intervalo."""
    agg = Pedido.objects.filter(
        status=Pedido.Status.EM_REVISAO,
        criado_em__gte=inicio,
        criado_em__lte=fim,
    ).aggregate(total=Sum("total"), num=Count("id"))
    return (agg["total"] or Decimal("0")).quantize(CENTAVO), agg["num"] or 0


def cupons_por_periodo(de=None, ate=None):
    """Cupons usados em pedidos PAGOS no intervalo (nº de usos e valor descontado).

    Espelha a análise de cupons do ``resumo_do_mes``, mas para um intervalo de
    datas arbitrário (alimenta o detalhamento do PDF financeiro)."""
    inicio, fim, _de, _ate = _intervalo(de, ate)
    pagos = _pedidos_pagos(inicio, fim)
    return [
        {
            "nome": c["cupom__nome"],
            "codigo": c["cupom__codigo"],
            "usos": c["usos"],
            "valor_descontado": f"{(c['valor_descontado'] or Decimal('0')).quantize(CENTAVO):.2f}",
        }
        for c in (
            pagos.filter(cupom__isnull=False)
            .values("cupom_id", "cupom__nome", "cupom__codigo")
            .annotate(usos=Count("id"), valor_descontado=Sum("desconto"))
            .order_by("-valor_descontado")
        )
    ]


def financeiro(de=None, ate=None, granularidade="dia"):
    """Visão financeira consolidada (Fase 1): KPIs com comparativo + DRE parcial.

    - Receita bruta = Σ ``Pedido.total`` dos pedidos PAGOS no intervalo.
    - Comparativo = janela imediatamente anterior, de MESMA duração (em dias).
    - ``variacao_pct`` = ``(atual−ant)/ant×100`` (1 casa) ou ``None`` se ``ant=0``.
    - Pedidos ``em_revisao`` entram como linha INFORMATIVA (a estornar) — NÃO são
      deduzidos da receita.
    - Campos das Fases 2/3 (CMV, lucro bruto, margem, despesas, resultado) vêm
      com ``disponivel=False`` / ``valor=None`` (não quebram o contrato).
    - Os blocos de clientes/recompra são AGREGADOS (sem nome/contato/CPF — LGPD).
    """
    gran = granularidade if granularidade in GRANULARIDADES else "dia"
    inicio, fim, de_date, ate_date = _intervalo(de, ate)
    tz = _tz()

    # Janela anterior de mesma duração, imediatamente antes de `de`.
    dias = (ate_date - de_date).days + 1
    ate_ant = de_date - timedelta(days=1)
    de_ant = ate_ant - timedelta(days=dias - 1)
    inicio_ant = datetime.combine(de_ant, time.min, tzinfo=tz)
    fim_ant = datetime.combine(ate_ant, time.max, tzinfo=tz)

    atual = _kpis_intervalo(inicio, fim)
    anterior = _kpis_intervalo(inicio_ant, fim_ant)

    receita_liquida = (atual["faturamento"] - atual["desconto"]).quantize(CENTAVO)
    em_revisao_total, em_revisao_num = _em_revisao(inicio, fim)
    taxa, clientes_total, clientes_recorrentes = _taxa_recompra()

    def kpi(valor, valor_ant):
        bruto = f"{valor:.2f}" if isinstance(valor, Decimal) else valor
        return {
            "valor": bruto,
            "variacao_pct": _variacao_pct(valor, valor_ant),
            "disponivel": True,
        }

    indisponivel = {"valor": None, "variacao_pct": None, "disponivel": False}

    resumo = {
        "faturamento": kpi(atual["faturamento"], anterior["faturamento"]),
        "num_vendas": kpi(atual["num"], anterior["num"]),
        "ticket_medio": kpi(atual["ticket"], anterior["ticket"]),
        "descontos": kpi(atual["desconto"], anterior["desconto"]),
        "taxa_recompra": {
            "valor": f"{taxa:.1f}",
            "variacao_pct": None,  # carteira (lifetime) — sem período anterior
            "disponivel": True,
            "clientes": clientes_total,
            "recorrentes": clientes_recorrentes,
        },
        # Fase 2 (margem) — preenchidos quando houver custo das variações.
        "lucro_bruto": dict(indisponivel),
        "margem_pct": dict(indisponivel),
    }

    dre = [
        {"linha": "Receita bruta (vendas pagas)", "valor": f"{atual['faturamento']:.2f}", "disponivel": True},
        {"linha": "(-) Descontos concedidos", "valor": f"{atual['desconto']:.2f}", "disponivel": True},
        {"linha": "= Receita líquida", "valor": f"{receita_liquida:.2f}", "destaque": True, "disponivel": True},
        {"linha": "(-) CMV (custo dos produtos vendidos)", "valor": None, "disponivel": False},
        {"linha": "= Lucro bruto", "valor": None, "destaque": True, "disponivel": False},
        {"linha": "(-) Despesas operacionais", "valor": None, "disponivel": False},
        {"linha": "= Resultado operacional", "valor": None, "destaque": True, "disponivel": False},
        {
            "linha": "Pedidos em revisão (a estornar)",
            "valor": f"{em_revisao_total:.2f}",
            "informativo": True,  # NÃO é dedução da receita
            "disponivel": True,
        },
    ]

    return {
        "de": de_date.isoformat(),
        "ate": ate_date.isoformat(),
        "granularidade": gran,
        "comparativo": {"de": de_ant.isoformat(), "ate": ate_ant.isoformat()},
        "resumo": resumo,
        "dre": dre,
        "clientes": {
            "total": clientes_total,
            "recorrentes": clientes_recorrentes,
            "taxa_recompra": f"{taxa:.1f}",
        },
        "em_revisao": {"total": f"{em_revisao_total:.2f}", "num": em_revisao_num},
    }


# --------------------------------------------------------------------------
# Exportação (CSV nativo / PDF com reportlab — import tardio)
# --------------------------------------------------------------------------
def moeda_br(valor):
    """``"1234.56"`` (str/Decimal) → ``"1.234,56"`` (formato brasileiro)."""
    n = Decimal(str(valor or "0"))
    s = f"{n:,.2f}"  # 1,234.56
    return s.replace(",", "X").replace(".", ",").replace("X", ".")


def exportar(formato, nome, titulo, subtitulo, cabecalhos, linhas):
    """Devolve o relatório como arquivo: ``csv`` (nativo) ou ``pdf`` (reportlab)."""
    if formato == "pdf":
        return _pdf_response(nome, titulo, subtitulo, cabecalhos, linhas)
    return _csv_response(nome, cabecalhos, linhas)


def _csv_response(nome, cabecalhos, linhas):
    import csv
    import io

    buffer = io.StringIO()
    buffer.write("﻿")  # BOM: acentos corretos no Excel (PT-BR)
    escritor = csv.writer(buffer, delimiter=";")
    escritor.writerow(cabecalhos)
    escritor.writerows(linhas)

    resp = HttpResponse(buffer.getvalue(), content_type="text/csv; charset=utf-8")
    resp["Content-Disposition"] = f'attachment; filename="{nome}.csv"'
    return resp


def _pdf_response(nome, titulo, subtitulo, cabecalhos, linhas):
    import io

    # Import tardio: só carrega reportlab quando alguém exporta PDF.
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet
    from reportlab.lib.units import cm
    from reportlab.platypus import (
        Paragraph,
        SimpleDocTemplate,
        Spacer,
        Table,
        TableStyle,
    )

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        topMargin=1.5 * cm,
        bottomMargin=1.5 * cm,
        leftMargin=1.5 * cm,
        rightMargin=1.5 * cm,
        title=titulo,
    )
    estilos = getSampleStyleSheet()
    elementos = [Paragraph(titulo, estilos["Title"])]
    if subtitulo:
        elementos.append(Paragraph(subtitulo, estilos["Normal"]))
    elementos.append(Spacer(1, 0.5 * cm))

    dados = [list(cabecalhos)] + [[str(c) for c in linha] for linha in linhas]
    tabela = Table(dados, repeatRows=1)
    tabela.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#7e4e2e")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 9),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#d6cfc4")),
                (
                    "ROWBACKGROUNDS",
                    (0, 1),
                    (-1, -1),
                    [colors.white, colors.HexColor("#f7f5f1")],
                ),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    elementos.append(tabela)
    doc.build(elementos)

    resp = HttpResponse(buffer.getvalue(), content_type="application/pdf")
    resp["Content-Disposition"] = f'attachment; filename="{nome}.pdf"'
    return resp


# --------------------------------------------------------------------------
# PDF do relatório financeiro (layout rico, com a marca do Ateliê da Sete)
#
# Diferente do `_pdf_response` (tabela genérica usada pelos outros relatórios),
# aqui montamos um documento profissional: faixa de cabeçalho com logo, cartões
# de KPI, DRE estilizada, mini-gráfico de barras (matplotlib → PNG em memória) e
# tabelas de detalhamento. Tudo em PT-BR, sem dado pessoal, e sem dependência de
# sistema (reportlab + matplotlib são Python puro com wheels). Imports tardios.
# --------------------------------------------------------------------------
_LOGO = Path(__file__).resolve().parent / "assets" / "logo-atelie.png"

# Paleta (tokens do STYLE.md).
_MARCA = "#7e4e2e"
_MARCA_CLARA = "#b07a56"
_TEXTO = "#1a1816"
_TEXTO_SUAVE = "#57534e"
_BORDA = "#d6cfc4"
_FUNDO = "#f7f5f1"
_DESTAQUE = "#efe7df"
_VERDE = "#15803d"
_VERMELHO = "#b91c1c"
_AMBAR = "#9a6a16"

_FONTE_SIMBOLOS = None  # cache: nome da fonte registrada, ou False se indisponível


def _fonte_simbolos():
    """Registra (uma vez) a DejaVu Sans para os símbolos ▲/▼ dos KPIs.

    A Helvetica padrão do reportlab não tem esses glifos; reaproveitamos a fonte
    que vem com o matplotlib. Em falha, devolve ``None`` e o chamador usa ``+/-``.
    """
    global _FONTE_SIMBOLOS
    if _FONTE_SIMBOLOS is not None:
        return _FONTE_SIMBOLOS or None
    try:
        import os

        import matplotlib
        from reportlab.pdfbase import pdfmetrics
        from reportlab.pdfbase.ttfonts import TTFont

        ttf = os.path.join(matplotlib.get_data_path(), "fonts", "ttf", "DejaVuSans.ttf")
        pdfmetrics.registerFont(TTFont("AtelieSimbolos", ttf))
        _FONTE_SIMBOLOS = "AtelieSimbolos"
    except Exception:
        _FONTE_SIMBOLOS = False
    return _FONTE_SIMBOLOS or None


def _grafico_faturamento_png(series):
    """PNG (bytes) de um gráfico de barras do faturamento por período.

    Renderiza com matplotlib no backend ``Agg`` (sem display), em memória. Devolve
    ``None`` se não houver dados ou se o matplotlib falhar (o PDF sai sem o gráfico).
    """
    if not series:
        return None
    try:
        import io
        from math import ceil

        import matplotlib

        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
        from matplotlib.ticker import FuncFormatter

        rotulos = [s["periodo"] for s in series]
        valores = [float(s["faturamento"]) for s in series]
        n = len(series)
        # Largura cresce com os dados, mas com teto (não gerar PNG gigante).
        larg = max(5.0, min(11.0, 0.45 * n + 2.2))

        fig, ax = plt.subplots(figsize=(larg, 2.8), dpi=150)
        x = range(n)
        if n <= 14:
            # Poucos períodos: barras (comparação direta e clara).
            ax.bar(x, valores, color=_MARCA, width=0.62)
        else:
            # Muitos períodos: linha + área preenchida — escala bem melhor que
            # dezenas de barras finas espremidas.
            ax.fill_between(x, valores, color=_MARCA, alpha=0.16)
            ax.plot(x, valores, color=_MARCA, linewidth=1.6)
            ax.set_xlim(0, n - 1)

        # Rótulos do eixo X afinados: no máximo ~12 marcas, sem sobreposição.
        passo = max(1, ceil(n / 12))
        ticks = list(range(0, n, passo))
        if ticks and ticks[-1] != n - 1:
            ticks.append(n - 1)
        ax.set_xticks(ticks)
        ax.set_xticklabels(
            [rotulos[i] for i in ticks], rotation=30, ha="right", fontsize=7, color=_TEXTO_SUAVE
        )
        ax.tick_params(axis="y", labelsize=7, colors=_TEXTO_SUAVE, length=0)
        ax.yaxis.set_major_formatter(
            FuncFormatter(lambda v, _p: f"{v/1000:.0f}k" if v >= 1000 else f"{v:.0f}")
        )
        ax.grid(axis="y", color=_BORDA, linewidth=0.6, alpha=0.7)
        ax.set_axisbelow(True)
        ax.set_ylim(bottom=0)
        for lado in ("top", "right", "left"):
            ax.spines[lado].set_visible(False)
        ax.spines["bottom"].set_color(_BORDA)
        ax.margins(x=0.02)
        fig.tight_layout()

        buf = io.BytesIO()
        fig.savefig(buf, format="png", bbox_inches="tight")
        plt.close(fig)
        return buf.getvalue()
    except Exception:
        return None


def _kpi_variacao(pct, sentido):
    """Cor + texto da variação do KPI (▲ verde / ▼ vermelho; âmbar p/ 'neutro')."""
    if pct is None:
        return _TEXTO_SUAVE, "sem base"
    if pct == 0:
        return _TEXTO_SUAVE, "estável"
    subiu = pct > 0
    if sentido == "neutro":
        cor = _AMBAR
    else:
        cor = _VERDE if subiu else _VERMELHO
    valor = f"{abs(pct):.1f}".replace(".", ",")
    simbolos = _fonte_simbolos()
    if simbolos:
        seta = f'<font name="{simbolos}">{"▲" if subiu else "▼"}</font> '
    else:
        seta = "+" if subiu else "-"
    return cor, f"{seta}{valor}%"


def gerar_pdf_financeiro(dados, series=None, produtos=None, cupons=None):
    """Monta o PDF rico do relatório financeiro e devolve um ``HttpResponse``.

    ``dados`` = saída de :func:`financeiro`. ``series``/``produtos`` = saídas de
    :func:`vendas_por_periodo`/:func:`produtos_mais_vendidos`; ``cupons`` =
    :func:`cupons_por_periodo` (alimentam gráfico/detalhamento — NÃO mudam o JSON).
    """
    import io

    from reportlab.lib import colors
    from reportlab.lib.enums import TA_CENTER, TA_RIGHT
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import ParagraphStyle
    from reportlab.lib.units import cm
    from reportlab.lib.utils import ImageReader
    from reportlab.pdfgen import canvas
    from reportlab.platypus import (
        Image,
        Paragraph,
        SimpleDocTemplate,
        Spacer,
        Table,
        TableStyle,
    )

    LARGURA, ALTURA = A4
    MARGEM = 1.5 * cm
    BANDA = 2.6 * cm
    RODAPE_Y = 1.0 * cm
    CONTEUDO = LARGURA - 2 * MARGEM
    FONTE, FONTE_B = "Helvetica", "Helvetica-Bold"

    gerado = timezone.localtime().strftime("%d/%m/%Y %H:%M")
    periodo_txt = f"{data_br(dados['de'])} a {data_br(dados['ate'])}"

    def cor(h):
        return colors.HexColor(h)

    # ---- Cabeçalho (faixa) + base do rodapé, em cada página ----
    def _faixa(c, _doc):
        c.saveState()
        c.setFillColor(cor(_MARCA))
        c.rect(0, ALTURA - BANDA, LARGURA, BANDA, fill=1, stroke=0)
        meio = ALTURA - BANDA / 2
        x = MARGEM
        if _LOGO.exists():
            try:
                logo = ImageReader(str(_LOGO))
                iw, ih = logo.getSize()
                h = 1.35 * cm
                w = h * iw / ih
                c.drawImage(
                    logo, MARGEM, meio - h / 2, width=w, height=h,
                    mask="auto", preserveAspectRatio=True,
                )
                x = MARGEM + w + 0.45 * cm
            except Exception:
                pass
        c.setFillColor(colors.white)
        c.setFont(FONTE_B, 16)
        c.drawString(x, meio + 2, "Relatório Financeiro")
        c.setFont(FONTE, 9)
        c.drawString(x, meio - 11, f"Período: {periodo_txt}")
        c.setFont(FONTE_B, 10)
        c.drawRightString(LARGURA - MARGEM, meio + 3, "Ateliê da Sete")
        c.setFont(FONTE, 8)
        c.drawRightString(LARGURA - MARGEM, meio - 10, f"Gerado em {gerado}")
        # Linha + texto fixo do rodapé (o número da página entra no _Canvas).
        c.setStrokeColor(cor(_BORDA))
        c.setLineWidth(0.5)
        c.line(MARGEM, RODAPE_Y + 0.42 * cm, LARGURA - MARGEM, RODAPE_Y + 0.42 * cm)
        c.setFillColor(cor(_TEXTO_SUAVE))
        c.setFont(FONTE, 8)
        c.drawString(MARGEM, RODAPE_Y, "Ateliê da Sete · Confidencial · uso interno")
        c.restoreState()

    # Canvas que numera "Página X de Y" (precisa do total → desenha no save).
    class _Canvas(canvas.Canvas):
        def __init__(self, *a, **k):
            super().__init__(*a, **k)
            self._paginas = []

        def showPage(self):
            self._paginas.append(dict(self.__dict__))
            self._startPage()

        def save(self):
            total = len(self._paginas)
            for estado in self._paginas:
                self.__dict__.update(estado)
                self.setFont(FONTE, 8)
                self.setFillColor(cor(_TEXTO_SUAVE))
                self.drawRightString(
                    LARGURA - MARGEM, RODAPE_Y, f"Página {self._pageNumber} de {total}"
                )
                super().showPage()
            super().save()

    # ---- Estilos ----
    st_titulo = ParagraphStyle(
        "h2", fontName=FONTE_B, fontSize=11.5, textColor=cor(_MARCA),
        spaceBefore=10, spaceAfter=6, leading=14,
    )
    st_legenda = ParagraphStyle(
        "leg", fontName=FONTE, fontSize=7.5, textColor=cor(_TEXTO_SUAVE), leading=10,
    )
    st_kpi = ParagraphStyle("kpi", fontName=FONTE, alignment=TA_CENTER, leading=18)
    st_desc = ParagraphStyle(
        "dre", fontName=FONTE, fontSize=9.5, textColor=cor(_TEXTO_SUAVE), leading=12
    )
    st_desc_b = ParagraphStyle("dreb", parent=st_desc, fontName=FONTE_B, textColor=cor(_TEXTO))
    st_val = ParagraphStyle("dval", parent=st_desc, alignment=TA_RIGHT)
    st_val_b = ParagraphStyle("dvalb", parent=st_desc_b, alignment=TA_RIGHT)
    st_info = ParagraphStyle(
        "dinfo", parent=st_desc, fontSize=8.5, textColor=cor(_TEXTO_SUAVE)
    )
    st_info_v = ParagraphStyle("dinfov", parent=st_info, alignment=TA_RIGHT)

    # ---- Bloco B: cartões de KPI ----
    r = dados["resumo"]
    kpis = [
        ("Faturamento", f"R$ {moeda_br(r['faturamento']['valor'])}", r["faturamento"]["variacao_pct"], "positivo"),
        ("Nº de vendas", str(r["num_vendas"]["valor"]), r["num_vendas"]["variacao_pct"], "positivo"),
        ("Ticket médio", f"R$ {moeda_br(r['ticket_medio']['valor'])}", r["ticket_medio"]["variacao_pct"], "positivo"),
        ("Descontos", f"R$ {moeda_br(r['descontos']['valor'])}", r["descontos"]["variacao_pct"], "neutro"),
        ("Recompra", f"{r['taxa_recompra']['valor']}%", r["taxa_recompra"]["variacao_pct"], "positivo"),
    ]
    celulas = []
    for rotulo, valor, pct, sentido in kpis:
        cvar, tvar = _kpi_variacao(pct, sentido)
        celulas.append(
            Paragraph(
                f'<font size="7" color="{_TEXTO_SUAVE}">{rotulo.upper()}</font><br/>'
                f'<font size="14" color="{_TEXTO}"><b>{valor}</b></font><br/>'
                f'<font size="8" color="{cvar}">{tvar}</font>',
                st_kpi,
            )
        )
    kpi_tbl = Table([celulas], colWidths=[CONTEUDO / 5] * 5)
    kpi_tbl.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), colors.white),
                ("BOX", (0, 0), (-1, -1), 0.6, cor(_BORDA)),
                ("INNERGRID", (0, 0), (-1, -1), 0.6, cor(_BORDA)),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("TOPPADDING", (0, 0), (-1, -1), 9),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 9),
                ("LEFTPADDING", (0, 0), (-1, -1), 4),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )

    # ---- Bloco C: DRE estilizada ----
    linhas, cmds = [], [
        ("LINEBELOW", (0, 0), (-1, -1), 0.4, cor(_BORDA)),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 9),
        ("RIGHTPADDING", (0, 0), (-1, -1), 9),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]
    for i, item in enumerate(dados["dre"]):
        disp, val = item.get("disponivel"), item.get("valor")
        if disp and val is not None:
            valor_txt = f"R$ {moeda_br(val)}"
        elif not disp:
            valor_txt = "em breve"
        else:
            valor_txt = "-"
        if item.get("informativo"):
            cmds.append(("LINEABOVE", (0, i), (-1, i), 0.8, cor(_MARCA_CLARA)))
            cmds.append(("TOPPADDING", (0, i), (-1, i), 9))
            linhas.append([Paragraph(item["linha"], st_info), Paragraph(valor_txt, st_info_v)])
            continue
        destaque = item.get("destaque")
        d_st = st_desc_b if destaque else st_desc
        v_st = st_val_b if destaque else st_val
        if not disp:
            v_st = ParagraphStyle(f"fut{i}", parent=v_st, fontName=FONTE, textColor=cor(_TEXTO_SUAVE))
        if destaque:
            cmds.append(("BACKGROUND", (0, i), (-1, i), cor(_DESTAQUE)))
        elif i % 2 == 1:
            cmds.append(("BACKGROUND", (0, i), (-1, i), cor(_FUNDO)))
        linhas.append([Paragraph(item["linha"], d_st), Paragraph(valor_txt, v_st)])
    dre_tbl = Table(linhas, colWidths=[CONTEUDO * 0.7, CONTEUDO * 0.3])
    dre_tbl.setStyle(TableStyle(cmds))

    # ---- Bloco D: tabelas de detalhamento ----
    def _tabela(cabecalhos, dados_linhas, aligns, larguras):
        th = ParagraphStyle("th", fontName=FONTE_B, fontSize=8.5, textColor=colors.white, leading=11)
        td = ParagraphStyle("td", fontName=FONTE, fontSize=8.5, textColor=cor(_TEXTO), leading=11)
        td_r = ParagraphStyle("tdr", parent=td, alignment=TA_RIGHT)
        corpo = [[Paragraph(str(c), th) for c in cabecalhos]]
        for linha in dados_linhas:
            corpo.append(
                [Paragraph(str(v), td_r if aligns[j] == "r" else td) for j, v in enumerate(linha)]
            )
        t = Table(corpo, repeatRows=1, colWidths=[CONTEUDO * f for f in larguras])
        t.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), cor(_MARCA)),
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                    ("GRID", (0, 0), (-1, -1), 0.4, cor(_BORDA)),
                    ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, cor(_FUNDO)]),
                    ("TOPPADDING", (0, 0), (-1, -1), 5),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                    ("LEFTPADDING", (0, 0), (-1, -1), 7),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 7),
                ]
            )
        )
        return t

    # ---- Montagem do documento ----
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=MARGEM,
        rightMargin=MARGEM,
        topMargin=BANDA + 0.6 * cm,
        bottomMargin=1.7 * cm,
        title="Relatório Financeiro - Ateliê da Sete",
        author="Ateliê da Sete",
    )

    comp = dados["comparativo"]
    story = [
        Paragraph("Indicadores do período", st_titulo),
        kpi_tbl,
        Spacer(1, 4),
        Paragraph(
            f"Variação em relação ao período anterior de mesma duração "
            f"({data_br(comp['de'])} a {data_br(comp['ate'])}).",
            st_legenda,
        ),
        Spacer(1, 12),
        Paragraph("Demonstrativo do Resultado (DRE)", st_titulo),
        dre_tbl,
        Spacer(1, 4),
        Paragraph(
            "Pedidos em revisão foram pagos no Mercado Pago mas não atendidos (a estornar). "
            "São informativos: não entram como dedução da receita. CMV, lucro bruto, margem e "
            "despesas chegam nas próximas fases.",
            st_legenda,
        ),
    ]

    png = _grafico_faturamento_png((series or {}).get("series"))
    if png:
        img = ImageReader(io.BytesIO(png))
        iw, ih = img.getSize()
        altura = CONTEUDO * ih / iw
        story += [
            Spacer(1, 12),
            Paragraph("Faturamento por período", st_titulo),
            Image(io.BytesIO(png), width=CONTEUDO, height=altura),
        ]

    itens = (produtos or {}).get("itens") or []
    if itens:
        linhas_prod = [
            [i["peca_nome"], i["variacao_descricao"], i["quantidade"], f"R$ {moeda_br(i['receita'])}"]
            for i in itens[:10]
        ]
        story += [
            Spacer(1, 12),
            Paragraph("Produtos mais vendidos", st_titulo),
            _tabela(
                ["Peça", "Variação", "Qtd.", "Receita"],
                linhas_prod,
                ["l", "l", "r", "r"],
                [0.40, 0.30, 0.12, 0.18],
            ),
        ]

    if cupons:
        linhas_cup = [
            [c["nome"], c["codigo"] or "sem código", c["usos"], f"R$ {moeda_br(c['valor_descontado'])}"]
            for c in cupons
        ]
        story += [
            Spacer(1, 12),
            Paragraph("Cupons utilizados", st_titulo),
            _tabela(
                ["Cupom", "Código", "Usos", "Descontado"],
                linhas_cup,
                ["l", "l", "r", "r"],
                [0.42, 0.22, 0.12, 0.24],
            ),
        ]

    doc.build(story, onFirstPage=_faixa, onLaterPages=_faixa, canvasmaker=_Canvas)

    resp = HttpResponse(buffer.getvalue(), content_type="application/pdf")
    resp["Content-Disposition"] = (
        f'attachment; filename="financeiro-{dados["de"]}-a-{dados["ate"]}.pdf"'
    )
    return resp
