"""Configuração do Django Admin do catálogo."""

from django.contrib import admin

from .models import (
    Categoria,
    Cliente,
    Cor,
    Encomenda,
    EncomendaImagem,
    EventoPagamento,
    Imagem,
    ItemPedido,
    MensagemWhatsApp,
    Peca,
    Pedido,
    Perfil,
    Variacao,
)


@admin.register(Cliente)
class ClienteAdmin(admin.ModelAdmin):
    list_display = ["nome", "usuario", "telefone", "criado_em"]
    search_fields = ["nome", "usuario__email", "cpf"]
    readonly_fields = ["criado_em"]


@admin.register(Perfil)
class PerfilAdmin(admin.ModelAdmin):
    list_display = ["usuario", "papel", "ativo", "acesso_financeiro", "senha_provisoria", "criado_em"]
    list_filter = ["papel", "ativo", "acesso_financeiro"]
    search_fields = ["usuario__username", "usuario__first_name", "usuario__email"]
    readonly_fields = ["criado_em"]


class VariacaoInline(admin.TabularInline):
    model = Variacao
    extra = 1


class ImagemInline(admin.TabularInline):
    model = Imagem
    extra = 1


@admin.register(Categoria)
class CategoriaAdmin(admin.ModelAdmin):
    list_display = ["nome", "slug"]
    search_fields = ["nome"]
    prepopulated_fields = {"slug": ("nome",)}


@admin.register(Cor)
class CorAdmin(admin.ModelAdmin):
    list_display = ["nome", "hex"]
    search_fields = ["nome", "hex"]


@admin.register(Peca)
class PecaAdmin(admin.ModelAdmin):
    list_display = ["nome", "categoria", "tipo", "preco", "ativo", "destaque", "criado_em"]
    list_filter = ["ativo", "destaque", "tipo", "categoria"]
    search_fields = ["nome", "descricao"]
    list_editable = ["ativo", "destaque"]
    inlines = [VariacaoInline, ImagemInline]


@admin.register(Variacao)
class VariacaoAdmin(admin.ModelAdmin):
    list_display = ["peca", "tamanho", "cor", "cor_hex", "estoque", "esgotado"]
    list_filter = ["tamanho"]
    search_fields = ["peca__nome", "cor"]

    @admin.display(boolean=True, description="esgotado")
    def esgotado(self, obj):
        return obj.esgotado


@admin.register(Imagem)
class ImagemAdmin(admin.ModelAdmin):
    list_display = ["peca", "principal"]
    list_filter = ["principal"]


class EncomendaImagemInline(admin.TabularInline):
    model = EncomendaImagem
    extra = 0


@admin.register(Encomenda)
class EncomendaAdmin(admin.ModelAdmin):
    list_display = ["nome", "status", "prazo_desejado", "criado_em"]
    list_filter = ["status"]
    search_fields = ["nome", "contato", "descricao"]
    inlines = [EncomendaImagemInline]


class ItemPedidoInline(admin.TabularInline):
    model = ItemPedido
    extra = 0
    can_delete = False
    readonly_fields = ["variacao", "quantidade", "preco_unit"]

    def has_add_permission(self, request, obj=None):
        return False


@admin.register(Pedido)
class PedidoAdmin(admin.ModelAdmin):
    list_display = ["id", "nome", "status", "total", "criado_em", "expira_em"]
    list_filter = ["status"]
    search_fields = ["nome", "contato", "mp_preference_id", "mp_payment_id"]
    readonly_fields = [
        "nome",
        "contato",
        "total",
        "mp_preference_id",
        "mp_payment_id",
        "criado_em",
        "expira_em",
    ]
    inlines = [ItemPedidoInline]


@admin.register(EventoPagamento)
class EventoPagamentoAdmin(admin.ModelAdmin):
    list_display = ["evento_id", "criado_em"]
    search_fields = ["evento_id"]
    readonly_fields = ["evento_id", "criado_em"]


@admin.register(MensagemWhatsApp)
class MensagemWhatsAppAdmin(admin.ModelAdmin):
    list_display = ["mensagem_id", "criado_em"]
    search_fields = ["mensagem_id"]
    readonly_fields = ["mensagem_id", "criado_em"]

    def has_add_permission(self, request):
        return False
