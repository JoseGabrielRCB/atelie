"""
Popula o banco com VENDAS PAGAS de exemplo para testar os Relatórios.

Uso:
    python manage.py seed_relatorios               # ~40 pedidos nos últimos ~80 dias
    python manage.py seed_relatorios --pedidos 80  # quantidade personalizada
    python manage.py seed_relatorios --limpar      # remove os pedidos deste seed e recria

Cria (se faltar) peças prontas (via seed_dados), uma conta de cliente de teste e
dois cupons, e gera pedidos com ``status="pago"`` retroativos (datas espalhadas
pelos últimos ~80 dias — inclui o mês atual e os últimos 30 dias), alguns com
cupom + desconto. Assim os 3 relatórios mostram dados:
- Vendas por período (faturamento/pedidos por dia/semana/mês),
- Produtos mais vendidos (ranking por quantidade/receita),
- Resumo do mês (faturamento, ticket, desconto e análise de cupons).

Os pedidos são criados DIRETAMENTE como pagos (não passam pelo checkout/webhook),
então não mexem no estoque — é só para visualizar os relatórios.
"""

import random
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from catalogo.models import Cliente, ItemPedido, Pedido, Promocao, Variacao

# CPF válido (dígitos verificadores corretos) para a conta de teste.
CPF_TESTE = "52998224725"
EMAIL_TESTE = "relatorios@teste.com"
CENTAVO = Decimal("0.01")


class Command(BaseCommand):
    help = "Cria vendas pagas de exemplo (datas variadas, com cupons) para os Relatórios."

    def add_arguments(self, parser):
        parser.add_argument(
            "--pedidos", type=int, default=40, help="Quantos pedidos pagos criar (default 40)."
        )
        parser.add_argument(
            "--dias", type=int, default=80, help="Janela em dias para trás (default 80)."
        )
        parser.add_argument(
            "--limpar",
            action="store_true",
            help="Remove os pedidos do cliente de teste antes de recriar.",
        )

    def handle(self, *args, **options):
        rnd = random.Random(42)  # reproduzível, mas com variedade
        n_pedidos = max(1, options["pedidos"])
        janela = max(1, options["dias"])

        cliente = self._cliente_teste()

        if options["limpar"]:
            apagados, _ = Pedido.objects.filter(cliente=cliente).delete()
            self.stdout.write(self.style.WARNING(f"Removidos pedidos do cliente de teste ({apagados} registros)."))

        variacoes = self._variacoes_prontas()
        if not variacoes:
            self.stderr.write(
                self.style.ERROR(
                    "Nenhuma variação de peça pronta encontrada — verifique o seed_dados."
                )
            )
            return

        cupons = self._cupons()
        agora = timezone.now()

        faturamento = Decimal("0.00")
        desconto_total = Decimal("0.00")
        com_cupom = 0

        for _ in range(n_pedidos):
            # Data retroativa: dia aleatório dentro da janela + hora comercial.
            quando = agora - timezone.timedelta(
                days=rnd.randint(0, janela),
                hours=rnd.randint(0, 12),
                minutes=rnd.randint(0, 59),
            )

            # 1 a 3 itens distintos.
            escolhidas = rnd.sample(variacoes, k=min(len(variacoes), rnd.randint(1, 3)))
            itens = [(v, rnd.randint(1, 3)) for v in escolhidas]
            subtotal = sum(
                (v.peca.preco * qtd for v, qtd in itens), Decimal("0.00")
            ).quantize(CENTAVO)

            # ~35% dos pedidos usam um cupom.
            cupom = None
            desconto = Decimal("0.00")
            if cupons and rnd.random() < 0.35:
                cupom = rnd.choice(cupons)
                if cupom.tipo_desconto == Promocao.TipoDesconto.PERCENTUAL:
                    desconto = (subtotal * cupom.valor / Decimal(100)).quantize(CENTAVO)
                else:
                    desconto = min(cupom.valor, subtotal).quantize(CENTAVO)

            total = (subtotal - desconto).quantize(CENTAVO)
            if total < 0:
                total = Decimal("0.00")

            with transaction.atomic():
                pedido = Pedido.objects.create(
                    cliente=cliente,
                    nome=cliente.nome,
                    contato=cliente.telefone or EMAIL_TESTE,
                    status=Pedido.Status.PAGO,
                    total=total,
                    desconto=desconto,
                    cupom=cupom,
                    mp_payment_id=f"SEED-{rnd.randint(100000, 999999)}",
                    expira_em=quando + timezone.timedelta(minutes=30),
                )
                for variacao, qtd in itens:
                    ItemPedido.objects.create(
                        pedido=pedido,
                        variacao=variacao,
                        quantidade=qtd,
                        preco_unit=variacao.peca.preco,
                    )
                # criado_em é auto_now_add: força a data retroativa via update.
                Pedido.objects.filter(pk=pedido.pk).update(criado_em=quando)

            faturamento += total
            desconto_total += desconto
            if cupom:
                com_cupom += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"{n_pedidos} vendas pagas criadas nos últimos {janela} dias "
                f"({com_cupom} com cupom). Faturamento: R$ {faturamento} · "
                f"Desconto concedido: R$ {desconto_total}."
            )
        )
        self.stdout.write("Abra Admin › Relatórios (Dono ou funcionário com financeiro) para conferir.")

    # ----------------------------------------------------------------------
    def _cliente_teste(self):
        User = get_user_model()
        user, _ = User.objects.get_or_create(
            username=EMAIL_TESTE,
            defaults={"email": EMAIL_TESTE, "first_name": "Cliente Teste", "is_staff": False},
        )
        cliente, _ = Cliente.objects.get_or_create(
            usuario=user,
            defaults={"nome": "Cliente Teste", "cpf": CPF_TESTE, "telefone": "67999990000"},
        )
        return cliente

    def _variacoes_prontas(self):
        qs = list(
            Variacao.objects.select_related("peca").filter(
                peca__tipo="pronta", peca__ativo=True
            )
        )
        if not qs:
            # Garante peças prontas de exemplo e tenta de novo.
            call_command("seed_dados")
            qs = list(
                Variacao.objects.select_related("peca").filter(
                    peca__tipo="pronta", peca__ativo=True
                )
            )
        return qs

    def _cupons(self):
        c1, _ = Promocao.objects.get_or_create(
            codigo="RELATORIO10",
            tipo_aplicacao=Promocao.TipoAplicacao.CUPOM,
            defaults={
                "nome": "Cupom Relatório 10%",
                "tipo_desconto": Promocao.TipoDesconto.PERCENTUAL,
                "valor": Decimal("10.00"),
                "escopo": Promocao.Escopo.TUDO,
                "ativo": True,
            },
        )
        c2, _ = Promocao.objects.get_or_create(
            codigo="RELATORIO30",
            tipo_aplicacao=Promocao.TipoAplicacao.CUPOM,
            defaults={
                "nome": "Cupom Relatório R$30",
                "tipo_desconto": Promocao.TipoDesconto.VALOR,
                "valor": Decimal("30.00"),
                "escopo": Promocao.Escopo.TUDO,
                "ativo": True,
            },
        )
        return [c1, c2]
