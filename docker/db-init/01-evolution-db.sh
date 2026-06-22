#!/bin/sh
# Cria o banco "evolution" usado pela Evolution API (bot de WhatsApp do dono).
# Roda APENAS no primeiro init do volume do Postgres (docker-entrypoint-initdb.d).
# Se o volume "atelie_pgdata" já existia, este script NÃO roda — crie o banco
# manualmente (veja o README, seção "Bot de WhatsApp (Evolution API)").
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    SELECT 'CREATE DATABASE evolution'
    WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'evolution')\gexec
EOSQL
