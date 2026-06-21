"""Categoria → CASCADE e Peca.nome único.

Antes de aplicar a restrição de unicidade em ``Peca.nome``, é preciso
desduplicar nomes já existentes no banco (a criação do índice único falha se
houver repetidos). A data migration acrescenta sufixos " (2)", " (3)"… aos
nomes repetidos, mantendo o primeiro registro (menor id) intacto.
"""

from django.db import migrations, models
import django.db.models.deletion


def desduplicar_nomes(apps, schema_editor):
    Peca = apps.get_model("catalogo", "Peca")
    vistos = {}
    # Ordena por id para manter o primeiro registro de cada nome sem sufixo.
    for peca in Peca.objects.order_by("id").iterator():
        base = peca.nome
        if base not in vistos:
            vistos[base] = 1
            continue
        # Já existe esse nome: gera um sufixo único que ainda não exista.
        contador = vistos[base] + 1
        novo = f"{base} ({contador})"
        while Peca.objects.filter(nome=novo).exclude(pk=peca.pk).exists() or novo in vistos:
            contador += 1
            novo = f"{base} ({contador})"
        vistos[base] = contador
        vistos[novo] = 1
        peca.nome = novo
        peca.save(update_fields=["nome"])


def reverter(apps, schema_editor):
    # Não há como reconstruir os nomes originais com segurança; no-op.
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("catalogo", "0003_peca_destaque"),
    ]

    operations = [
        migrations.AlterField(
            model_name="peca",
            name="categoria",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name="pecas",
                to="catalogo.categoria",
                verbose_name="categoria",
            ),
        ),
        # Desduplica ANTES de criar o índice único.
        migrations.RunPython(desduplicar_nomes, reverter),
        migrations.AlterField(
            model_name="peca",
            name="nome",
            field=models.CharField(
                error_messages={"unique": "Já existe uma peça com esse nome."},
                max_length=150,
                unique=True,
                verbose_name="nome",
            ),
        ),
    ]
