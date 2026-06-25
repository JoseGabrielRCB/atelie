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
- requests 2.32 (chamadas HTTP ao bot de WhatsApp — Evolution API)
- reportlab 4.2 (geração de PDF dos relatórios — puro Python, sem libs do sistema)
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
    ├── relatorios.py     # relatórios financeiros (agregação no servidor + CSV/PDF)
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
`unique_together = (peca, tamanho, cor)` (continua só sobre `cor`, NÃO virou FK). Duplicar a
combinação retorna `400` com mensagem PT-BR amigável (`UniqueTogetherValidator` explícito no
`VariacaoSerializer`: "Já existe uma variação com esse tamanho e cor para esta peça.").
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

**Pedido** — compra online de **peças prontas** paga via Mercado Pago (Checkout Pro). `nome`
(`max_length=80`), `contato` (`max_length=100`), `status` (choices: `aguardando_pagamento`
(default) | `pago` | **`em_revisao`** | `expirado` | `cancelado`), `motivo_revisao` (CharField
`blank`, choices `divergencia_valor` | `pago_apos_expiracao` | `sem_estoque_apos_pago` — preenchido
quando `status==em_revisao`; migration `0014`), `total` (Decimal 10,2 — calculado no servidor),
`mp_preference_id` (blank), `mp_payment_id` (blank), `codigo_rastreio` (CharField `max_length=60`,
`blank=True` — código dos Correios preenchido pelo admin **só** em pedido pago; migration `0013`;
NÃO muda o status, é só informativo), `criado_em` (auto_now_add), `expira_em`
(DateTimeField — `criado_em + 30 min`). ordering `-criado_em`. NÃO confundir com Encomenda
(fluxo sob medida via WhatsApp, intacto). **`em_revisao`** = pago no MP mas NÃO atendido (precisa de
ação do dono: estorno/análise); **não baixa estoque**.

**ItemPedido** — `pedido` (FK→Pedido, `CASCADE`, related_name `itens`), `variacao`
(FK→Variacao, **`on_delete=PROTECT`** para preservar o histórico financeiro), `quantidade`
(PositiveInteger, `MinValueValidator(1)`), `preco_unit` (Decimal 10,2 — preço travado no momento
da compra, lido do banco). **Implicação do PROTECT**: como Variacao/Peca/Categoria usam CASCADE
entre si, excluir uma Peca/Categoria cuja variação esteja referenciada por algum ItemPedido será
**bloqueado** (`ProtectedError`) — intencional, para não perder o histórico de compras pagas.

**EventoPagamento** — `evento_id` (CharField **único** — id do pagamento/data.id do MP, para
idempotência do webhook), `criado_em` (auto_now_add). Garante que a mesma notificação não
decremente o estoque duas vezes.

**MensagemWhatsApp** — `mensagem_id` (CharField **único** — `data.key.id` do evento
`messages.upsert`, para idempotência do webhook de entrada do bot), `criado_em` (auto_now_add).
Garante que um reenvio da mesma mensagem do dono não ajuste o estoque duas vezes. Registrado no
Django Admin como read-only (sem botão de adicionar).

**Perfil** — perfil de acesso ao painel (**OneToOne** com o `User` do Django; **NÃO** trocamos
`AUTH_USER_MODEL`). Campos: `usuario` (OneToOne→User, `CASCADE`, related_name `perfil`), `papel`
(`dono` | `funcionario`, default `funcionario`), `ativo` (bool, default True), `acesso_financeiro`
(bool, default False — libera a seção Vendas para um funcionário), `senha_provisoria` (bool, default
False — força a troca no próximo acesso), `criado_por` (FK→User, `SET_NULL`, nulo), `criado_em`
(auto_now_add). Propriedades: `eh_dono`, `pode_financeiro` (dono **ou** `acesso_financeiro`). É o
MESMO ateliê (não é multi-loja): um Dono gerencia contas de Funcionários. Migrations `0008` (modelo)
e `0009` (data migration: cria `Perfil(papel='dono')` para superusers existentes — o dono atual não
perde acesso). Registrado no Django Admin.

**Cliente** — conta de **cliente da loja** (compra com login; **OneToOne** com `User`). Campos:
`usuario` (OneToOne→User, `CASCADE`, related_name `cliente`), `nome` (max 120), `cpf` (CharField 11,
**único**, guardado **só dígitos**, validado por dígitos verificadores em `catalogo/validators.py`),
`telefone` (max 20, blank), `criado_em`. O **e-mail é o login** (`User.username == User.email`,
`is_staff=False`). Distinção de audiência: **cliente** tem `Cliente` e NÃO tem `Perfil`; **staff** tem
`Perfil`. Um token vale só no seu contexto (reforçado por `EhCliente` / pelas permissões de staff).
Migration `0010`. Registrado no Django Admin. (Sem endereço/entrega neste MVP — "combinar à parte".)

**Promocao** — desconto gerido no FINANCEIRO do admin (migration `0011`, que também adiciona
`Pedido.cupom` FK + `Pedido.desconto`). Campos: `nome`, `tipo_aplicacao` (`cupom` | `automatica`),
`codigo` (vazio p/ automática; **único entre cupons** via `UniqueConstraint` condicional),
`tipo_desconto` (`percentual` | `valor`) + `valor` (Decimal), `escopo` (`tudo` | `peca` | `categoria`)
+ `pecas`/`categorias` (**M2M — pode escolher mais de uma**, migration `0012`), `inicio`/`fim`
(datetime, opcionais), `limite_uso` (opcional) +
`usos` (default 0), `acumulavel` (bool), `ativo`, `criado_em`. Métodos: `vigente()`, `casa_peca()`,
`desconto_unitario(preco)`. **Todo o cálculo de desconto é no servidor** (`catalogo/promocoes.py`):
automática aplica ao preço de exibição (escopo); cupom valida (vigência + escopo) e aplica %/R$;
acúmulo = soma (cupom acumulável por cima da automática) ou o MAIOR dos dois; total nunca < 0. Os
`usos` só incrementam quando o pedido é **pago** (webhook, com lock). Registrado no Django Admin.
Dinheiro é sempre **Decimal** e arredonda para centavos com **ROUND_HALF_UP** (`desconto_unitario`
no model e todo o motor em `promocoes.py`) — não o `ROUND_HALF_EVEN` padrão do Python.

### Papéis e permissões (a fonte da verdade é o backend)

`catalogo/permissions.py` lê `request.user.perfil` e expõe os helpers `perfil_efetivo(user)`
(devolve o `Perfil` ativo, ou `None` se anônimo/inativo; **superuser sem Perfil = Dono virtual
ativo**, p/ não travar o acesso), `eh_dono(user)` e `pode_financeiro(user)`. Classes de permissão:

- **`LeituraPublicaEscritaEquipe`** — GET livre; escrita exige Dono **ou** Funcionário ativo. Aplicada
  em `categorias`, `cores`, `pecas`, `variacoes`, `imagens` (catálogo/estoque/categorias/cores/destaques).
- **`EhEquipeAtiva`** — Dono ou Funcionário ativo. Ações não-públicas de `encomendas` (ver/status/excluir).
- **`PodeFinanceiro`** — Dono, ou Funcionário com `acesso_financeiro=True`. Aplicada em `pedidos` (Vendas).
- **`SoDono`** — só Dono (não liberável). Aplicada em `usuarios` e nas Configurações de WhatsApp
  (`/whatsapp/status|conectar|desconectar|dono`).
- **`EhCliente`** — conta de CLIENTE (tem `Cliente`, sem `Perfil`, `is_staff=False`). Aplicada em
  `/api/conta/me|senha|pedidos/` e no **checkout**. Staff é recusado (e cliente é recusado no painel).

Funcionário **inativo** (`ativo=False`) é bloqueado: a desativação sincroniza `User.is_active=False`
(o `JWTAuthentication` recusa o token) **e** `perfil_efetivo` devolve `None` (permissões negam). O
login (`TokenComPapelSerializer`) também recusa perfil inativo. Senhas/segredos NUNCA são logados;
a senha provisória gerada num reset volta UMA vez na resposta (para o Dono repassar).

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
13. **Disponibilidade (anti-oversell)**: o disponível público de uma variação = `Variacao.estoque`
    − soma das `ItemPedido.quantidade` de pedidos `aguardando_pagamento` **e** `expira_em > agora`.
    Calculado em `catalogo/estoque.py` (`disponibilidade(variacoes)` / `disponivel_de(v)`), exposto no
    `VariacaoSerializer` como `disponivel` (int, nunca negativo). O campo `esgotado` continua refletindo
    `estoque == 0` (não considera reservas) — o frontend deve usar **`disponivel`** para decidir compra.
14. **Pagamento só de peças prontas**: o checkout valida que cada variação pertence a uma peça
    `ativo == True` e `tipo == pronta`. O fluxo de **Encomenda** (sob medida, WhatsApp) é intocado.
15. **Preço/total no servidor**: o checkout SEMPRE recalcula `preco_unit`/`total` a partir de
    `Variacao.peca.preco` no banco; qualquer valor de preço/total enviado pelo cliente é ignorado.
16. **Estoque só decrementa após pagamento aprovado** (webhook), dentro de `transaction.atomic()`
    com `select_for_update()` nas variações e idempotência por `EventoPagamento`. Nunca fica negativo:
    se o estoque acabou na hora da confirmação (corrida), o pedido é marcado `cancelado`.
17. **Checkout hospedado (PCI)**: o cliente paga na página do Mercado Pago. Nenhum dado de cartão
    passa por nós nem é armazenado. Segredos (`MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET`) só em env;
    nunca logados; dados do cliente do Pedido (`nome`/`contato`) e do pagamento não são logados.
18. **Estoque alterado no painel avisa o dono**: `PATCH /api/variacoes/{id}/` com mudança em
    `estoque` dispara WhatsApp `"Estoque atualizado no painel..."` e reaproveita o alerta de
    estoque baixo. `DELETE /api/variacoes/{id}/` dispara `"Variação removida no painel..."`.

## API

Base: `/api/`. Respostas de lista são **paginadas** (`PageNumberPagination`, `PAGE_SIZE=20`):
`{ "count", "next", "previous", "results": [...] }`.

### Públicos (leitura, sem autenticação)

- `GET /api/categorias/` — lista categorias.
- `GET /api/cores/` — lista a paleta de cores (`{ "id", "nome", "hex" }`). `GET /api/cores/{id}/`
  para detalhe. Escrita (POST/PUT/PATCH/DELETE) exige JWT de admin.
- `GET /api/pecas/` — lista peças **ativas** com variações e imagens aninhadas.
  Filtros: `?categoria=<id>`, `?tipo=pronta|sob_medida`, `?destaque=true` (peças em destaque),
  busca `?search=<texto>` (nome/descrição), ordenação `?ordering=preco|-criado_em|nome`. Cada peça
  expõe `preco_promocional` e `em_promocao` (promoção **automática** ativa, calculada no servidor).
- `GET /api/pecas/{id}/` — detalhe de uma peça.
- `POST /api/encomendas/` — **público** (`AllowAny`): cria uma encomenda sob medida via
  `multipart/form-data`. Campos: `nome`*, `contato`*, `descricao`*, `tamanho_medidas`,
  `prazo_desejado` (`YYYY-MM-DD`) e `imagens` (0–5 arquivos no MESMO campo, lidos com
  `request.FILES.getlist("imagens")`). Limites: máx. 5 imagens, 5 MB cada, tipos jpg/jpeg/png/webp.
  Status inicial sempre `recebido`. Resposta `201`: `{ "id", "status", "mensagem" }` (NÃO ecoa
  nome/contato). Erros `400` com chaves por campo em PT-BR (ex.: `{ "imagens": ["..."] }`).
  Anti-spam: throttle com escopo `encomendas` (`10/hour`) só nessa ação → `429` se exceder.
- `POST /api/checkout/` — **exige conta de cliente** (`EhCliente`): cria um `Pedido` de peças
  prontas + a preferência de pagamento no Mercado Pago. Body JSON: `{ "itens": [{ "variacao_id",
  "quantidade" }, ...], "cupom"? }` — **nome/contato/CPF vêm da conta autenticada** (não do corpo).
  Grava `pedido.cliente` e `nome`/`contato` (snapshot) a partir do `Cliente`. Valida peça
  ativa/pronta, quantidade ≥ 1 e disponibilidade; recalcula preço/total no servidor aplicando
  promoções automáticas + cupom (motor `catalogo/promocoes.py`); grava `cupom`/`desconto` e `total`
  já descontado. **Reserva travada**: a validação de disponibilidade e a criação do Pedido/itens
  rodam em `transaction.atomic()` com `select_for_update(of=("self",))` nas variações — dois
  checkouts simultâneos da MESMA última unidade são serializados (o 2º já vê a reserva do 1º e recebe
  `409`). Cria o pedido `aguardando_pagamento` (`expira_em = agora + 30min`) **sem**
  decrementar estoque. Quando há desconto, o MP recebe **uma linha** com o total descontado (garante
  cobrança == total do servidor); senão, as linhas por item. Envia o **payer** (CPF). Resposta `201`:
  `{ "pedido_id", "init_point" }`. Erros: `401`/`403`, `400 {"itens"}`, `409 {"disponibilidade"}`,
  `502 {"detalhe"}`. Throttle `encomendas`.
- `POST /api/cupom/validar/` — **público** (`AllowAny`, throttle `encomendas`): body `{ "codigo",
  "itens" }` → pré-valida o cupom contra o carrinho e devolve `{ valido, desconto, total_bruto,
  total, mensagem }` (PT-BR: inválido/expirado/não iniciado/esgotado/escopo não casa). NÃO aplica
  nada — só informa antes de pagar; o desconto definitivo é recalculado no checkout.
- `POST /api/webhooks/mercadopago/` — **público** (`AllowAny`, CSRF-exempt): recebe notificações
  `payment` do Mercado Pago. Valida a assinatura HMAC (`x-signature` + `x-request-id` +
  `MP_WEBHOOK_SECRET`) → `401` se inválida. Idempotente via `EventoPagamento` (evento repetido =
  no-op). Se `approved`, três casos viram **`em_revisao`** (pago no MP, mas NÃO atendido — **não
  baixa estoque**; o dono trata/estorna pelo admin) com lock + log sem PII:
  (1) valor aprovado (`transaction_amount`) **diverge** do `Pedido.total` (±1 centavo) →
  `divergencia_valor`; (2) pago **após a expiração** (`expira_em` já passou / pedido `expirado`) →
  `pago_apos_expiracao`; (3) **sem estoque** na confirmação (corrida) → `sem_estoque_apos_pago`
  (estoque revalidado sob `select_for_update`, nunca fica negativo). Tudo certo → decrementa estoque
  (lock + nunca negativo), marca `pago`, conta `usos` do cupom e dispara `compra_paga`. Sempre `200`.
- `POST /api/webhooks/whatsapp/` — **público** (`AllowAny`, CSRF-exempt, `authentication_classes=[]`):
  webhook de ENTRADA do bot de WhatsApp do dono (Evolution API, evento `messages.upsert`). Privado
  de fato por **autorização de remetente**: só processa se o número (de `data.key.remoteJid`, sem o
  sufixo `@...` e só dígitos) estiver em `settings.WHATSAPP_DONO` — qualquer outro é **ignorado em
  silêncio** (`200`, sem resposta). Para números brasileiros, a comparação aceita a variação com e
  sem o nono dígito (a Evolution/Baileys pode entregar o JID como `55+DDD+8 dígitos`). Quando a
  Evolution entrega `remoteJid` como `...@lid`, o webhook também aceita ids configurados em
  `WHATSAPP_DONO_LID` (só para ENTRADA; envio continua via `WHATSAPP_DONO`). Ignora
  `fromMe: true` e mensagens sem texto. **Idempotência** por
  `MensagemWhatsApp` (`data.key.id`): reenvio do mesmo id é no-op. O texto (`conversation` ou
  `extendedTextMessage.text`) é roteado por `catalogo/comandos.interpretar(texto) -> str` e a resposta
  é enviada via `enviar_whatsapp`. **Sempre** retorna `200` rápido — erro de processamento é engolido
  (loga falha genérica, sem PII) para a Evolution não reenviar. Espelha `WebhookMercadoPagoView`.
  Comandos (PT-BR, case-insensitive, tolerante a acento): `estoque <peça>` (lista variações/estoque
  das peças por `nome icontains`); `baixa <qtd> <peça> <tamanho> <cor>` (subtrai, nunca negativo —
  recusa se `qtd > estoque`, depois `checar_estoque_baixo`); `repor <qtd> <peça> <tamanho> <cor>`
  (soma); `ajuda`/desconhecido → texto de ajuda. No baixa/repor o **último token é a cor**, o
  **penúltimo é o tamanho** e os iniciais o nome da peça (match `nome icontains` + `tamanho iexact` +
  `cor iexact`); 0 ou >1 variações → pede para ser mais específico (mostra candidatos). Ajustes
  rodam em `transaction.atomic()` com `select_for_update()`.

### Admin (exigem JWT — escrita bloqueada por `IsAuthenticatedOrReadOnly`)

- CRUD completo: `categorias`, `cores`, `pecas`, `variacoes`, `imagens` (POST/PUT/PATCH/DELETE).
  Em `variacoes`, alterar `estoque` ou remover a variação pelo painel dispara notificação ao dono.
- **Encomendas** (`IsAuthenticated`): `GET /api/encomendas/` (lista paginada, imagens aninhadas,
  filtro `?status=`), `GET /api/encomendas/{id}/`, `PATCH /api/encomendas/{id}/` (atualiza
  `status`), `DELETE /api/encomendas/{id}/`. Permissão por ação (`get_permissions`: `create` =
  `AllowAny`; demais = `IsAuthenticated`). O viewset aceita multipart (create) e JSON (PATCH).
- **Pedidos** (`PodeFinanceiro`, somente leitura **exceto o rastreio**): `GET /api/pedidos/` (lista
  paginada, itens aninhados, filtro `?status=`), `GET /api/pedidos/{id}/`. Campos: `id`, `codigo`,
  `nome`, `contato`, `status`, `motivo_revisao`, `total`, `mp_preference_id`, `mp_payment_id`,
  `codigo_rastreio`, `criado_em`, `expira_em`, `itens`
  (`[{ id, variacao, variacao_descricao, peca_nome, quantidade, preco_unit }]`). Anônimo → `401`.
  `codigo` = código de compra legível e estável (`Pedido.codigo`, ex.: `PED-000042`, derivado do id —
  sem campo/migration), usado pelo cliente, pelo admin (Vendas) e nas telas de retorno do pagamento.
  - `PATCH /api/pedidos/{id}/rastreio/` — grava/edita **só** o `codigo_rastreio` (body
    `{ "codigo_rastreio" }`; vazio remove). Validado no servidor: **só em pedido `pago`** (senão `400`),
    máx. 60 chars, **não altera o status**. Demais campos seguem read-only. Gate financeiro.
- **Promoções** (`PodeFinanceiro` — Dono ou funcionário com `acesso_financeiro`):
  `GET/POST/PATCH/DELETE /api/promocoes/` (CRUD de promoções/cupons; filtros `?tipo_aplicacao=`,
  `?ativo=`, `?escopo=`; `usos` é só leitura). Escopo por **peça(s)/categoria(s)** aceita várias
  (`pecas`/`categorias` = listas de ids; expõe `pecas_nomes`/`categorias_nomes`). Funcionário sem
  financeiro → `403`. Validações PT-BR: código único entre cupons, percentual ≤ 100, escopo exige ao
  menos uma peça/categoria, fim depois do início (data **e hora**). O desconto em R$ **pode** passar
  do preço da peça — o motor garante total ≥ 0 na hora de aplicar.
- **Relatórios** (`PodeFinanceiro` — Dono ou funcionário com `acesso_financeiro`; só leitura):
  agregações no servidor sobre `Pedido` com `status="pago"` + `ItemPedido` + cupom — **sem mudança
  de schema**. Tudo em `catalogo/relatorios.py`, respeitando `settings.TIME_ZONE` (instantes em UTC
  agrupados/filtrados pelo dia **local** via `Trunc*(tzinfo=...)`). Cada endpoint devolve **JSON** por
  padrão e, com `?formato=csv|pdf`, **baixa o arquivo** (CSV nativo com `;` + BOM para o Excel PT-BR;
  PDF com **reportlab**, import tardio). Relatórios são agregados — **não** expõem nome/contato/CPF.
  - `GET /api/relatorios/vendas-por-periodo/?de=&ate=&granularidade=dia|semana|mes` → faturamento (R$)
    e nº de pedidos pagos por período + `totais` (`faturamento`, `pedidos`, `ticket_medio`). Default:
    últimos 30 dias. `400` se data inválida ou `de > ate`.
  - `GET /api/relatorios/produtos-mais-vendidos/?de=&ate=&top=` → ranking de variações por
    `quantidade` e `receita` (top N, default 20, máx 100).
  - `GET /api/relatorios/resumo-do-mes/?mes=AAAA-MM` → `faturamento`, `num_vendas`, `ticket_medio`,
    `desconto_concedido` e `cupons` (análise: por cupom usado em pedidos pagos, `usos` e
    `valor_descontado` = soma do `Pedido.desconto`). A análise de descontos vive aqui (não é 4º
    relatório). Default: mês atual.
- **Conexão do WhatsApp** (`IsAuthenticated`) — o backend é PROXY da Evolution (guarda a
  `EVOLUTION_API_KEY`; o navegador nunca a vê). Toda lógica em `catalogo/evolution.py` (degrada sem
  exceção, não loga segredo/QR):
  - `GET /api/whatsapp/status/` → `{ configurado, estado, instancia }` (`estado`: `open`/`connecting`/
    `close`/`nao_criada`/`nao_configurado`/`indisponivel`/`desconhecido`).
  - `POST /api/whatsapp/conectar/` → garante a instância (cria se 404) e devolve o QR:
    `{ estado, qr_base64, pairing_code, mensagem }`.
  - `POST /api/whatsapp/desconectar/` → logout da instância → `{ ok, mensagem }`.
  - `GET /api/whatsapp/dono/` → `{ numero, configurado }`; `PATCH/PUT /api/whatsapp/dono/` com `{ "numero" }` atualiza `WHATSAPP_DONO`, salva no `.env` e aplica em memória (admin/JWT).
- `POST /api/auth/login/` — body `{ "username", "password" }` → `{ "access", "refresh" }`. O token
  inclui as claims `papel` e `acesso_financeiro` (cru) para o front decidir o que mostrar; o backend
  reforça as permissões de qualquer forma. Recusa conta inativa.
- `POST /api/auth/refresh/` — body `{ "refresh" }` → `{ "access" }`.

### Contas do painel (multiusuário)

- `GET /api/me/` (logado) → `{ usuario, nome, papel, ativo, senha_provisoria, acesso_financeiro }`.
- `POST /api/me/senha/` (logado) — `{ "senha_atual", "nova_senha" }`; troca a própria senha e **limpa**
  `senha_provisoria`. Valida a senha nova (validadores do Django) e confere a atual.
- `GET/POST/PATCH/DELETE /api/usuarios/` (**só Dono** — `SoDono`): gere FUNCIONÁRIOS (lista só perfis
  `funcionario`). `POST` cria com **senha provisória definida pelo Dono** + `senha_provisoria=True`
  e aceita `acesso_financeiro` (default False). `PATCH` aceita `ativo` (sincroniza `User.is_active`),
  `acesso_financeiro` e o reset de senha: `{"resetar_senha": true}` gera uma provisória aleatória e a
  devolve UMA vez em `senha_provisoria_gerada` (ou `{"senha": "..."}` para definir manualmente).
  Validações PT-BR: usuário/e-mail únicos, senha mínima. Não ecoa nem loga senhas.

### Conta do cliente da loja (login separado do staff)

- `POST /api/conta/cadastro/` (`AllowAny`): `{ nome, email, cpf, telefone?, senha }` → cria
  `User` (`username=email`, `is_staff=False`) + `Cliente`. Valida e-mail/CPF únicos, CPF (dígitos
  verificadores) e senha mínima (PT-BR). Não ecoa CPF/senha. Throttle escopo `encomendas`.
- `POST /api/conta/login/` → JWT do cliente (login por **e-mail**+senha). **Recusa staff** (e o
  painel `auth/login` recusa cliente). Claim `audiencia="cliente"`.
- `GET /api/conta/me/` (`EhCliente`) → `{ nome, email, cpf (formatado), telefone, criado_em }`;
  `PATCH` edita **só `nome`/`telefone`** (e-mail e CPF são read-only no MVP).
- `POST /api/conta/senha/` (`EhCliente`) — `{ senha_atual, nova_senha }`.
- `GET /api/conta/pedidos/` (`EhCliente`) — histórico **só do próprio** cliente (paginado). Inclui
  `codigo_rastreio` quando o admin já o preencheu (o cliente acompanha pelos Correios).
- Refresh: reusa `POST /api/auth/refresh/` (SimpleJWT é genérico; o front guarda os tokens do
  cliente em chave de storage separada da do admin).
- **Fora do MVP** (anotado, não implementado): verificação de e-mail e recuperação de senha por
  e-mail (exigem serviço de e-mail); endereço/entrega ("combinar à parte").

### Como autenticar

1. `POST /api/auth/login/` com usuário/senha do Dono (superuser) ou de um Funcionário.
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
`DB_PORT`, `CORS_ALLOWED_ORIGINS`. **Pagamento (Mercado Pago)**: `MP_ACCESS_TOKEN` (token do
servidor), `MP_WEBHOOK_SECRET` (assinatura do webhook), `MP_PUBLIC_URL` (base HTTPS pública do
backend p/ `notification_url`; em dev use um túnel tipo ngrok), `FRONTEND_URL` (base do frontend
p/ as `back_urls`). Defaults dev-safe (token/segredo vazios; URLs `localhost`). Opcionais para o
compose: `DJANGO_SUPERUSER_USERNAME/EMAIL/PASSWORD`, `VITE_API_URL`, `VITE_WHATSAPP`. Veja
`.env.example`.

**Bot de WhatsApp (Evolution API)**: `EVOLUTION_URL` (base da API; `http://localhost:8080` no
host, `http://evolution-api:8080` na rede do compose), `EVOLUTION_API_KEY` (chave global, header
`apikey`), `EVOLUTION_INSTANCE` (nome da instância, ex.: `atelie-bot`), `WHATSAPP_DONO` (**lista**
— números autorizados separados por vírgula, só dígitos, formato internacional, ex.:
`5567999990000`) e `ESTOQUE_BAIXO_LIMIAR` (**int**, default 1 — variação com estoque `<=` esse
valor dispara alerta). Lidos em `settings.py` como `settings.EVOLUTION_URL`/`EVOLUTION_API_KEY`/
`EVOLUTION_INSTANCE`/`WHATSAPP_DONO` (list)/`ESTOQUE_BAIXO_LIMIAR` (int), defaults dev-safe
(strings vazias / `[]` / `1` → recurso desligado). Opcionais: `EVOLUTION_WEBHOOK_URL` (default
`http://backend:8000/api/webhooks/whatsapp/`), `WHATSAPP_DONO_LID` (lista de LIDs autorizados para
mensagens recebidas quando a Evolution entrega `@lid`) e `EVOLUTION_WA_VERSION` (versão do WhatsApp
Web usada pelo Baileys; atualizar quando o QR ficar preso em `connecting`; valor atual validado:
`2.3000.1035194821`). No Docker, `ALLOWED_HOSTS` deve incluir `backend`, pois a Evolution chama o
Django por `http://backend:8000`.

### Expiração de pedidos e signal

- Comando `python manage.py expirar_pedidos`: marca pedidos `aguardando_pagamento` com
  `expira_em <= agora` como `expirado` (libera a disponibilidade). Rode periodicamente via
  cron/scheduler (ex.: a cada 5 min: `*/5 * * * * python manage.py expirar_pedidos`; no compose:
  `docker compose exec backend python manage.py expirar_pedidos`).
- Signal `catalogo.signals.compra_paga` (`django.dispatch.Signal`): disparado após confirmar um
  pagamento. Args: `sender=Pedido`, `pedido=<Pedido>`. O bot de WhatsApp do dono se inscreve nele.
- Signal `catalogo.signals.encomenda_criada` (`django.dispatch.Signal`): disparado em
  `EncomendaViewSet.create` após salvar a encomenda + imagens. Args: `sender=Encomenda`,
  `encomenda=<Encomenda>`. O bot do dono se inscreve para avisar de nova encomenda no painel.

### Notificações do dono (bot de WhatsApp)

- Módulo `catalogo/notificacoes.py`: serviço de envio + receivers dos signals acima. Notifica
  **apenas o dono** (`settings.WHATSAPP_DONO`), nunca o cliente.
- `enviar_whatsapp(texto, bloquear=False)`: envia para cada número via Evolution sendText
  (`POST {EVOLUTION_URL}/message/sendText/{EVOLUTION_INSTANCE}`, header `apikey`). **Resiliente e
  não-bloqueante**: o HTTP roda numa **thread daemon** com timeout 10s; falhas são engolidas e
  logadas de forma genérica (só status code — nunca conteúdo nem apikey). **No-op silencioso** se
  `EVOLUTION_URL`/`EVOLUTION_API_KEY`/`WHATSAPP_DONO` não estiverem configurados (dev/testes não
  tocam a rede). `bloquear=True` envia síncrono (testes). O HTTP real fica em `_enviar_para` (fácil
  de monkeypatchar). Receivers conectados no `CatalogoConfig.ready()` (`apps.py`).
- Gatilhos (PT-BR): **compra paga** → `"🛒 Venda paga: 1× Vestido Floral M/Azul — R$ 199,90.
  Estoque agora: 2."` (uma linha por item; lê estoque fresco pós-decremento); **estoque baixo** →
  `"⚠️ Estoque baixo: Vestido Floral M/Azul = 1."` para itens com `estoque <= ESTOQUE_BAIXO_LIMIAR`
  (helper exportado `checar_estoque_baixo(variacoes)`, reusável); **estoque alterado no painel** →
  `"📦 Estoque atualizado no painel: Vestido Floral M/Azul — 3 → 1."` + checagem de estoque baixo;
  **variação removida no painel** → `"🗑️ Variação removida no painel: Vestido Floral M/Azul.
  Estoque anterior: 0."`; **nova encomenda** →
  `"📩 Nova encomenda de <nome> — '<descrição até ~60 chars>'. Veja no painel."` (único lugar com
  nome do cliente numa msg ao dono — vai só pro dono; o nome NUNCA é logado).
- **Dependência `requests`** (em `requirements.txt`): já presente na imagem atual; se reconstruir
  do zero, o `pip install -r requirements.txt` do build a instala. Caso instale em container vivo:
  `docker compose exec backend pip install requests` (não persiste — **rebuild da imagem** persiste).
- Os receivers são resilientes por construção: uma falha de WhatsApp NUNCA quebra o webhook do
  Mercado Pago nem o POST de encomenda.

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
- **Padronização — validação no servidor (regra):** todo limite/validação aplicado na interface
  (tamanho de texto, faixas numéricas, máscaras, obrigatoriedade, unicidade) **tem equivalente no
  backend** (modelo/serializer). A UI é conveniência; a fonte da verdade é o servidor — nunca confiar
  só no cliente (senão dá para burlar pelo navegador). Mensagens de validação em PT-BR.
- **Padronização — segredos e dados sensíveis (regra):** segredos só em `.env` (no `.gitignore`);
  nada de credenciais no código; **nunca logar segredos**. Dados sensíveis do cliente (nome, contato,
  medidas, dados de pagamento) **fora de logs e de URLs** (LGPD); o erro técnico detalhado fica nos
  logs do servidor, mas o que chega ao usuário é uma mensagem amigável (sem termos técnicos/inglês).
- **Docker Compose** sobe a stack completa (db + backend + frontend) com hot reload; o
  entrypoint do backend automatiza migrate/seed/superuser. Postgres também pode subir sozinho
  (`docker compose up -d db`) para desenvolvimento sem container do app.
- **Bot de WhatsApp (Evolution API)** — serviços `redis` (cache) + `evolution-api`
  (`atendai/evolution-api:v2.1.1`, porta `8080`) **não sobem por padrão**; suba sob demanda:
  `docker compose up redis evolution-api`. A Evolution usa banco PRÓPRIO `evolution` no Postgres
  `db`, **garantido pelo serviço one-shot `evolution-db-init`** (`docker/ensure-evolution-db.sh`,
  roda a CADA `up`, idempotente, cria o banco se faltar — funciona mesmo com `pgdata` pré-existente).
  A `evolution-api` `depends_on` o init (`condition: service_completed_successfully`), o `db`
  (healthy) e o `redis`. O `docker/db-init/01-evolution-db.sh` (init do volume) continua, mas o
  sistema **não depende mais só dele**. Cache no `redis`; **webhook global** para
  `/api/webhooks/whatsapp/` no backend, com `WEBHOOK_EVENTS_MESSAGES_UPSERT=true` obrigatório para
  mensagens de entrada chegarem ao Django; sessão persistida no volume `atelie_evolution`. Número
  **dedicado** (risco de banimento — nunca o principal da loja).
  **Nota importante para demo/AWS t3.micro:** a Evolution/Baileys pode ficar pesada ou parecer travada
  quando conecta um WhatsApp com muito histórico, muitos contatos/grupos, imagens/stickers ou mensagens
  antigas. Logs já mostraram `Timed Out`, `No session record`, `qrcodeCount` alto e deadlock no banco
  `evolution` (`IsOnWhatsapp`) durante sincronização. Para apresentação, prefira um WhatsApp dedicado,
  limpo e com poucas conversas; se o site parar de responder após mexer no WhatsApp, verifique primeiro
  `docker compose ps`, `docker logs atelie_evolution --tail 200` e reinicie a stack com
  `docker compose up -d db backend frontend redis evolution-db-init evolution-api`.
- **Testes com pytest-django** (`pytest.ini` aponta `DJANGO_SETTINGS_MODULE=config.settings`).

## Histórico de mudanças

- **2026-06-25** — **Auditoria de integridade** (catálogo/promoções/CRUD/fidelidade + RBAC/IDOR).
  Único bug claro corrigido: a duplicata de variação (`unique_together`) retornava a mensagem técnica
  padrão do DRF ("...devem criar um set único") — agora um `UniqueTogetherValidator` explícito devolve
  PT-BR amigável. Novo `test_integridade.py` (12 testes: variação/cor duplicada, edição sem falso
  "duplicado", promoção por escopo/vigência/sobreposição = maior desconto, **preço exibido == preço do
  checkout**, IDOR — cliente não vê pedido de outro → 404, RBAC — cliente não escreve catálogo/Vendas).
  Suíte: **210 testes**. Itens p/ o dono decidir (não alterados): única imagem principal não é forçada
  no servidor; `cor_hex` é **snapshot** (mudar a paleta não atualiza variações antigas); arquivos de
  imagem órfãos no disco ao excluir (cascata só no banco); hardening de produção (SECRET_KEY/secure
  cookies/HSTS) e troca de senha provisória forçada só no front.
- **2026-06-25** — **Pedido "em revisão"** (decisões da auditoria implementadas). Novo status
  `em_revisao` + campo `motivo_revisao` (`divergencia_valor`/`pago_apos_expiracao`/
  `sem_estoque_apos_pago`) — migration `0014`. **Checkout** passou a validar disponibilidade e criar
  o Pedido/itens em `transaction.atomic()` com `select_for_update(of=("self",))` nas variações
  (reserva travada contra corrida na última unidade). **Webhook**: os três casos problemáticos (valor
  divergente, pago após expiração, sem estoque na confirmação) viram `em_revisao` em vez de baixar
  estoque (idempotência preservada; logs sem PII) — o dono estorna pelo painel do MP. Admin › Vendas
  ganhou selo/filtro "Em revisão" + nota de estorno; o cliente vê mensagem amigável (sem jargão) em
  Meus pedidos. Novos `test_revisao.py` (7) e ajustes em `test_pagamentos`/`test_auditoria_financeira`.
  Alerta ao dono pelo bot ficou **adiado** (percebe pelo selo no admin). Suíte: **198 testes**.
- **2026-06-25** — **Auditoria financeira** do fluxo do dinheiro (mapa + provas). Dois ajustes de
  contrato: (1) o **webhook do MP confere `transaction_amount` contra `Pedido.total`** (anti-fraude,
  ±1 centavo) — divergência **não** confirma nem baixa estoque (pedido expira; log sem PII);
  (2) arredondamento de dinheiro passou a **ROUND_HALF_UP** explícito (`Promocao.desconto_unitario` +
  `promocoes.py`), em vez do `ROUND_HALF_EVEN` padrão. Novo `test_auditoria_financeira.py` (13 testes:
  três totais batem, HALF_UP, valor pago × total, snapshot de preço, Variacao paga PROTECT, usos do
  cupom uma vez com webhook duplicado, expiração não toca pago). Sem migration. Suíte: **191 testes**.
  Itens para decisão do dono (não alterados): oversell na corrida em que **dois** clientes pagam o
  último item (o 2º é `cancelado` e precisa de estorno no MP); e pagamento que chega **após** a
  expiração ser honrado se houver estoque.
- **2026-06-25** — **Código de rastreio dos Correios** (admin grava; cliente vê). Novo campo
  `Pedido.codigo_rastreio` (CharField `blank`, migration `0013`) exposto no `PedidoSerializer`. Nova
  action `PATCH /api/pedidos/{id}/rastreio/` no `PedidoViewSet` (gate financeiro): grava/edita só o
  rastreio, **valida que o pedido está pago** e **não muda o status**; demais campos read-only.
  `GET /api/conta/pedidos/` agora devolve `codigo_rastreio`. Front: campo editável no detalhe da
  venda (Admin › Vendas, só em pedido pago) + indicador discreto na lista; em Meus pedidos o cliente
  vê o código com **copiar** + link "Acompanhar nos Correios". Novo `test_rastreio.py` (5 testes).
  Suíte: **178 testes passando**.
- **2026-06-25** — **Relatórios financeiros** (gate `PodeFinanceiro`, só leitura) — **sem mudança de
  schema**. Novo módulo `catalogo/relatorios.py` (agregações sobre `Pedido` pago + `ItemPedido` +
  cupom, respeitando `settings.TIME_ZONE`) + 3 endpoints `GET /api/relatorios/{vendas-por-periodo,
  produtos-mais-vendidos,resumo-do-mes}/` (`_RelatorioView` base). Cada um devolve JSON e, com
  `?formato=csv|pdf`, **exporta o arquivo** (CSV nativo `;`+BOM; PDF via **reportlab**, import
  tardio). Resumo do mês inclui a **análise de cupons** (não é 4º relatório). Nova dependência
  `reportlab==4.2.5` (instalada no container; **rebuild persiste**). Novo `test_relatorios.py`
  (18 testes). Suíte: **173 testes passando**.
- **2026-06-25** — **Promoções e cupons** (financeiro do admin). Novo model **`Promocao`** (cupom |
  automática; %/R$; escopo tudo/peça/categoria com **M2M `pecas`/`categorias`** — várias por
  promoção, migrations `0011`+`0012`; período; limite/usos; acumulável) + `Pedido.cupom`/
  `Pedido.desconto`. Validação extra: fim depois do início (data e hora). Motor
  `catalogo/promocoes.py` (desconto SÓ no servidor:
  automática no preço de exibição, validação de cupom, acúmulo soma×maior, total nunca < 0).
  Endpoints: `PromocaoViewSet` (`/promocoes/`, gate `PodeFinanceiro`), `POST /cupom/validar/`
  (público), checkout aceita `cupom` e grava desconto/total descontado (MP recebe o total já
  descontado), webhook conta `usos` só quando **pago** (lock). `PecaSerializer` expõe
  `preco_promocional`/`em_promocao`. Novo `test_promocoes.py` (20 testes). Suíte: **152 testes**.
- **2026-06-25** — **Código de compra legível** (`Pedido.codigo`, ex.: `PED-000042`): propriedade
  derivada do id (sem campo/migration), única e fácil de ditar. Exposta no `PedidoSerializer`
  (`codigo`) e exibida no cliente (Meus pedidos), no admin (Vendas — lista + detalhe) e nas telas de
  retorno do pagamento (front formata o `external_reference` com o mesmo padrão via `lib/pedido.js`).
  `test_conta.py` confere o formato. Suíte: **132 testes passando**.
- **2026-06-25** — **Conta de cliente com login** (revertendo o "cliente sem login"; para enriquecer
  a compra/Mercado Pago). Novo model **`Cliente`** (OneToOne com `User`; `nome`, `cpf` único+validado,
  `telefone`; e-mail = login; `is_staff=False`, sem `Perfil`) — migration `0010` (+ `Pedido.cliente`
  FK `PROTECT` nulo p/ histórico). Novo `catalogo/validators.py` (`validar_cpf`/`cpf_valido`). Nova
  permissão **`EhCliente`** (separa cliente de staff nos dois sentidos). Endpoints `POST /conta/cadastro/`
  (`AllowAny`), `POST /conta/login/` (recusa staff), `GET/PATCH /conta/me/` (edita só nome/telefone),
  `POST /conta/senha/`, `GET /conta/pedidos/` (só os próprios). **`CheckoutView` agora exige
  `EhCliente`**: tira nome/contato do corpo (vêm da conta), grava `pedido.cliente` e envia o **payer**
  (CPF) ao MP (`criar_preferencia(..., payer=...)`). `test_pagamentos.py` ajustado (checkout autentica
  cliente) + novo `test_conta.py` (16 testes). Senhas/CPF/telefone nunca logados. Fora do MVP
  (anotado): verificação/recuperação de e-mail e endereço/entrega. Suíte: **131 testes passando**.
- **2026-06-24** — **Multiusuário com papéis fixos** (mesmo ateliê; NÃO é multi-loja). Novo model
  **`Perfil`** (OneToOne com `User`; `papel` dono/funcionario, `ativo`, `acesso_financeiro`,
  `senha_provisoria`, `criado_por`, `criado_em`) — migrations `0008` (modelo) + `0009` (cria
  `Perfil` dono para o superuser atual). Novo `catalogo/permissions.py` (`perfil_efetivo`/`eh_dono`/
  `pode_financeiro` + classes `LeituraPublicaEscritaEquipe`, `EhEquipeAtiva`, `PodeFinanceiro`,
  `SoDono`) aplicado a todos os recursos: catálogo/estoque/categorias/cores/destaques e encomendas =
  Dono/Funcionário; Vendas (`pedidos`) = Dono ou funcionário com `acesso_financeiro`; `usuarios` e
  Configurações de WhatsApp = só Dono. Login passou a `TokenComPapelSerializer` (claims `papel`/
  `acesso_financeiro`, recusa inativo). Novos endpoints: `GET /me/`, `POST /me/senha/` (limpa
  `senha_provisoria`) e `UsuarioViewSet` (`/usuarios/`, só Dono: criar funcionário c/ senha
  provisória, ativar/desativar sincronizando `User.is_active`, liberar/revogar financeiro, resetar
  senha gerando provisória mostrada uma vez, excluir). Senhas nunca logadas. Superuser sem `Perfil`
  age como Dono (não trava o `createsuperuser`). Novo `test_usuarios.py` (20 testes). Suíte: **114
  testes passando**.
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
- **2026-06-21** — Pagamento online (Mercado Pago / Checkout Pro) só para **peças prontas**
  (migration `0006`): novos models **`Pedido`**, **`ItemPedido`** (FK `variacao` `PROTECT`) e
  **`EventoPagamento`** (idempotência do webhook). Camada fina `catalogo/pagamentos.py` (toda a
  SDK do MP isolada: `criar_preferencia`, `consultar_pagamento`, `assinatura_valida`; import
  tardio; testes fazem monkeypatch). `catalogo/estoque.py` calcula **disponibilidade** (estoque −
  reservas de pedidos pendentes não expirados) exposta como `disponivel` no `VariacaoSerializer`
  (`esgotado` mantido como `estoque==0`). Endpoints: `POST /api/checkout/` (público, recalcula
  preço no servidor, cria pedido `aguardando_pagamento` + preferência MP, `201 {pedido_id,
  init_point}`, `409` se sem estoque), `POST /api/webhooks/mercadopago/` (público/CSRF-exempt,
  valida HMAC → `401`, idempotente, decrementa estoque com `select_for_update` só se `approved`,
  dispara signal `compra_paga`), `GET /api/pedidos/` (admin, leitura, itens aninhados). Comando
  `expirar_pedidos`. Novas envs `MP_ACCESS_TOKEN`/`MP_WEBHOOK_SECRET`/`MP_PUBLIC_URL`/`FRONTEND_URL`.
  Dependência `mercadopago==3.2.0` (instalada no container; **rode `docker compose build backend`**
  para persistir na imagem). Novo `test_pagamentos.py` (15 testes). Suíte: **53 testes passando**.
- **2026-06-22** — Infra do **bot de WhatsApp do dono** (privado, controle de estoque) via
  **Evolution API** (não-oficial / Baileys), com número **DEDICADO** (risco de banimento). Dois
  serviços novos no `docker-compose.yml` (**não** sobem por padrão): `redis` (`redis:7-alpine`,
  volume `atelie_redis`) e `evolution-api` (`atendai/evolution-api:v2.1.1`, porta `8080`, volume
  `atelie_evolution` p/ sessão em `/evolution/instances`). Evolution configurada 100% por env:
  Postgres no banco PRÓPRIO `evolution` (`docker/db-init/01-evolution-db.sh` cria no 1º init do
  volume; senão criar manualmente — ver README), cache em `redis`, e **webhook global** →
  `${EVOLUTION_WEBHOOK_URL:-http://backend:8000/api/webhooks/whatsapp/}` (`WEBHOOK_GLOBAL_WEBHOOK_BY_EVENTS=false`).
  Novas envs lidas em `settings.py`: `EVOLUTION_URL`, `EVOLUTION_API_KEY`, `EVOLUTION_INSTANCE`,
  `WHATSAPP_DONO` (**lista**) e `ESTOQUE_BAIXO_LIMIAR` (**int**, default 1) — defaults dev-safe.
  README ganhou seção "Bot de WhatsApp (Evolution API)" (subir serviços, criar banco, criar
  instância + conectar por QR). Rota `POST /api/webhooks/whatsapp/` e o envio de mensagens
  (`sendText`) ficam para os subagentes B (notificações) e C (comandos). Sem migrations; suíte
  inalterada. `docker compose config` validado.
- **2026-06-22** — **Notificações do dono** (bot de WhatsApp, lado de envio). Novo
  `catalogo/notificacoes.py`: `enviar_whatsapp(texto, bloquear=False)` (Evolution `sendText`,
  resiliente — **thread daemon**, timeout 10s, falhas logadas genéricas sem conteúdo/apikey;
  **no-op** se desconfigurado) + helper exportado `checar_estoque_baixo(variacoes)` + receivers.
  Novo signal `encomenda_criada` (`sender=Encomenda`, `encomenda=`) disparado em
  `EncomendaViewSet.create` após salvar a encomenda+imagens. Receivers (conectados em
  `CatalogoConfig.ready()`): **compra paga** (itens + estoque fresco + alerta de estoque baixo) e
  **nova encomenda** (nome + descrição truncada ~60 chars). Falha de WhatsApp NUNCA quebra a venda/
  encomenda. Dependência **`requests==2.32.3`** (já na imagem; rebuild persiste). `conftest.py`
  ganhou fixture autouse `_limpar_throttle_cache` (zera cache entre testes p/ throttle não vazar
  `429`). Novo `test_notificacoes.py` (6 testes). Sem migrations. Suíte: **59 testes passando**.
- **2026-06-22** — **Comandos remotos do dono** (bot de WhatsApp, webhook de ENTRADA). Novo model
  **`MensagemWhatsApp`** (`mensagem_id` único, migration `0007`) para idempotência (registrado no
  Django Admin read-only). Novo módulo testável `catalogo/comandos.py` com função pura
  `interpretar(texto) -> str`: comandos `estoque <peça>`, `baixa <qtd> <peça> <tam> <cor>`,
  `repor <qtd> <peça> <tam> <cor>` e `ajuda`. Ajustes em `transaction.atomic()` +
  `select_for_update()`; `baixa` nunca fica negativo (recusa se `qtd > estoque`) e chama
  `checar_estoque_baixo`. Nova view `WhatsappWebhookView` (APIView, `AllowAny`,
  `authentication_classes=[]`, CSRF-exempt; espelha `WebhookMercadoPagoView`): só processa
  `messages.upsert` de remetente em `WHATSAPP_DONO` (autorização por dígitos; outros ignorados em
  silêncio com `200`), ignora `fromMe`/sem texto, é idempotente por `data.key.id` e SEMPRE devolve
  `200` (erros engolidos com log genérico, sem PII). Rota `POST /api/webhooks/whatsapp/`. Reusa
  `enviar_whatsapp`/`checar_estoque_baixo` do subagente B. Novo `test_comandos.py` (12 testes).
  Suíte: **71 testes passando**.
- **2026-06-22** — **Conexão do WhatsApp pelo painel** (parear por QR sem usar curl/README). Novo
  módulo `catalogo/evolution.py` (proxy admin para a Evolution: `estado_conexao()`, `conectar()`
  que cria a instância se preciso e devolve o QR, `desconectar()`; degrada sem exceção, nunca loga
  segredo/QR). Três views só-admin (`IsAuthenticated`): `GET /api/whatsapp/status/`,
  `POST /api/whatsapp/conectar/`, `POST /api/whatsapp/desconectar/`. O backend guarda a
  `EVOLUTION_API_KEY` — o navegador nunca a recebe. `conectar()` também garante
  `POST /webhook/set/{instância}` com `MESSAGES_UPSERT`. Novo `test_conexao_whatsapp.py` (7 testes,
  Evolution mockada). Sem migrations. Suíte: **78 testes passando**.
- **2026-06-22** — **Robustez do banco `evolution` + diagnóstico do bot**. Causa-raiz: o banco
  `evolution` só era criado no 1º init do volume; com `pgdata` pré-existente a Evolution subia
  quebrada e o QR não vinha. Adicionado serviço one-shot **`evolution-db-init`**
  (`docker/ensure-evolution-db.sh`, idempotente, roda a cada `up`); `evolution-api` agora
  `depends_on` ele (`service_completed_successfully`). Em `catalogo/evolution.py`,
  `_classificar_erro()` mapeia falhas para mensagens claras sem vazar segredos
  (401/403 → "Chave inválida"; conexão recusada/timeout → "fora do ar"; 5xx → "possível banco
  ausente") e `conectar()` **recria a instância uma vez** quando o connect vem sem QR. Novos
  estados: `nao_autorizado`, `erro_evolution`. `test_conexao_whatsapp.py` passou a 11 testes
  (classificação de erro + retry de QR, tudo mockado). Suíte: **82 testes passando**.
- **2026-06-22** — Correção operacional do QR da Evolution: a instância ficava em `connecting` e `/instance/connect` retornava `{ "count": 0 }` porque `CONFIG_SESSION_PHONE_VERSION` usava uma versão antiga do WhatsApp Web (`2.3000.1023204682`). Baileys no container reportou `2.3000.1035194821` como atual; `.env`, `.env.example` e fallback do `docker-compose.yml` foram atualizados para `EVOLUTION_WA_VERSION=2.3000.1035194821`.
- **2026-06-22** — Painel do WhatsApp agora permite trocar o `WHATSAPP_DONO`: nova rota admin `GET/PATCH /api/whatsapp/dono/` (`IsAuthenticated`) em `catalogo/evolution.py`/`views.py`, valida número em formato internacional, persiste no `.env` e atualiza `settings.WHATSAPP_DONO` em memória. `test_conexao_whatsapp.py` passou a 17 testes.
- **2026-06-22** — Correção do bot do dono para comandos e estoque manual: `docker-compose.yml`
  agora habilita `WEBHOOK_EVENTS_MESSAGES_UPSERT=true` (sem isso a Evolution recebia `ajuda`, mas
  não fazia POST no Django); o webhook aceita JID brasileiro com/sem nono dígito; e alterações/
  remoções de `Variacao` pelo admin notificam o dono via WhatsApp. Testes adicionados em
  `test_comandos.py` e `test_notificacoes.py`.
- **2026-06-23** — Correção final do webhook WhatsApp: a Evolution fazia POST para
  `http://backend:8000/api/webhooks/whatsapp/`, mas Django retornava `400 DisallowedHost` porque
  `backend` não estava em `ALLOWED_HOSTS`. `docker-compose.yml` agora injeta `backend` no backend.
  Também foi adicionada `WHATSAPP_DONO_LID` para autorizar mensagens que chegam como `...@lid`, e
  `catalogo/evolution.py` passou a garantir `/webhook/set/{instância}` ao conectar pelo painel.
