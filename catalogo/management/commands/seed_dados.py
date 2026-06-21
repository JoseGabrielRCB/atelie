"""
Popula o banco com dados de exemplo para testar a vitrine.

Uso:
    python manage.py seed_dados

Cria categorias e peças com variações de estoque variado, incluindo ao menos
uma variação esgotada (estoque=0) e uma peça sob_medida sem variações.
O comando é idempotente (usa get_or_create).
"""

from decimal import Decimal

from django.core.management.base import BaseCommand

from catalogo.models import Categoria, Peca, Variacao


class Command(BaseCommand):
    help = "Cria dados de exemplo (categorias, peças e variações) para a vitrine."

    def handle(self, *args, **options):
        vestidos, _ = Categoria.objects.get_or_create(nome="Vestidos")
        blusas, _ = Categoria.objects.get_or_create(nome="Blusas")
        alfaiataria, _ = Categoria.objects.get_or_create(nome="Alfaiataria")

        # Peça pronta com variações de estoque variado (uma esgotada).
        vestido, _ = Peca.objects.get_or_create(
            nome="Vestido Floral Midi",
            defaults={
                "descricao": "Vestido midi de viscose com estampa floral.",
                "preco": Decimal("249.90"),
                "categoria": vestidos,
                "tipo": Peca.Tipo.PRONTA,
                "ativo": True,
            },
        )
        self._variacao(vestido, "P", "Azul", 5)
        self._variacao(vestido, "M", "Azul", 0)  # esgotada
        self._variacao(vestido, "G", "Azul", 2)

        # Outra peça pronta.
        blusa, _ = Peca.objects.get_or_create(
            nome="Blusa de Linho",
            defaults={
                "descricao": "Blusa de linho leve, ótima para o verão.",
                "preco": Decimal("129.00"),
                "categoria": blusas,
                "tipo": Peca.Tipo.PRONTA,
                "ativo": True,
            },
        )
        self._variacao(blusa, "M", "Branco", 8)
        self._variacao(blusa, "G", "Bege", 0)  # esgotada

        # Peça sob medida — pode não ter variações.
        Peca.objects.get_or_create(
            nome="Terno Sob Medida",
            defaults={
                "descricao": "Terno de alfaiataria confeccionado sob medida.",
                "preco": Decimal("1200.00"),
                "categoria": alfaiataria,
                "tipo": Peca.Tipo.SOB_MEDIDA,
                "ativo": True,
            },
        )

        # Peça inativa — não deve aparecer na vitrine pública.
        Peca.objects.get_or_create(
            nome="Vestido Antigo (fora de linha)",
            defaults={
                "descricao": "Modelo descontinuado.",
                "preco": Decimal("99.00"),
                "categoria": vestidos,
                "tipo": Peca.Tipo.PRONTA,
                "ativo": False,
            },
        )

        self.stdout.write(self.style.SUCCESS("Dados de exemplo criados com sucesso."))

    def _variacao(self, peca, tamanho, cor, estoque):
        Variacao.objects.get_or_create(
            peca=peca,
            tamanho=tamanho,
            cor=cor,
            defaults={"estoque": estoque},
        )
