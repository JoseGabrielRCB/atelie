from django.apps import AppConfig


class CatalogoConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'catalogo'

    def ready(self):
        # Conecta os receivers de notificação do bot de WhatsApp do dono
        # (compra_paga / encomenda_criada). O import registra os @receiver.
        from . import notificacoes  # noqa: F401
