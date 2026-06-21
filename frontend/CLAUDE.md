# CLAUDE.md — Frontend do Ateliê

> Memória viva do frontend. **Sempre que mexer em telas, rotas, dependências ou
> configuração, atualize este arquivo na mesma tarefa, antes de concluir.**

## Visão geral

Dois lados no **mesmo** projeto Vite:

- **Área do cliente** (`/`, `/peca/:id`, `/carrinho`) — site público, **sem login** e **sem
  pagamento**. O cliente navega a vitrine, monta um pedido e finaliza no **WhatsApp** (a venda
  não é processada no sistema).
- **Painel do admin** (`/admin/*`) — gestão de **catálogo e estoque** por uma conta única,
  protegido por **login JWT**. **Não** há tela de venda/pedido/financeiro (fora de escopo):
  os pedidos chegam pelo WhatsApp.

Interface toda em **PT-BR**, **mobile-first**. Visual segue `../STYLE.md`: paleta revisada de
mais contraste, acento terracota `#7e4e2e` (escuro, em botões), fontes Cormorant Garamond
(títulos) + Inter (UI). O painel é mais utilitário (tabelas/formulários), mas mantém a identidade.

## Stack e versões

- React 19 + Vite 8
- React Router DOM 7 (`<BrowserRouter>` + `<Routes>` no cliente; `<StaticRouter>` no SSG)
- TanStack Query 5 (`@tanstack/react-query`)
- Tailwind CSS 4 (`@tailwindcss/vite`) — tokens via `@theme` no `src/index.css`
- Carrinho em React Context + persistência em `localStorage`
- Auth do admin: JWT (`djangorestframework-simplejwt`) com tokens em `localStorage`
- `lucide-react` para ícones (sempre componentes, nunca `<img>`/SVG inline como imagem)
- **SSG próprio** (pré-renderização das rotas públicas): `react-dom/server` (`renderToString`) +
  build SSR do Vite 8 + `prerender.js`. **Sem** dependência extra (a `vite-react-ssg` não suporta
  Vite 8). Rotas públicas (`/`, `/vitrine`, `/encomenda`) viram HTML estático com `<head>`/JSON-LD
  por rota; `/admin/*` nunca é pré-renderizado.

## Estrutura de pastas

```
frontend/
├── index.html              # fontes do Google (Cormorant + Inter); favicon = /favicon.png; título "Atelie ++"
├── vite.config.js          # plugins react + tailwindcss; porta 5173
├── prerender.js            # SSG: injeta <head>/JSON-LD por rota + gera sitemap.xml/robots.txt (pós-build)
├── .env / .env.example     # VITE_API_URL, VITE_WHATSAPP
├── public/                 # assets servidos na raiz "/" (o dono adiciona: logo-atelie.png, apresentacao-atelie.jpg)
└── src/
    ├── main.jsx            # entrada do CLIENTE: createRoot + <Providers><BrowserRouter><AppRoutes/>
    ├── entry-server.jsx    # entrada do SSG: render(url) com <StaticRouter> (renderToString) + reexports p/ prerender
    ├── Providers.jsx       # QueryClient + Auth + Carrinho (usado no cliente e no SSG)
    ├── routes.jsx          # AppRoutes: árvore <Routes> compartilhada (cliente + SSG)
    ├── App.jsx             # layout do CLIENTE: Header + <Outlet/> + rodapé com NAP
    ├── index.css           # Tailwind + @theme (tokens do STYLE.md)
    ├── config/
    │   └── site.js         # PLACEHOLDERS centralizados (WhatsApp via env, cidade, instagram, prazos…) + FAQ + DEPOIMENTOS
    ├── seo/
    │   ├── meta.js         # getMeta(rota), buildHead() e JSON-LD (LocalBusiness/FAQPage); ROTAS_SSG
    │   └── useSeo.js        # useSeo() (title/description no SPA) + useJsonLd() (Product na peça)
    ├── lib/
    │   ├── api.js          # HTTP: leitura pública + escrita autenticada; tokens; refresh; erros PT-BR
    │   ├── whatsapp.js     # montarMensagem() + linkWhatsapp() (encodeURIComponent)
    │   ├── pecas.js        # imagemPrincipal(), pecaEsgotada(), variacoesDisponiveis()
    │   └── exclusao.js     # helpers do aviso de exclusão: plural(), descreverPeca(), resumoTotais()
    ├── hooks/
    │   ├── usePecas.js     # vitrine pública (keepPreviousData)
    │   ├── usePeca.js      # detalhe público
    │   ├── useCategorias.js
    │   ├── useAdminPecas.js # TODAS as peças (auth, paginação completa) p/ o admin
    │   ├── useAdminEncomendas.js # TODAS as encomendas (auth, paginação completa) p/ o admin
    │   ├── useSelecao.js    # seleção de linhas (Set de ids) p/ ações em massa
    │   └── useOrdenacao.js  # estado de ordenação por tabela (persistido) + ordenarPor()
    ├── context/
    │   ├── CarrinhoContext.jsx   # carrinho do cliente + localStorage
    │   └── AuthContext.jsx       # autenticado/usuario/entrar/sair; ouve evento "auth:expirou"
    ├── components/
    │   ├── Header.jsx (logo), Apresentacao.jsx (hero da home), PecaCard.jsx, Filtro.jsx, SeletorVariacao.jsx,
    │   ├── Galeria.jsx (carretel de imagens da peça), ItemCarrinho.jsx, Preco.jsx, Estado.jsx   # (cliente + compartilhados)
    │   └── admin/
    │       ├── AdminLayout.jsx       # layout do PAINEL (nav + sair) — não aparece no cliente
    │       ├── RotaProtegida.jsx     # guard: sem token → /admin/login
    │       ├── ui.jsx                # BotaoPrimario/Secundario/Perigo, Campo, Feedback, Selo, inputClasse
    │       ├── Modal.jsx             # modal acessível reutilizável (foco preso, Esc, clique fora, portal)
    │       ├── CabecalhoOrdenavel.jsx # <th> clicável (seta), usa useOrdenacao
    │       ├── Selecao.jsx           # CaixaTodos/CaixaLinha (checkboxes) + BarraSelecao (ação em massa)
    │       ├── ConfirmarExclusao.jsx # modal: lista agrupada do que será removido + total + confirmação reforçada; executa DELETE por id com progresso/falha parcial
    │       ├── VariacoesEditor.jsx   # CRUD de variações (usado na edição da peça)
    │       ├── ImagensEditor.jsx     # upload (multipart) / principal / remover (na edição)
    │       ├── NovaPecaModal.jsx     # form completo de NOVA peça (básicos+variações+imagens) no modal
    │       ├── EditarPecaModal.jsx   # EDIÇÃO da peça em modal (básicos + VariacoesEditor + ImagensEditor)
    │       ├── RedirecionaEdicao.jsx # /admin/pecas/:id → /admin/pecas?editar=:id (abre o modal)
    │       └── NovaCategoriaModal.jsx # form de NOVA categoria no modal
    └── pages/
        ├── Home.jsx (landing /, 8 seções), Vitrine.jsx (/vitrine), DetalhePeca.jsx, Carrinho.jsx, Encomenda.jsx   # cliente
        └── admin/
            ├── Login.jsx, Dashboard.jsx, PecasLista.jsx,
            └── Estoque.jsx, Categorias.jsx, Destaques.jsx, Encomendas.jsx
```

## Telas / rotas

| Rota          | Componente     | Descrição |
|---------------|----------------|-----------|
| `/`           | `Home`         | **Landing/SEO** (única `<h1>`). 8 seções (copys de `COPYS_HOME.md`): Hero + 2 CTAs + microcopy; **Peças em destaque** (`?destaque=true`, fallback às recentes, reusa `PecaCard`); Sobre (foto `apresentacao-atelie.jpg`, `loading="lazy"`); O que oferecemos; Como funciona (4 passos); Depoimentos; FAQ; CTA final. Textos lidos de `config/site.js`. Pré-renderizada (SSG) com JSON-LD LocalBusiness + FAQPage. |
| `/vitrine`    | `Vitrine`      | Catálogo (`<h1>` "Vitrine"). Grade responsiva (2 cols mobile → 4 desktop). Busca por nome (debounce 350ms → `?search=`), filtro por categoria (`?categoria=`), ordenação `-criado_em`. Selo "Esgotado" quando todas as variações estão esgotadas. Estados: skeleton / erro / vazio. CTA de encomenda no rodapé da página. Pré-renderizada (SSG). |
| `/peca/:id`   | `DetalhePeca`  | Galeria (`Galeria` — carretel: imagem grande + setas anterior/próxima circulando da principal à última + miniaturas clicáveis com contador "i/total"), nome, preço, descrição. `SeletorVariacao` (esgotadas desabilitadas; **se só houver 1 variação disponível, vem pré-selecionada**), quantidade (**travada até escolher tamanho/cor** quando há várias), **subtotal dinâmico (preço × quantidade)**, "Adicionar ao pedido" com feedback. Peça `sob_medida` sem variações: adiciona sem variação. |
| `/carrinho`   | `Carrinho`     | Lista de itens (ajustar/remover, com **subtotal por linha**), **total dinâmico do pedido** (preço × quantidade somado), observação livre, "Enviar pedido pelo WhatsApp". Vazio: CTA para a vitrine. |
| `/encomenda`  | `Encomenda`    | Formulário de **encomenda sob medida**: nome, contato, descrição, **blocos de tamanho/medidas** (Tamanho, Busto, Cintura, Quadril, Comprimento — opcionais, compostos em `tamanho_medidas` ao enviar), prazo (opcional, **bloqueia datas passadas** via `min`) e imagens de referência (múltiplas, pré-visualização e remover, máx. 5 / 5 MB / jpg-png-webp). `POST` multipart para `/api/encomendas/`. Confirmação com "enviar outra"/"voltar" e botão opcional de aviso no WhatsApp. Entradas: banner na vitrine + link no header. |

### Admin (`/admin/*`, protegido por JWT)

| Rota                | Componente   | Descrição |
|---------------------|--------------|-----------|
| `/admin/login`      | `Login`      | Login (usuário/senha). Fora do layout do painel. Já autenticado → redireciona. |
| `/admin`            | `Dashboard`  | Cartões: total de peças, ativas/ocultas, variações, esgotadas, categorias + atalhos (o "+ Nova peça" leva a `/admin/pecas?nova=1`). |
| `/admin/pecas`      | `PecasLista` | Tabela **ordenável** (busca + filtro por categoria), status na vitrine/estoque; "Editar"/"Excluir" (ícones) + atalho de destaque. **Seleção em massa** (checkbox por linha + "todos", barra de ação) e **exclusão com aviso** (`ConfirmarExclusao` lista variações/imagens da peça + "sai dos destaques"; confirmação reforçada por ser cascata). "Nova peça" abre o **modal** (`NovaPecaModal`, `?nova=1`); "Editar" abre `EditarPecaModal` (`?editar=<id>`). Os forms avisam **nome duplicado** junto ao campo Nome (peça é única). |
| `/admin/pecas/nova` | →redirect    | Redireciona para `/admin/pecas?nova=1` (cadastro em modal). |
| `/admin/pecas/:id`  | →redirect    | `RedirecionaEdicao` → `/admin/pecas?editar=<id>` (edição em modal). Mantém deep links e o "ver detalhes" das Categorias. |
| `/admin/estoque`    | `Estoque`    | Tabela **ordenável** de variações; edição por linha com ícone, botões +1/−1 e número manual (nunca < 0); salva via PATCH; destaque/filtro de esgotadas; busca. **Excluir variação** (lixeira) e **seleção em massa** com aviso (`ConfirmarExclusao`). |
| `/admin/categorias` | `Categorias` | CRUD de categorias (inputs de largura fixa padronizada; "Nova categoria" em **modal**) + controle da vitrine (tabela ordenável com Mostrar/Ocultar e link "ver detalhes" da peça). **Excluir categoria** (única ou em massa) abre `ConfirmarExclusao` listando as **peças que cairão em cascata** (e suas variações/imagens); confirmação reforçada (digitar o nome da categoria / `EXCLUIR`). |
| `/admin/destaques`  | `Destaques`  | Curadoria das **peças em destaque** da Home. Tabela **ordenável** (nome, categoria, preço, status, destaque) com busca por nome e atalho "Só em destaque". Toggle por peça (ícone `Star`/`StarOff`) via PATCH `{destaque}` (`atualizarPeca`) — invalida `["admin","pecas"]` e `["pecas"]`. Contador "N peças em destaque" + lembrete suave acima de 8 (a Home mostra até 8). Aviso "em destaque, mas oculta" quando a peça está em destaque mas `ativo=false`. |
| `/admin/encomendas` | `Encomendas` | Tabela **ordenável** das encomendas sob medida (cliente, contato **formatado `(DD) NÚMERO`**, prazo, status, data) com destaque das **novas** (`recebido`). **Seleção em massa** + exclusão com aviso (`ConfirmarExclusao` lista as imagens de referência que serão removidas). Detalhe em **modal**: dados, descrição, galeria das imagens (abrem em **popup/lightbox** na própria página, com setas e Esc), seletor de status (PATCH) e excluir (confirmação). |

## Como consome a API

- Base: `VITE_API_URL` + `/api/`.
- **Cliente (leitura pública)**: `GET /categorias/`, `GET /pecas/` (paginado
  `{count,next,previous,results}` — hooks extraem `results`), `GET /pecas/{id}/`.
  Filtros: `?categoria=<id>`, `?search=<texto>`, `?ordering=`.
- **Admin (escrita autenticada)**: `Authorization: Bearer <access>` em CRUD de
  `pecas`/`variacoes`/`imagens`/`categorias` e na listagem do admin (que assim enxerga peças
  **inativas** — anônimo só vê ativas). Upload de imagem via **multipart** em `POST /imagens/`.
- **Encomendas**: `criarEncomenda()` faz `POST /encomendas/` **público** (multipart, campo
  `imagens` repetido por arquivo) — devolve `{id,status,mensagem}`. Admin: `listarTodasEncomendas()`
  (auth, paginação completa), `obterEncomenda(id)`, `atualizarEncomendaStatus(id, status)` (PATCH
  JSON) e `excluirEncomenda(id)`. Erros de validação (incl. limites de imagem) vêm por campo PT-BR
  e o formulário também valida no cliente antes de enviar.
- **Auth**: `POST /auth/login/` → `{access, refresh}` (em `localStorage`); em `401` o `api.js`
  tenta `POST /auth/refresh/` uma vez; se falhar, limpa tokens e dispara `auth:expirou`
  (o `AuthContext` desloga → guard manda ao login). Tokens nunca vão ao console.
- Imagens vêm como URL **absoluta** em `arquivo`. Erros: `api.js` lança `Error` em PT-BR
  (extrai `detail`/`detalhe`/1º erro de campo do DRF) — telas mostram via `Estado.Erro`/`Feedback`.

## WhatsApp

`src/lib/whatsapp.js` monta a mensagem e abre `https://wa.me/<VITE_WHATSAPP>?text=<encoded>`.
Formato da mensagem:

```
Olá! Quero fazer um pedido:

• Vestido Floral — Tam: P, Cor: Azul — Qtd: 1
• Saia Midi — Tam: M, Cor: Preto — Qtd: 2

Observação: <texto>
```

Itens sem variação (sob medida) omitem "Tam/Cor". A observação só entra se preenchida.
O texto é codificado com `encodeURIComponent`.

## Variáveis de ambiente

| Variável        | Exemplo                  | Observação |
|-----------------|--------------------------|------------|
| `VITE_API_URL`  | `http://127.0.0.1:8000`  | Sem barra no final. |
| `VITE_WHATSAPP` | `5581990000000`          | Só dígitos, formato internacional. **Placeholder — trocar pelo real.** |

`.env` está no `.gitignore`; use `.env.example` como modelo.

## Como rodar

**Com Docker (recomendado):** na raiz do projeto, `docker compose up` sobe banco + backend +
frontend juntos. Há um `frontend/Dockerfile` (Vite dev com `--host`) e o serviço `frontend` no
`docker-compose.yml` da raiz, que passa `VITE_API_URL`/`VITE_WHATSAPP` e liga o polling de watch
(`CHOKIDAR_USEPOLLING`) para hot reload em bind mount no Windows.

**Sem Docker:**

```bash
cd frontend
npm install
cp .env.example .env     # (Windows: copy) — ajuste os valores
npm run dev              # http://localhost:5173
```

Backend precisa estar no ar (`docker compose up -d` + `python manage.py runserver` na raiz;
`python manage.py seed_dados` para dados de exemplo). A porta 5173 já está liberada no CORS.

### Build com SSG (produção)

`npm run build` roda **3 passos** encadeados:
1. `vite build` — bundle do cliente em `dist/`.
2. `vite build --ssr src/entry-server.jsx --outDir dist-server` — bundle SSR.
3. `node prerender.js` — para cada rota de `ROTAS_SSG` (`/`, `/vitrine`, `/encomenda`): renderiza
   o HTML (`render(url)`), injeta `<head>` (title/description/canonical/OG/Twitter) + JSON-LD e
   grava `dist/<rota>/index.html`; gera `dist/sitemap.xml` e `dist/robots.txt` (bloqueia `/admin`).

`npm run build:spa` faz só o passo 1 (sem SSG). `dist-server/` está no `.gitignore`.
**Hospedagem:** servir `dist/` como estático com fallback SPA para `index.html` (rotas não
pré-renderizadas, ex. `/peca/:id` e `/admin/*`, sobem por CSR). Preencher `SITE.dominio` em
`config/site.js` antes do deploy (usado em canonical/OG/sitemap).

## Decisões e convenções

- **SEO / SSG**: pré-renderização própria (sem lib — `vite-react-ssg` não suporta Vite 8). Rotas e
  providers ficam em `routes.jsx` + `Providers.jsx`, compartilhados por `main.jsx` (cliente,
  `BrowserRouter` + `createRoot`) e `entry-server.jsx` (SSG, `StaticRouter` + `renderToString`).
  Metadados/JSON-LD por rota em `seo/meta.js` (fonte única; FAQPage espelha o FAQ do `site.js`).
  No cliente, `useSeo`/`useJsonLd` atualizam o `<head>` na navegação SPA. Código que usa
  `localStorage`/`window` é **guardado** para rodar no build Node (`AuthContext`, `tokens`).
- **Placeholders centralizados** em `config/site.js`: o dono troca num lugar só (WhatsApp lê de
  `VITE_WHATSAPP`; `cidade` = "Campo Grande – MS" já preenchida; `instagram`, `tempoAtuacao`,
  `prazoEncomenda`, `numeroPecas`, `fazAjustes`, `dominio` como `[COLCHETES]`). FAQ e depoimentos
  também ficam lá.
- **Tailwind v4 com `@theme`**: tokens do ESTILO.md viram utilitários (`bg-fundo`, `text-acento`,
  `font-display`). Não há `tailwind.config.js`.
- **Carrinho**: chave única por `pecaId:variacaoId`; mesma peça/variação soma quantidade.
  Persistido em `localStorage` (`atelie_carrinho`). O contexto expõe `totalItens` e
  `totalPreco` (memos: soma de quantidades e de `preço × quantidade`) — usados no subtotal da
  página de peça, no subtotal por linha (`ItemCarrinho`) e no total do pedido (`Carrinho`).
- **Limite de estoque**: a quantidade nunca passa do `estoque` da variação. O item do carrinho
  guarda `estoque`; `adicionar`/`ajustarQuantidade` aplicam `limitarAoEstoque` (clamp em
  `[1, estoque]`); `estoque` nulo (peça sob medida ou item antigo sem o dado) = sem limite. Na
  página de peça o estoque vem da variação selecionada (mostra "(N em estoque)", o "+" desabilita
  no máximo e a quantidade é reajustada ao trocar de variação); no `ItemCarrinho` o "+" desabilita
  ao atingir o estoque ("Máx. em estoque").
- **Selo "Esgotado"**: só quando há variações e todas estão esgotadas; `sob_medida` sem
  variações não recebe selo (`pecaEsgotada` em `lib/pecas.js`).
- **Componentes pequenos e reutilizáveis**; estados de carregando/erro/vazio centralizados em
  `Estado.jsx`.
- **Config só via env**: URL da API e número do WhatsApp nunca hardcoded.
- **Tokens de cor = `STYLE.md`**: o bloco `@theme` em `index.css` deve bater exatamente com a
  paleta do `STYLE.md` (fonte única). Botões primários e o botão do carrinho usam `acento-escuro`
  (texto branco) com hover `acento-hover` — nunca texto branco sobre o `acento` claro.
- **Sem glitch ao filtrar**: `usePecas` usa `placeholderData: keepPreviousData`; a Vitrine mostra
  skeleton só no 1º carregamento (`isLoading`), mantém os resultados anteriores com leve opacidade
  durante a troca (`isPlaceholderData`/`isFetching`) e reserva `min-h` para não saltar o layout.
- **Hover dos cards**: `PecaCard` eleva (sombra `0 6px 20px rgba(0,0,0,0.10)`), `scale ~1.02` e
  zoom da foto `scale 1.05` em ~200ms, com `overflow-hidden` na imagem; foco visível com anel.
- **Layouts separados**: cliente e admin têm layouts próprios (`App.jsx` x `AdminLayout.jsx`) —
  o header/carrinho do cliente nunca aparece no admin e vice-versa. Rotas `/admin/*` (exceto
  `/admin/login`) ficam dentro de `<RotaProtegida>`.
- **Auth do admin**: tokens em `localStorage` (app de admin único); refresh automático no 401;
  logout limpa tokens. Sem venda/pedido/financeiro no painel (regra de negócio).
- **Cache do Query**: queries do admin usam chaves `["admin", ...]`, separadas das públicas
  (a vitrine vê só ativas; o admin vê todas). Mutações invalidam `["admin","pecas"]` /
  `["admin","peca",id]` / `["categorias"]`.
- **Padrão de modal (criar E editar)**: cadastrar e **editar** sempre abrem em pop-up sobre a tela
  atual — nunca navegam para outra página. Via `components/admin/Modal.jsx` (acessível: foco preso,
  `Esc`/clique-fora fecham, `role=dialog` + `aria-modal`, devolve o foco, `createPortal`). Usado por
  `NovaPecaModal`, `EditarPecaModal` e `NovaCategoriaModal`. O modal de nova peça aparece inteiro
  (básicos+variações+imagens) com "Salvar" no fim, cria peça→variações→imagens e oferece "Adicionar
  mais peças" ou fechar. O de edição reusa `VariacoesEditor`/`ImagensEditor` (peça já existe). Os
  modais são controlados por query param na lista (`?nova=1`, `?editar=<id>`), então deep links e a
  rota antiga `/admin/pecas/:id` (via `RedirecionaEdicao`) abrem o modal certo.
- **Tabelas ordenáveis**: qualquer tabela do admin usa `hooks/useOrdenacao.js` (estado por
  `tabelaId`, **persistido em `localStorage`** — não reseta ao paginar) + `ordenarPor()` +
  `components/admin/CabecalhoOrdenavel.jsx` (cabeçalho clicável com seta na coluna ativa).
- **Ícones**: sempre componentes do `lucide-react` (ex.: `Plus`, `Minus`, `Pencil`, `Trash2`,
  `Eye`, `X`, `Check`), nunca imagem/SVG inline. Ícones decorativos com `aria-hidden`; quando a
  ação é só ícone, usar `aria-label`.

## Histórico de mudanças

- **2026-06-20** — Criação do frontend (área do cliente): Vite + React 19 + Router 7 +
  TanStack Query 5 + Tailwind v4. 3 telas (Vitrine, Detalhe, Carrinho), carrinho com
  localStorage, integração de leitura com a API e envio do pedido pelo WhatsApp. Build de
  produção validado e dev server testado contra o backend (3 peças do seed).
- **2026-06-20** — Dockerização: `frontend/Dockerfile` (Vite dev) + serviço `frontend` no
  compose da raiz, com `VITE_*` por env e `CHOKIDAR_USEPOLLING` para hot reload em container.
  `vite.config.js` liga `watch.usePolling` quando essa var está presente.
- **2026-06-20** — Refino visual/UX (sem mudar fluxo nem API): botão do carrinho sólido e
  destacado no header sticky (ícone de sacola + badge); hover dos cards (elevação + scale + zoom
  da foto); fim do glitch de filtro (`keepPreviousData` + skeleton só no 1º load + opacidade +
  `min-h`); paleta de mais contraste do `STYLE.md` aplicada no `@theme` (texto `#1a1816`,
  texto-suave `#57534e`, borda `#d6cfc4`, acento-escuro `#7e4e2e`, novo `acento-hover #653a1f`);
  foco visível em botões/links/campos.
- **2026-06-20** — Painel do admin em `/admin/*` (login JWT). Camada de API estendida
  (`lib/api.js`) com escrita autenticada (POST/PUT/PATCH/DELETE), upload multipart de imagens,
  armazenamento de tokens e refresh automático no 401. `AuthContext` + `RotaProtegida` +
  `AdminLayout`. 4 seções: Resumo (dashboard), Peças (CRUD + variações + imagens), Estoque
  (edição inline), Categorias (CRUD + controle da vitrine). Build e fluxo de login/refresh
  validados contra o backend. Área do cliente intacta.
- **2026-06-20** — Refino de UX do painel (fundação + 3 frentes em paralelo): `lucide-react`
  para ícones; `Modal` acessível reutilizável; tabelas ordenáveis (`useOrdenacao` persistente +
  `CabecalhoOrdenavel`). Nova peça passou a ser um **modal** (form completo, "Salvar" no fim,
  cria peça→variações→imagens, "adicionar mais"); Estoque ganhou edição com ícone + botões
  +1/−1 (nunca negativo) e ordenação; Categorias com inputs de largura padronizada, "nova
  categoria" em modal, link "ver detalhes" (ícone `Eye`) e tabelas ordenáveis. `lint` e `build` ok.
- **2026-06-20** — Edição de peça passou a abrir em **modal** (`EditarPecaModal`) a partir da lista
  `/admin/pecas` (`?editar=<id>`), sem tirar o usuário da tela. A rota `/admin/pecas/:id` agora
  redireciona para o modal (`RedirecionaEdicao`) e o `PecaForm` de página inteira foi removido.
  Estoque continua com edição inline (já não navegava). `lint`/`build` ok.
- **2026-06-20** — Marca aplicada: favicon trocado pelo logo (`/favicon.png`, sem o raio roxo
  do Vite) e `<title>` = "Atelie ++ — Costura sob medida"; logo no header do cliente e no
  `AdminLayout`; novo `Apresentacao.jsx` (hero da home com `apresentacao-atelie.jpg` + "Atelie ++ /
  Costura sob medida", responsivo, `loading="lazy"`); cards de peça com borda de destaque. Os
  arquivos de imagem ficam em `frontend/public/` e são adicionados pelo dono (ver `public/README.md`);
  o código aponta para os caminhos corretos mesmo antes de existirem. `build` ok.
- **2026-06-20** — Nome de exibição padronizado para **"Atelie ++"** (sem acento, igual ao logo)
  em todo texto visível (hero, `<title>`, login do admin, `alt`/`aria-label`), eliminando a
  inconsistência com o logo e o glitch do "ê" na Cormorant Garamond. `build` ok.
- **2026-06-20** — Total dinâmico (preço × quantidade): `CarrinhoContext` ganhou `totalPreco`
  (memo). Página de peça mostra subtotal da quantidade escolhida; `ItemCarrinho` mostra subtotal
  por linha (+ "X cada" quando qtd > 1); `Carrinho` mostra o total do pedido. `build` ok.
- **2026-06-20** — Limite de estoque na quantidade: item do carrinho passou a guardar `estoque`;
  `CarrinhoContext` aplica `limitarAoEstoque` em `adicionar`/`ajustarQuantidade`. Página de peça
  limita o seletor à variação selecionada (hint "(N em estoque)", "+" desabilitado no máximo,
  reajuste ao trocar de variação) e `ItemCarrinho` desabilita o "+" no limite. Sob medida = sem
  limite. `build` ok.
- **2026-06-20** — Pré-seleção de variação única: se a peça tem só uma variação disponível
  (não esgotada), ela já vem selecionada (`variacaoEfetiva = variacao ?? variacaoUnica`, sem
  estado/efeito extra). Havendo várias e nenhuma escolhida, os controles de quantidade ficam
  **travados** ("Selecione o tamanho e a cor para escolher a quantidade"). `build` ok.
- **2026-06-20** — Galeria de imagens da peça (`components/Galeria.jsx`): imagem grande com setas
  anterior/próxima (carretel circular da principal à última, ícones `lucide-react`), miniaturas
  clicáveis com destaque da ativa e contador "i/total". Substitui a galeria estática (miniaturas
  não eram clicáveis). Montada com `key={peca.id}` para reiniciar o índice ao trocar de peça. `build` ok.
- **2026-06-20** — Encomenda sob medida (3 frentes): **cliente** — página `/encomenda` (`Encomenda.jsx`)
  com formulário + upload de imagens (pré-visualização/remover, limites 5/5MB/jpg-png-webp espelhando
  o backend), confirmação e aviso opcional no WhatsApp (`linkWhatsappEncomenda`); entradas via banner
  na vitrine e link no header. **API** — `criarEncomenda` (público multipart) + `listarTodasEncomendas`/
  `obterEncomenda`/`atualizarEncomendaStatus`/`excluirEncomenda` (admin) em `lib/api.js`. **admin** —
  seção `/admin/encomendas` (`Encomendas.jsx`) com tabela ordenável, destaque das novas, modal de
  detalhe (galeria + troca de status + excluir), `useAdminEncomendas`, novo selo `acento` e cartão
  "Encomendas novas" no Dashboard. Catálogo continua saindo pelo WhatsApp (intacto). `lint`/`build` ok.
- **2026-06-20** — Ajustes na encomenda: admin formata o contato como `(DD) NÚMERO`; imagens da
  encomenda abrem em **popup/lightbox** na própria página (`LightboxImagens`, portal em `body` com
  setas, contador e Esc — não fecha o modal por baixo). No formulário do cliente, "Tamanho ou
  medidas" virou **blocos** (Tamanho/Busto/Cintura/Quadril/Comprimento, compostos em
  `tamanho_medidas`) e o campo de prazo **bloqueia datas passadas** (`min` + validação no submit).
  `lint`/`build` ok.
- **2026-06-20** — Nova **Home** (landing SEO) em `/` e catálogo movido para `/vitrine`
  (Subagente B): `pages/Home.jsx` com 8 seções (copys de `COPYS_HOME.md`), placeholders
  centralizados em `config/site.js`, header com nav (Início · Vitrine · Encomenda) e rodapé com
  NAP. Backend ganhou `destaque` (filtro `?destaque=true`) para a curadoria da Home.
- **2026-06-20** — **SSG/SEO próprio** (Subagente C): pré-renderização das rotas públicas sem lib
  (a `vite-react-ssg` não roda no Vite 8). Reestruturado para `routes.jsx` + `Providers.jsx`
  (compartilhados), `main.jsx` (cliente: `BrowserRouter`+`createRoot`) e `entry-server.jsx`
  (`StaticRouter`+`renderToString`). `prerender.js` injeta `<head>`/JSON-LD por rota e gera
  `sitemap.xml`/`robots.txt`. `seo/meta.js` (title/description/OG/canonical + JSON-LD
  LocalBusiness/FAQPage) e `seo/useSeo.js` (SPA + Product na peça). `localStorage`/`window`
  guardados p/ o build Node. `lint` (0 erros) e `npm run build` (SSG) ok; rotas pré-renderizadas
  com H1/meta/JSON-LD no HTML estático. `/admin` fora do SSG (bloqueado no robots).
- **2026-06-21** — Seção **Destaques** no painel (`/admin/destaques`, `pages/admin/Destaques.jsx`)
  para o ateliê curar as peças em destaque da Home sem ir ao Django Admin. Tabela ordenável
  (`useAdminPecas` + `CabecalhoOrdenavel`/`useOrdenacao`) com busca, atalho "Só em destaque",
  toggle por peça (`Star`/`StarOff` → `atualizarPeca(id,{destaque})`, invalidando `["admin","pecas"]`
  e `["pecas"]`), contador com lembrete acima de 8 e aviso "em destaque, mas oculta" (peça em
  destaque com `ativo=false` não aparece na vitrine). Item "Destaques" no `AdminLayout`; cartão
  "Peças em destaque" + atalho no Dashboard; atalho de estrela também na lista de Peças
  (`PecasLista`). `lint` (0 erros) e `npm run build` (SSG) ok.
- **2026-06-21** — Exclusão com aviso + seleção em massa. Novo componente reutilizável
  `ConfirmarExclusao` (modal que **lista o que será removido, agrupado por item-pai** com dependentes
  em cascata + **total**; confirmação **reforçada** em cascata: digitar o nome / `EXCLUIR`; executa
  `DELETE` por id com **progresso** e **falha parcial**) e `Selecao.jsx` (`CaixaTodos`/`CaixaLinha`
  + `BarraSelecao`), `useSelecao` (Set de ids) e `lib/exclusao.js` (helpers de texto/total).
  Aplicado em **Categorias** (cascata: lista as peças e variações/imagens que cairão), **Peças**
  (variações/imagens + "sai dos destaques"), **Estoque** (excluir variação) e **Encomendas**
  (imagens de referência) — todas com **seleção múltipla + exclusão em massa**. Backend agora usa
  `CASCADE` na categoria e `nome` único, então os forms de peça (`NovaPecaModal`/`EditarPecaModal`)
  avisam **nome duplicado** junto ao campo Nome (via `useAdminPecas`, ignorando a própria peça).
  `lint` (0 erros) e `npm run build` (SSG) ok.
