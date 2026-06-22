"""Sinais (signals) do catálogo.

``compra_paga`` é disparado quando um :class:`~catalogo.models.Pedido` é
confirmado como pago pelo webhook do Mercado Pago. Um futuro bot de WhatsApp
(ou qualquer outro consumidor) pode se inscrever nele para notificar o ateliê.

Argumentos enviados:
    sender: a classe ``Pedido``.
    pedido: a instância de ``Pedido`` recém-confirmada como ``pago``.

``encomenda_criada`` é disparado quando uma :class:`~catalogo.models.Encomenda`
(pedido sob medida) é criada pelo cliente (público). O bot de WhatsApp do dono
se inscreve para avisar o ateliê de que há uma nova encomenda no painel.

Argumentos enviados:
    sender: a classe ``Encomenda``.
    encomenda: a instância de ``Encomenda`` recém-criada.
"""

import django.dispatch

# Disparado em catalogo.pagamentos/views após confirmar o pagamento.
# Uso: compra_paga.send(sender=Pedido, pedido=<Pedido>)
compra_paga = django.dispatch.Signal()

# Disparado em EncomendaViewSet.create após salvar a encomenda + imagens.
# Uso: encomenda_criada.send(sender=Encomenda, encomenda=<Encomenda>)
encomenda_criada = django.dispatch.Signal()
