"""Cálculo de disponibilidade pública de estoque.

Disponível = ``Variacao.estoque`` − soma das quantidades reservadas por pedidos
em ``aguardando_pagamento`` ainda não expirados. Isso evita vender o último
item em duplicidade enquanto um cliente está pagando no Mercado Pago.
"""

from django.db.models import IntegerField, Sum, Value
from django.db.models.functions import Coalesce
from django.utils import timezone

from .models import ItemPedido, Pedido


def reservas_por_variacao(variacao_ids):
    """Soma das quantidades reservadas (pendentes e não expiradas) por variação.

    Retorna um dict ``{variacao_id: quantidade_reservada}``.
    """
    agora = timezone.now()
    reservas = (
        ItemPedido.objects.filter(
            variacao_id__in=list(variacao_ids),
            pedido__status=Pedido.Status.AGUARDANDO_PAGAMENTO,
            pedido__expira_em__gt=agora,
        )
        .values("variacao_id")
        .annotate(reservado=Coalesce(Sum("quantidade"), Value(0), output_field=IntegerField()))
    )
    return {r["variacao_id"]: r["reservado"] for r in reservas}


def disponibilidade(variacoes):
    """Disponibilidade pública para um iterável de :class:`Variacao`.

    Retorna ``{variacao_id: disponivel}`` (nunca negativo).
    ``variacoes`` pode ser uma lista de instâncias (usa ``estoque`` já carregado).
    """
    variacoes = list(variacoes)
    reservas = reservas_por_variacao([v.id for v in variacoes])
    resultado = {}
    for v in variacoes:
        livre = v.estoque - reservas.get(v.id, 0)
        resultado[v.id] = max(livre, 0)
    return resultado


def disponivel_de(variacao):
    """Disponibilidade pública de uma única variação (int, nunca negativo)."""
    return disponibilidade([variacao])[variacao.id]
