"""Cria o Perfil dos usuários já existentes ao introduzir o multiusuário.

- Superusers (o dono atual do ateliê) viram ``papel='dono'`` para NÃO perderem
  o acesso.
- Demais usuários (se houver) viram ``papel='funcionario'``.

Idempotente: usa ``get_or_create`` por usuário; rodar de novo não duplica.
"""

from django.db import migrations


def criar_perfis(apps, schema_editor):
    User = apps.get_model("auth", "User")
    Perfil = apps.get_model("catalogo", "Perfil")
    for user in User.objects.all():
        if Perfil.objects.filter(usuario=user).exists():
            continue
        papel = "dono" if user.is_superuser else "funcionario"
        Perfil.objects.create(
            usuario=user,
            papel=papel,
            ativo=user.is_active,
            acesso_financeiro=False,
            senha_provisoria=False,
        )


def remover_perfis(apps, schema_editor):
    Perfil = apps.get_model("catalogo", "Perfil")
    Perfil.objects.all().delete()


class Migration(migrations.Migration):

    dependencies = [
        ("catalogo", "0008_perfil"),
    ]

    operations = [
        migrations.RunPython(criar_perfis, remover_perfis),
    ]
