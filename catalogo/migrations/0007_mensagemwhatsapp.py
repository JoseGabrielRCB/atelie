# Generated for Subagent C (comandos remotos do bot de WhatsApp).

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('catalogo', '0006_eventopagamento_pedido_itempedido'),
    ]

    operations = [
        migrations.CreateModel(
            name='MensagemWhatsApp',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('mensagem_id', models.CharField(max_length=255, unique=True, verbose_name='ID da mensagem')),
                ('criado_em', models.DateTimeField(auto_now_add=True, verbose_name='criado em')),
            ],
            options={
                'verbose_name': 'mensagem de WhatsApp',
                'verbose_name_plural': 'mensagens de WhatsApp',
                'ordering': ['-criado_em'],
            },
        ),
    ]
