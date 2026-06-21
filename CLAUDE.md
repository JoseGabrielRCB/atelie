# CLAUDE.md — Backend do Ateliê

> Memória viva do projeto. **Sempre que criar/alterar models, endpoints, dependências,
> configuração ou decisões, atualize este arquivo na mesma tarefa, antes de concluir.**

## Visão geral

Backend (API REST) de um ateliê de roupas, consumido por um frontend React (a **área do
cliente** já existe em [`frontend/`](./frontend/) — veja `frontend/CLAUDE.md`). O negócio tem
dois lados:

- **Cliente** (público, sem login): navega o catálogo de peças ativas. O pedido **não**
  acontece no sistema — o cliente monta uma seleção e finaliza pelo **WhatsApp**. O backend
  apenas expõe o catálogo publicamente para leitura.
- **Admin** (ateliê): superuser único, faz login via **JWT** e gerencia categorias, peças,
  variações, estoque e imagens.

Toda a interface visível ao usuário é em **PT-BR**. Não há cadastro/login de cliente.

## Stack e versões

- Python 3.13 / Django 5.2.x
- Django REST Framework 3.17
- djangorestframework-simplejwt 5.5 (autenticação JWT)
- django-cors-headers 4.9 (frontend em outra origem)
- django-filter 25.2 (filtros de catálogo)
- Pillow 12 (upload de imagens)
- django-environ 0.14 (variáveis de ambiente via `.env`)
- psycopg2-binary 2.9 + PostgreSQL 16 (via docker-compose)
- pytest 9 + pytest-django 4.12 (testes)

## Estrutura de pastas

```
Atelie/
├── manage.py
├── requirements.txt
├── Dockerfile            # imagem do backend (dev)
├── docker-compose.yml    # stack completa: db + backend + frontend
├── docker/
│   └── backend-entrypoint.sh   # migra, popula e cria superuser no start
├── .dockerignore
├── .env.example          # modelo das variáveis de ambiente (commitado)
├── .env                  # valores reais (NÃO commitado — está no .gitignore)
├── pytest.ini            # config do pytest-django
├── README.md             # passo a passo de setup
├── CLAUDE.md             # este arquivo
├── frontend/             # app React/Vite (área do cliente) — ver frontend/CLAUDE.md
├── config/               # projeto Django
│   ├── settings.py       # lê tudo do ambiente; DRF, JWT, CORS, media, pt-br
│   └── urls.py           # /admin, /api/ (catalogo.urls), media em DEBUG
└── catalogo/             # app único
    ├── models.py         # Categoria, Cor, Peca, Variacao, Imagem, Encomenda
    ├── serializers.py    # serializers aninhados + campo calculado `esgotado`
    ├── views.py          # ModelViewSets (vitrine pública / CRUD admin)
    ├── urls.py           # DefaultRouter + rotas JWT (login/refresh)
    ├── admin.py          # inlines de Variacao e Imagem dentro de Peca
    ├── exceptions.py     # handler de erro do DRF (mensagens PT-BR)
    ├── migrations/
    ├── management/commands/seed_dados.py   # dados de exemplo
    └── tests/            # test_vitrine, test_estoque, test_auth, test_encomendas,
                          # test_exclusao, test_validacoes, conftest.py
```

## Modelo de dados

**Categoria** — `nome` (texto, **único** — `unique=True`, `max_length=100`, mensagem PT-BR
"Já existe uma categoria com esse nome."), `slug` (único, gerado de `nome` no `save()` se vazio).

**Cor** — biblioteca de cores **reutilizável** do ateliê. `nome` (texto, **único**, `max_length=30`)
e `hex` (`max_length=7`, validado como `#RRGGBB` via `RegexValidator` `^#[0-9A-Fa-f]{6}$`, mensagem
PT-BR "Use uma cor no formato #RRGGBB."). Ao escolher uma cor salva numa variação, o `cor`/`cor_hex`
da variação são preenchidos para o site renderizar a amostra (swatch).

**Peca** — `nome` (**único** — `unique=True`, `max_length=80`, mensagem PT-BR "Já existe uma peça
com esse nome."), `descricao` (`max_length=600`), `preco` (Decimal 10,2 — serializer valida
min `0` e máx `1000000.00`), `categoria`
(FK→Categoria, `on_delete=CASCADE`, related_name `pecas`), `tipo`
(`pronta` | `sob_medida`, default `pronta`), `ativo` (bool, default True — controla a vitrine),
`destaque` (bool, default False — marca a peça para a seção "Peças em destaque" da Home),
`criado_em` (auto_now_add).

**Variacao** — `peca` (FK→Peca, `CASCADE`, related_name `variacoes`), `tamanho`
(choices sugeridos P/M/G/GG/Único, mas **aceita texto livre** — inclusive numéricos como
`12`/`38`; o `VariacaoSerializer` declara `tamanho` como `CharField` para não virar
`ChoiceField`), `cor` (texto livre, `max_length=50`), `cor_hex` (`max_length=7`, `blank=True` —
hex opcional da cor quando vem da paleta salva), `estoque` (`PositiveIntegerField`, default 0).
`unique_together = (peca, tamanho, cor)` (continua só sobre `cor`, NÃO virou FK).
Propriedade `esgotado` → `estoque == 0`.

**Imagem** — `peca` (FK→Peca, `CASCADE`, related_name `imagens`), `arquivo` (ImageField,
`upload_to="pecas/"`), `principal` (bool, default False).

**Encomenda** — pedido **sob medida** enviado pelo cliente (público). `nome` (obrigatório,
`max_length=80`), `contato` (obrigatório — telefone/WhatsApp, `max_length=100`), `descricao`
(TextField, obrigatório, `max_length=600`),
`tamanho_medidas` (texto, opcional), `prazo_desejado` (DateField, opcional), `status`
(choices: `recebido` (default) | `em_andamento` | `concluida` | `cancelada`), `criado_em`
(auto_now_add). ordering `-criado_em`.

**EncomendaImagem** — `encomenda` (FK→Encomenda, `CASCADE`, related_name `imagens`), `arquivo`
(ImageField, `upload_to="encomendas/"`). São as imagens de referência anexadas pelo cliente.

### Regras de negócio

1. Variação com `estoque == 0` é sinalizada com `esgotado: true` na API.
2. A vitrine pública mostra apenas peças com `ativo == True`. O admin autenticado vê todas.
3. Estoque nunca pode ser negativo (model: `PositiveIntegerField` + `MinValueValidator`;
   serializer: campo `IntegerField(min_value=0)` com mensagem PT-BR).
4. Apenas o admin autenticado cria/edita/exclui peças, variações, imagens e categorias.
5. Peça `sob_medida` pode não ter variações.
6. **Encomenda sob medida** é o ÚNICO pedido registrado no sistema. O fluxo de catálogo continua
   saindo pelo WhatsApp; a encomenda é salva no backend porque o link do WhatsApp não anexa
   imagens, e as fotos de referência precisam chegar ao ateliê. Criação é **pública**; só o admin
   lista/atualiza/exclui. O ateliê analisa e dá retorno por fora (não há resposta pelo sistema).
7. Dados do cliente na encomenda (`nome`, `contato`) são **sensíveis**: nunca logados nem
   ecoados na resposta do POST público (que devolve só `id`/`status`/`mensagem`).
8. **Nome de peça é único** (`Peca.nome unique=True`): criar/editar peça com nome já existente
   retorna `400` `{ "nome": ["Já existe uma peça com esse nome."] }`. O `UniqueValidator` do
   `PecaSerializer` ignora a própria peça em PATCH/PUT.
9. **Exclusão em cascata**: `Peca.categoria` é `on_delete=CASCADE`, então excluir uma **categoria**
   remove as peças dela (e, por cascata já existente, as variações e imagens das peças). Excluir uma
   **peça** remove suas variações e imagens; excluir uma **variação** remove só ela. Exclusões exigem
   JWT de admin. (A migration `0004` desduplica nomes repetidos antes de aplicar o `unique`.)
10. **Nome de categoria é único** (`Categoria.nome unique=True`): criar/editar categoria com nome já
    existente retorna `400` `{ "nome": ["Já existe uma categoria com esse nome."] }`. (A migration
    `0005` desduplica nomes de categoria repetidos antes de aplicar o `unique`, mesmo padrão da `0004`.)
11. **Limites de campos** (validados no serializer com mensagens PT-BR): preço da peça entre `0` e
    `1000000.00` (`"O preço não pode ser negativo."` / `"Preço acima do permitido."`); descrição da
    peça e da encomenda `max_length=600`; nome de peça/encomenda `max_length=80`; contato `max_length=100`.
12. **Cor** (`/api/cores/`) é a paleta reutilizável: `hex` deve ser `#RRGGBB` ("Use uma cor no formato
    #RRGGBB."). A `Variacao` guarda `cor` (nome) + `cor_hex` para o swatch público; `cor` segue texto livre.

## API

Base: `/api/`. Respostas de lista são **paginadas** (`PageNumberPagination`, `PAGE_SIZE=20`):
`{ "count", "next", "previous", "results": [...] }`.

### Públicos (leitura, sem autenticação)

- `GET /api/categorias/` — lista categorias.
- `GET /api/cores/` — lista a paleta de cores (`{ "id", "nome", "hex" }`). `GET /api/cores/{id}/`
  para detalhe. Escrita (POST/PUT/PATCH/DELETE) exige JWT de admin.
- `GET /api/pecas/` — lista peças **ativas** com variações e imagens aninhadas.
  Filtros: `?categoria=<id>`, `?tipo=pronta|sob_medida`, `?destaque=true` (peças em destaque),
  busca `?search=<texto>` (nome/descrição), ordenação `?ordering=preco|-criado_em|nome`.
- `GET /api/pecas/{id}/` — detalhe de uma peça.
- `POST /api/encomendas/` — **público** (`AllowAny`): cria uma encomenda sob medida via
  `multipart/form-data`. Campos: `nome`*, `contato`*, `descricao`*, `tamanho_medidas`,
  `prazo_desejado` (`YYYY-MM-DD`) e `imagens` (0–5 arquivos no MESMO campo, lidos com
  `request.FILES.getlist("imagens")`). Limites: máx. 5 imagens, 5 MB cada, tipos jpg/jpeg/png/webp.
  Status inicial sempre `recebido`. Resposta `201`: `{ "id", "status", "mensagem" }` (NÃO ecoa
  nome/contato). Erros `400` com chaves por campo em PT-BR (ex.: `{ "imagens": ["..."] }`).
  Anti-spam: throttle com escopo `encomendas` (`10/hour`) só nessa ação → `429` se exceder.

### Admin (exigem JWT — escrita bloqueada por `IsAuthenticatedOrReadOnly`)

- CRUD completo: `categorias`, `cores`, `pecas`, `variacoes`, `imagens` (POST/PUT/PATCH/DELETE).
- **Encomendas** (`IsAuthenticated`): `GET /api/encomendas/` (lista paginada, imagens aninhadas,
  filtro `?status=`), `GET /api/encomendas/{id}/`, `PATCH /api/encomendas/{id}/` (atualiza
  `status`), `DELETE /api/encomendas/{id}/`. Permissão por ação (`get_permissions`: `create` =
  `AllowAny`; demais = `IsAuthenticated`). O viewset aceita multipart (create) e JSON (PATCH).
- `POST /api/auth/login/` — body `{ "username", "password" }` → `{ "access", "refresh" }`.
- `POST /api/auth/refresh/` — body `{ "refresh" }` → `{ "access" }`.

### Como autenticar

1. `POST /api/auth/login/` com usuário/senha do superuser.
2. Enviar o access token no header: `Authorization: Bearer <access>`.
3. Quando expirar, renovar via `POST /api/auth/refresh/`.

## Como rodar localmente

### Tudo via Docker Compose (recomendado)

```bash
copy .env.example .env     # (Windows; Linux/macOS: cp) — ajuste os valores
docker compose up          # sobe db + backend + frontend
```

O serviço `backend` roda `docker/backend-entrypoint.sh`, que **aplica migrations, popula
`seed_dados` e cria o superuser** (vars `DJANGO_SUPERUSER_*`) automaticamente no start.
Frontend em `:5173`, API em `:8000/api/`, admin em `:8000/admin/`. Código com hot reload
(bind mount). Testes: `docker compose exec backend python -m pytest`.

### Sem Docker (só backend)

```bash
python -m venv .venv && .venv\Scripts\activate      # Windows
pip install -r requirements.txt
copy .env.example .env                                # mantenha DB_HOST=localhost
docker compose up -d db                               # só o PostgreSQL
python manage.py migrate
python manage.py createsuperuser
python manage.py seed_dados                           # opcional
python manage.py runserver
python -m pytest                                      # testes
```

### Variáveis de ambiente (`.env`)

`SECRET_KEY`, `DEBUG`, `ALLOWED_HOSTS`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST`,
`DB_PORT`, `CORS_ALLOWED_ORIGINS`. Opcionais para o compose: `DJANGO_SUPERUSER_USERNAME/
EMAIL/PASSWORD`, `VITE_API_URL`, `VITE_WHATSAPP`. Veja `.env.example`.

> No compose, o serviço `backend` sobrescreve `DB_HOST=db` (nome do serviço do Postgres na
> rede do Docker). O `django-environ` lê o `.env` sem sobrescrever vars já definidas pelo
> compose, então `DB_HOST=db` prevalece dentro do container.

## Decisões técnicas e convenções

- **App único `catalogo`** + projeto `config` — escopo pequeno não justifica múltiplos apps.
- **PT-BR** em toda a interface: `LANGUAGE_CODE = "pt-br"`, `verbose_name`/mensagens em português.
- **Permissão padrão** `IsAuthenticatedOrReadOnly` no DRF: leitura livre, escrita só com JWT.
- **Vitrine vs. admin** no mesmo `PecaViewSet`: `get_queryset` filtra `ativo=True` para anônimos
  e devolve tudo para autenticados.
- **`esgotado`** exposto como campo read-only derivado da property do model.
- **Tratamento de erros**: `EXCEPTION_HANDLER` customizado (`catalogo/exceptions.py`) garante
  resposta informativa; nunca falhar em silêncio. Mensagens de validação em PT-BR.
- **Segredos só em `.env`** (no `.gitignore`); nada de credenciais no código; não logar segredos.
- **Docker Compose** sobe a stack completa (db + backend + frontend) com hot reload; o
  entrypoint do backend automatiza migrate/seed/superuser. Postgres também pode subir sozinho
  (`docker compose up -d db`) para desenvolvimento sem container do app.
- **Testes com pytest-django** (`pytest.ini` aponta `DJANGO_SETTINGS_MODULE=config.settings`).

## Histórico de mudanças

- **2026-06-19** — Criação inicial do backend: models (Categoria, Peca, Variacao, Imagem),
  serializers aninhados com `esgotado`, ViewSets (vitrine pública + CRUD admin), JWT (login/
  refresh), CORS, admin com inlines, comando `seed_dados`, paginação (`PAGE_SIZE=20`),
  handler de erros PT-BR e suíte de testes (14 testes passando).
- **2026-06-20** — Frontend React/Vite (área do cliente) adicionado em `frontend/`. Docker
  Compose ampliado para a stack completa: `Dockerfile` do backend + `docker/backend-entrypoint.sh`
  (migrate/seed/superuser automáticos) e `frontend/Dockerfile` (Vite dev). Agora `docker compose
  up` sobe tudo.
- **2026-06-20** — Correção do campo `tamanho`: o `VariacaoSerializer` passou a declarar
  `tamanho` como `CharField` (texto livre), aceitando valores numéricos (`12`, `38`) que antes
  eram recusados pelo `ChoiceField` automático. O handler de erros (`exceptions.py`) deixou de
  mascarar erros por campo — o `detalhe` genérico só entra quando não há nenhum erro específico.
  No frontend, `mensagemDeErro` prioriza erros por campo (ex.: "Tamanho: ...") e o
  `NovaPecaModal` tolera falha parcial (não recria a peça já criada; reenvia só a variação/imagem
  que falhou). Novo teste `test_variacao_aceita_tamanho_livre` (15 testes passando).
- **2026-06-20** — Encomenda sob medida: novos models `Encomenda` + `EncomendaImagem` (migration
  `0002`), `EncomendaSerializer` (leitura admin) + `EncomendaCreateSerializer` (criação pública com
  validação de imagens: máx. 5, 5 MB, jpg/png/webp), `EncomendaViewSet` com permissão por ação
  (`create`=AllowAny; resto=IsAuthenticated), parsers multipart+JSON, throttle escopo `encomendas`
  (`10/hour`) só no create, e PATCH só de status. Registrado no Django Admin com inline de imagens.
  Endpoint público não ecoa nome/contato. `test_encomendas.py` cobre criação pública com imagens
  (201/`recebido`), obrigatórios (400), anônimo não lista (401), admin lista/PATCH status/exclui,
  e limites de imagens (quantidade/tipo/tamanho). Suíte: **24 testes passando**.
- **2026-06-20** — Campo `destaque` (bool, default False) na `Peca` (migration `0003`) para curadoria
  da Home. Exposto/editável no `PecaSerializer`, filtrável em `?destaque=true` na listagem pública,
  e no Django Admin (`list_editable`/`list_filter`). Testes de retorno do campo e do filtro.
  Suíte: **26 testes passando**.
- **2026-06-21** — Exclusão em cascata + nome único (migration `0004`): `Peca.categoria` passou de
  `PROTECT` para **`CASCADE`** (excluir categoria remove suas peças e, em cascata, variações/imagens)
  e `Peca.nome` virou **`unique=True`** (mensagem PT-BR "Já existe uma peça com esse nome." no
  `PecaSerializer` via `UniqueValidator`, ignorando a própria peça em PATCH/PUT). A migration tem uma
  data migration que **desduplica nomes repetidos** (sufixo " (N)") antes de criar o índice único.
  Novo `test_exclusao.py` (6 testes): cascata de categoria/peça/variação e nome duplicado na
  criação/edição. Suíte: **32 testes passando**.
- **2026-06-21** — Paleta de cores + limites de campos + categoria única (migration `0005`):
  novo model **`Cor`** (`nome` único `max_length=30` + `hex` `#RRGGBB` validado por `RegexValidator`),
  endpoint **`/api/cores/`** (CRUD; leitura pública, escrita JWT) via `CorViewSet`/`CorSerializer`,
  registrado no Django Admin. `Variacao` ganhou **`cor_hex`** (`max_length=7`, `blank=True`) exposto no
  `VariacaoSerializer` para o swatch (mantendo `cor` texto livre e `unique_together` intacto).
  `Categoria.nome` virou **`unique=True`** (mensagem "Já existe uma categoria com esse nome." via
  `UniqueValidator`; a migration desduplica nomes repetidos antes do índice, padrão da `0004`).
  Limites: `Peca.nome` 150→**80**, `Peca.descricao`/`Encomenda.descricao` **`max_length=600`**,
  `Encomenda.nome` 150→**80**; `PecaSerializer` valida **preço** entre `0` e `1000000.00`
  ("O preço não pode ser negativo." / "Preço acima do permitido."). Novo `test_validacoes.py`
  (6 testes). Suíte: **38 testes passando**.
