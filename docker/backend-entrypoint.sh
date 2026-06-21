#!/bin/sh
# Preparação do backend antes de iniciar o servidor.
# O banco já está saudável (depends_on: service_healthy no compose).
set -e

echo "==> Aplicando migrations..."
python manage.py migrate --noinput

echo "==> Populando dados de exemplo (idempotente)..."
python manage.py seed_dados || echo "   (seed pulado)"

# Cria o superuser apenas se as variáveis estiverem definidas.
# Se o usuário já existir, o comando falha silenciosamente.
if [ -n "$DJANGO_SUPERUSER_USERNAME" ] && [ -n "$DJANGO_SUPERUSER_PASSWORD" ]; then
  echo "==> Garantindo o superuser '$DJANGO_SUPERUSER_USERNAME'..."
  python manage.py createsuperuser --noinput 2>/dev/null \
    && echo "   superuser criado" \
    || echo "   superuser já existe"
fi

echo "==> Iniciando: $*"
exec "$@"
