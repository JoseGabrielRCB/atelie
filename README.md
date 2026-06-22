# Ateliê — Aplicação (Backend + Frontend)

Catálogo de um ateliê de roupas. **Backend** Django/DRF (API REST): vitrine pública
(somente leitura) e admin via JWT. **Frontend** React/Vite em [`frontend/`](./frontend/):
área do cliente onde o pedido é finalizado pelo **WhatsApp** — fora do sistema.

Documentação técnica: [`CLAUDE.md`](./CLAUDE.md) (backend) e
[`frontend/CLAUDE.md`](./frontend/CLAUDE.md) (frontend).

---

## Opção A — Rodar tudo com Docker Compose (recomendado)

Sobe **banco + backend + frontend** de uma vez. Só precisa de **Docker** instalado.

```bash
# 1. Configure o ambiente (a primeira vez)
cp .env.example .env        # Windows: copy .env.example .env
#    Ajuste se quiser: senha do superuser e o número do WhatsApp (VITE_WHATSAPP).

# 2. Suba a stack
docker compose up           # use -d para rodar em segundo plano
```

Pronto. O container do backend já **aplica as migrations, popula dados de exemplo e cria
o superuser** automaticamente no primeiro start.

| Serviço            | URL                              |
|--------------------|----------------------------------|
| Frontend (vitrine) | http://localhost:5173            |
| API                | http://localhost:8000/api/       |
| Django Admin       | http://localhost:8000/admin/     |

Superuser padrão (definido no `.env`): **admin / Atelie@2026** — troque a senha.

Comandos úteis:

```bash
docker compose up -d --build   # reconstruir após mudar dependências/Dockerfile
docker compose logs -f backend # acompanhar logs
docker compose ps              # status dos containers
docker compose down            # parar (mantém o banco)
docker compose down -v         # parar e APAGAR o banco (volumes)
docker compose exec backend python manage.py <comando>   # rodar manage.py
docker compose exec backend python -m pytest             # rodar os testes
```

> O código é montado por bind mount: editar arquivos recarrega backend e frontend
> automaticamente (hot reload).

---

## Opção B — Rodar o backend localmente (sem Docker para o app)

Útil para desenvolver só o backend. Ainda usa o Postgres do Docker.

### 1. Ambiente virtual + dependências

```bash
python -m venv .venv
.venv\Scripts\Activate.ps1        # Windows (PowerShell)
# source .venv/bin/activate       # Linux/macOS
pip install -r requirements.txt
```

### 2. Variáveis de ambiente

```bash
cp .env.example .env              # Windows: copy .env.example .env
```

Mantenha `DB_HOST=localhost` (rodando fora do Docker).

> Gere uma `SECRET_KEY` para produção:
> `python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"`

### 3. Subir só o PostgreSQL

```bash
docker compose up -d db
```

### 4. Migrar, criar superuser, popular e rodar

```bash
python manage.py migrate
python manage.py createsuperuser
python manage.py seed_dados       # opcional: dados de exemplo
python manage.py runserver
```

- API: http://127.0.0.1:8000/api/ · Admin: http://127.0.0.1:8000/admin/

Para o frontend nesse modo, veja [`frontend/README.md`](./frontend/README.md).

### Testes

```bash
python -m pytest
```

## Endpoints principais

| Método | Rota                      | Acesso  | Descrição                          |
|--------|---------------------------|---------|------------------------------------|
| GET    | `/api/categorias/`        | Público | Lista categorias                   |
| GET    | `/api/pecas/`             | Público | Peças ativas (filtros e busca)     |
| GET    | `/api/pecas/{id}/`        | Público | Detalhe da peça                    |
| POST   | `/api/auth/login/`        | Público | Retorna `access` + `refresh`       |
| POST   | `/api/auth/refresh/`      | Público | Renova o `access`                  |
| CRUD   | `/api/pecas/` etc.        | Admin   | Requer `Authorization: Bearer ...` |

Filtros da vitrine: `?categoria=<id>`, `?tipo=pronta|sob_medida`, `?search=<texto>`,
`?ordering=preco|-criado_em|nome`.

### Exemplo de autenticação

```bash
# 1. Login
curl -X POST http://127.0.0.1:8000/api/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "sua-senha"}'

# 2. Usar o token retornado
curl http://127.0.0.1:8000/api/pecas/ \
  -H "Authorization: Bearer <access-token>"
```

---

## Bot de WhatsApp (Evolution API)

Bot **privado do dono** (uso interno: alertas de estoque baixo e comandos rápidos).
**Nunca** conversa com clientes. Roda na **Evolution API** (não-oficial, via Baileys).

> ⚠️ **Use um número de telefone DEDICADO** para o bot — **nunca** o número
> principal da loja. A API é não-oficial e há **risco de banimento** do número.

Os serviços `redis` e `evolution-api` **não sobem sozinhos** com `docker compose up`.
Suba sob demanda:

```bash
docker compose up redis evolution-api      # -d para segundo plano
```

A Evolution fica em `http://localhost:8080` e usa: o Postgres `db` (banco próprio
`evolution`), o `redis` para cache, e um **webhook global** que entrega os eventos
ao backend em `http://backend:8000/api/webhooks/whatsapp/` (dentro da rede do compose).

### 1. Banco `evolution` (garantido automaticamente)

A Evolution precisa de um banco **próprio** chamado `evolution`. Um serviço one-shot
**`evolution-db-init`** cria esse banco (se não existir) **a cada `docker compose up`**,
ANTES da `evolution-api` subir (ela `depends_on` o init com
`condition: service_completed_successfully`). Funciona em **qualquer cenário** —
inclusive quando o volume `atelie_pgdata` já existia (caso em que o script de
`initdb.d` não roda). Você **não precisa** criar o banco manualmente.

> O `docker/db-init/01-evolution-db.sh` (init do volume) continua presente, mas o
> sistema **não depende mais só dele** — o `evolution-db-init` é a garantia.

### 2. Variáveis de ambiente

No `.env`, ajuste a seção do bot (veja `.env.example`): `EVOLUTION_API_KEY` (troque!),
`EVOLUTION_INSTANCE` (ex.: `atelie-bot`), `WHATSAPP_DONO` (número do dono, só dígitos,
formato internacional) e `ESTOQUE_BAIXO_LIMIAR`.

### 3. Conectar o número (QR Code) — pelo painel (recomendado)

Com a Evolution no ar e logado no admin, acesse **`/admin/whatsapp`**: clique em
**Conectar WhatsApp**, e leia o **QR Code** no celular do **número dedicado**
(**WhatsApp → Aparelhos conectados → Conectar um aparelho**). A página mostra o
status e detecta a conexão sozinha. O backend é proxy — a `EVOLUTION_API_KEY`
nunca vai ao navegador.

Alternativa por linha de comando (cria a instância e devolve o QR em `qrcode.base64`):

```bash
curl -X POST http://localhost:8080/instance/create \
  -H "apikey: SUA_EVOLUTION_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"instanceName": "atelie-bot", "integration": "WHATSAPP-BAILEYS", "qrcode": true}'
```

A sessão fica persistida no volume `atelie_evolution`.

### 4. Erros comuns (o que a tela `/admin/whatsapp` mostra)

| Status na tela | Causa provável | Solução |
|----------------|----------------|---------|
| **Não configurado** | falta `EVOLUTION_URL`/`EVOLUTION_API_KEY`/`EVOLUTION_INSTANCE` no `.env` | preencha o `.env` e reinicie o backend |
| **Evolution indisponível** | `evolution-api` fora do ar / conexão recusada | `docker compose up -d evolution-api` (e `redis`) |
| **Chave inválida** | `EVOLUTION_API_KEY` do backend ≠ a da Evolution | use a mesma chave no `.env` e no serviço |
| **Erro na Evolution** | erro interno (5xx) — frequentemente o banco `evolution` ausente | suba com o `evolution-db-init` (já garante o banco); confira os logs da `evolution-api` |

> O webhook global já aponta para o backend (`/api/webhooks/whatsapp/`). A rota que
> recebe os eventos (`messages.upsert` etc.) é implementada no backend Django.

