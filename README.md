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

