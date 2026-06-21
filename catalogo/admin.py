"""Configuração do Django Admin do catálogo."""

from django.contrib import admin

from .models import (
    Categoria,
    Encomenda,
    EncomendaImagem,
    Imagem,
    Peca,
    Variacao,
)


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


@admin.register(Peca)
class PecaAdmin(admin.ModelAdmin):
    list_display = ["nome", "categoria", "tipo", "preco", "ativo", "criado_em"]
    list_filter = ["ativo", "tipo", "categoria"]
    search_fields = ["nome", "descricao"]
    list_editable = ["ativo"]
    inlines = [VariacaoInline, ImagemInline]


@admin.register(Variacao)
class VariacaoAdmin(admin.ModelAdmin):
    list_display = ["peca", "tamanho", "cor", "estoque", "esgotado"]
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
