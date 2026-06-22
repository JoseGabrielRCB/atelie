"""Sinais (signals) do catálogo.

``compra_paga`` é disparado quando um :class:`~catalogo.models.Pedido` é
confirmado como pago pelo webhook do Mercado Pago. Um futuro bot de WhatsApp
(ou qualquer outro consumidor) pode se inscrever nele para notificar o ateliê.

Argumentos enviados:
    sender: a classe ``Pedido``.
    pedido: a instância de ``Pedido`` recém-confirmada como ``pago``.
"""

import django.dispatch

# Disparado em catalogo.pagamentos/views após confirmar o pagamento.
# Uso: compra_paga.send(sender=Pedido, pedido=<Pedido>)
compra_paga = django.dispatch.Signal()
