"""Marca pedidos aguardando pagamento que já passaram do prazo como expirados.

Rode periodicamente (cron/scheduler). Pedidos expirados deixam de reservar
estoque, liberando a disponibilidade pública.

Exemplo de cron (a cada 5 minutos):
    */5 * * * * cd /app && python manage.py expirar_pedidos

No docker compose:
    docker compose exec backend python manage.py expirar_pedidos
"""

from django.core.management.base import BaseCommand
from django.utils import timezone

from catalogo.models import Pedido


class Command(BaseCommand):
    help = "Marca pedidos aguardando_pagamento vencidos (expira_em <= agora) como expirados."

    def handle(self, *args, **options):
        agora = timezone.now()
        atualizados = Pedido.objects.filter(
            status=Pedido.Status.AGUARDANDO_PAGAMENTO,
            expira_em__lte=agora,
        ).update(status=Pedido.Status.EXPIRADO)
        self.stdout.write(
            self.style.SUCCESS(f"{atualizados} pedido(s) expirado(s).")
        )
