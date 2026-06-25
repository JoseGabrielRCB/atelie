"""Relatórios financeiros — agregações no servidor (sem mudança de schema).

Tudo é calculado a partir de ``Pedido`` com ``status="pago"`` + ``ItemPedido`` +
o cupom (``Pedido.cupom``/``Pedido.desconto``). Nunca confia em valores do
cliente. Respeita o fuso de ``settings.TIME_ZONE`` (os instantes são gravados em
UTC; aqui agrupamos/filtramos pelo dia LOCAL).

Três relatórios:
- ``vendas_por_periodo`` — faturamento e nº de pedidos pagos, por dia/semana/mês.
- ``produtos_mais_vendidos`` — ranking de variações por quantidade e receita.
- ``resumo_do_mes`` — faturamento, nº de vendas, ticket médio, desconto concedido
  e a análise de cupons (quais foram usados, nº de usos e valor descontado).

Exportação: ``exportar(formato, ...)`` devolve um ``HttpResponse`` em CSV (nativo)
ou PDF (reportlab, import tardio). Os relatórios são agregados — não expõem dados
sensíveis do cliente (sem nome/contato/CPF).
"""

from datetime import date, datetime, time, timedelta
from decimal import Decimal
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
                "periodo": _rotulo_periodo(local, gran) if local else "—",
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
            or "—"
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
