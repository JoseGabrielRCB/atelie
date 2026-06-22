#!/bin/sh
# Garante que o banco "evolution" (usado pela Evolution API) exista no Postgres.
# Roda como serviço one-shot (evolution-db-init) a CADA `docker compose up`, então
# funciona mesmo quando o volume do Postgres já existia (caso em que o script de
# initdb.d NÃO roda). Idempotente: cria só se ainda não existir.
set -e

DB_USER="${DB_USER:-atelie}"
DB_PASSWORD="${DB_PASSWORD:-atelie}"
export PGPASSWORD="$DB_PASSWORD"

# Espera o Postgres aceitar conexões (rede do compose: host "db").
i=0
until pg_isready -h db -U "$DB_USER" >/dev/null 2>&1; do
  i=$((i + 1))
  if [ "$i" -gt 30 ]; then
    echo "evolution-db-init: Postgres não respondeu a tempo." >&2
    exit 1
  fi
  echo "evolution-db-init: aguardando o Postgres..."
  sleep 1
done

URI="postgresql://$DB_USER:$DB_PASSWORD@db:5432/postgres"

if psql "$URI" -tAc "SELECT 1 FROM pg_database WHERE datname='evolution'" | grep -q 1; then
  echo "evolution-db-init: banco 'evolution' já existe."
else
  echo "evolution-db-init: criando o banco 'evolution'..."
  psql "$URI" -c "CREATE DATABASE evolution"
  echo "evolution-db-init: banco 'evolution' criado."
fi
