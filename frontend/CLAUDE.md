# CLAUDE.md — Frontend do Ateliê

> Memória viva do frontend. **Sempre que mexer em telas, rotas, dependências ou
> configuração, atualize este arquivo na mesma tarefa, antes de concluir.**

## Visão geral

Dois lados no **mesmo** projeto Vite:

- **Área do cliente** (`/`, `/peca/:id`, `/carrinho`, `/conta/*`) — site público. Navegar a vitrine
  é livre, mas **finalizar a compra exige conta** (cadastro/login do cliente) — o checkout usa os
  dados da conta + CPF no Mercado Pago. A **encomenda sob medida** (`/encomenda`) continua pública e
  finaliza no **WhatsApp** (não muda). A sessão do cliente é **separada** da do admin.
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
    │   ├── api.js          # HTTP: leitura pública + escrita autenticada; tokens; refresh; erros PT-BR (inclui cores)
    │   ├── whatsapp.js     # montarMensagem() + linkWhatsapp() (encodeURIComponent)
    │   ├── pecas.js        # imagemPrincipal(), pecaEsgotada(), variacoesDisponiveis()
    │   ├── cores.js        # HEX_REGEX, hexValido(), normalizarHex(), corDeTextoSobre()
    │   ├── moeda.js        # máscara BRL: centavos⇄texto, formatarCentavos(), centavosParaDecimal(), TETO_PRECO
    │   ├── validarPeca.js  # validação COMPLETA (acumula todos os erros por campo) + resumoErros()
    │   ├── perguntas.js    # "caixinha de perguntas" do Dashboard (intenções por palavra-chave, sem API paga)
    │   └── exclusao.js     # helpers do aviso de exclusão: plural(), descreverPeca(), resumoTotais()
    ├── hooks/
    │   ├── usePecas.js     # vitrine pública (keepPreviousData)
    │   ├── usePeca.js      # detalhe público
    │   ├── useCategorias.js
    │   ├── useAdminPecas.js # TODAS as peças (auth, paginação completa) p/ o admin
    │   ├── useAdminEncomendas.js # TODAS as encomendas (auth, paginação completa) p/ o admin
    │   ├── useAdminPedidos.js # TODOS os pedidos/vendas (auth, paginação completa) p/ o admin — só leitura
    │   ├── useCores.js      # paleta de cores salvas (useQuery ["cores"]; listarCores percorre paginação)
    │   ├── useSelecao.js    # seleção de linhas (Set de ids) p/ ações em massa
    │   └── useOrdenacao.js  # estado de ordenação por tabela (persistido) + ordenarPor()
    ├── context/
    │   ├── CarrinhoContext.jsx   # carrinho do cliente + localStorage
    │   └── AuthContext.jsx       # autenticado/usuario/entrar/sair; ouve evento "auth:expirou"
    ├── components/
    │   ├── Header.jsx (logo), Apresentacao.jsx (hero da home), PecaCard.jsx, Filtro.jsx, SeletorVariacao.jsx,
    │   ├── Galeria.jsx (carretel de imagens da peça), ItemCarrinho.jsx, Preco.jsx, Estado.jsx   # (cliente + compartilhados)
    │   └── admin/
    │       ├── AdminLayout.jsx       # layout do PAINEL (cabeçalho + <AdminNav/> + sair) — não aparece no cliente
│       ├── AdminNav.jsx          # navegação agrupada (5 itens; dropdown desktop hover+clique+teclado; sanfona mobile; por papel)
    │       ├── RotaProtegida.jsx     # guard: sem token → /admin/login
    │       ├── ui.jsx                # BotaoPrimario/Secundario/Perigo, Campo, Feedback, Selo, inputClasse
    │       ├── Modal.jsx             # modal acessível reutilizável (foco preso, Esc, clique fora, portal)
    │       ├── CabecalhoOrdenavel.jsx # <th> clicável (seta) + OrdenarMobile (controle "Ordenar por" no mobile), usa useOrdenacao
    │       ├── Selecao.jsx           # CaixaTodos/CaixaLinha (checkboxes) + BarraSelecao (ação em massa)
    │       ├── SeletorCor.jsx        # seletor de cor c/ paleta salva (swatches) + "Nova cor" (react-colorful) → POST /cores/
    │       ├── CampoPreco.jsx        # input de preço com máscara BRL (centavos), prefixo R$, teto 1.000.000
    │       ├── DetalhePecaModal.jsx  # visualização SÓ LEITURA da peça (acionada pelo ícone "olho")
    │       ├── ConfirmarExclusao.jsx # modal: lista agrupada do que será removido + total + confirmação reforçada; executa DELETE por id com progresso/falha parcial
    │       ├── VariacoesEditor.jsx   # CRUD de variações (usado na edição da peça)
    │       ├── ImagensEditor.jsx     # upload (multipart) / principal / remover (na edição)
    │       ├── NovaPecaModal.jsx     # form completo de NOVA peça (básicos+variações+imagens) no modal
    │       ├── EditarPecaModal.jsx   # EDIÇÃO da peça em modal (básicos + VariacoesEditor + ImagensEditor)
    │       ├── RedirecionaEdicao.jsx # /admin/pecas/:id → /admin/pecas?editar=:id (abre o modal)
    │       └── NovaCategoriaModal.jsx # form de NOVA categoria no modal
    └── pages/
        ├── Home.jsx (landing /, 8 seções), Vitrine.jsx (/vitrine), DetalhePeca.jsx, Carrinho.jsx, Encomenda.jsx   # cliente
        ├── pagamento/  # retornos do Mercado Pago: Sucesso.jsx, Pendente.jsx, Falha.jsx (CSR, fora do SSG)
        └── admin/
            ├── Login.jsx, Dashboard.jsx, PecasLista.jsx,
            └── Estoque.jsx, Categorias.jsx, Cores.jsx, Destaques.jsx, Encomendas.jsx, Vendas.jsx, Whatsapp.jsx
```

## Telas / rotas

| Rota          | Componente     | Descrição |
|---------------|----------------|-----------|
| `/`           | `Home`         | **Landing/SEO** (única `<h1>`). 8 seções (copys de `COPYS_HOME.md` — marca **Ateliê da Sete**, Umbanda + Candomblé): Hero + 2 CTAs (WhatsApp "Me conta o fundamento da sua casa" / "Ver os trabalhos") + microcopy; **Alguns trabalhos** (`?destaque=true`, fallback às recentes, reusa `PecaCard`); **Sobre/manifesto** ("Tem nome de fundamento…", foto `apresentacao-atelie.jpg`); **O que costuramos** (catálogo com vocabulário); **Diferenciais**; Depoimentos; FAQ (6); CTA final. Textos lidos de `config/site.js`. Pré-renderizada (SSG) com JSON-LD ClothingStore + FAQPage. |
| `/vitrine`    | `Vitrine`      | Catálogo (`<h1>` "Vitrine"). Grade responsiva (2 cols mobile → 4 desktop). Busca por nome (**máx. 60**, debounce 350ms → `?search=`), filtro por categoria (`?categoria=`), ordenação `-criado_em`. **Paginação server-side** (`usePecasPaginadas`, 20/página, controles `Paginacao`; volta à página 1 ao mudar busca/categoria). Selo "Esgotado" quando todas as variações estão esgotadas. Estados: skeleton / erro / vazio. CTA de encomenda no rodapé da página. Pré-renderizada (SSG). |
| `/peca/:id`   | `DetalhePeca`  | Galeria (`Galeria` — carretel: imagem grande + setas anterior/próxima circulando da principal à última + miniaturas clicáveis com contador "i/total"), nome, preço, descrição. `SeletorVariacao` (esgotadas desabilitadas; **se só houver 1 variação disponível, vem pré-selecionada**), quantidade (**travada até escolher tamanho/cor** quando há várias), **subtotal dinâmico (preço × quantidade)**, "Adicionar ao pedido" com feedback. Peça `sob_medida` sem variações: adiciona sem variação. |
| `/carrinho`   | `Carrinho`     | Lista de itens (ajustar/remover, **subtotal por linha**), **total dinâmico**. Finalizar **exige conta**: deslogado → CTA "Entrar"/"Criar conta" (`?next=/carrinho`); logado → resumo "Comprando como **nome** · CPF …" + **"Finalizar compra"** que chama `criarCheckout({itens})` (nome/contato/CPF vêm da conta) → redireciona ao **Mercado Pago** (`init_point`). Itens **sob medida** ficam de fora (aviso → Encomenda). Não limpa o carrinho aqui. Vazio: CTA para a vitrine. |
| `/conta/login` `/conta/cadastro` | `conta/Login` · `conta/Cadastro` | **Páginas públicas** (não modal). Cadastro: nome, e-mail, **CPF (máscara+validação)**, telefone (máscara), senha+confirmar — validação completa (todos os erros de uma vez) e auto-login no sucesso. Login por e-mail+senha. Ambos respeitam `?next=`. |
| `/conta`      | `conta/MinhaConta` (guardada) | Ver/editar **nome e telefone** (e-mail/CPF read-only) + **trocar senha**. Guardada por `RotaCliente`. |
| `/conta/pedidos` | `conta/MeusPedidos` (guardada) | Histórico **do próprio cliente** (código `PED-000042` + data + itens + total + selo de status), do mais recente ao mais antigo. Estados carregando/vazio/erro. |
| `/pagamento/sucesso`  | `pagamento/Sucesso`  | Retorno do MP (auto_return) após aprovação: "Pagamento aprovado!". **Limpa o carrinho** e linka à vitrine. Lê `external_reference` (= pedido_id) só para exibir. (CSR, fora do SSG.) |
| `/pagamento/pendente` | `pagamento/Pendente` | Pagamento em processamento (ex.: Pix). Explica que será contatado; **não** limpa o carrinho. (CSR, fora do SSG.) |
| `/pagamento/falha`    | `pagamento/Falha`    | Pagamento falhou/cancelado; "Voltar ao carrinho / Tentar de novo". **Não** limpa o carrinho. (CSR, fora do SSG.) |
| `/encomenda`  | `Encomenda`    | Formulário de **encomenda sob medida** com entradas restritas (menos cliques): **Nome** (máx. 80, auto-capitaliza palavras), **Contato** (máscara de telefone BR `(67) 99999-9999`, 10/11 dígitos), **Descrição** (máx. 600 + contador ao vivo), **Tamanho** em **chips** de seleção única (P · M · G · GG · Único + chip "+ Outro" que revela texto livre), **Medidas** Busto/Cintura/Quadril/Comprimento (numéricas, sufixo fixo "cm", stepper +/−, faixa 20–250, opcionais), **prazo** (opcional, `min`=hoje e `max`≈1 ano) e imagens de referência (múltiplas, pré-visualização/remover, máx. 5 / 5 MB / jpg-png-webp). Tamanho+medidas são compostos em `tamanho_medidas` (ex.: "Tamanho: M; Busto: 90 cm"). **Validação mostra TODOS os erros de uma vez** (mapa por campo, inline + resumo no topo) e mapeia erros do backend. `POST` multipart para `/api/encomendas/`. Confirmação com "enviar outra"/"voltar" e botão opcional de aviso no WhatsApp. Entradas: banner na vitrine + link no header. |

### Admin (`/admin/*`, protegido por JWT)

| Rota                | Componente   | Descrição |
|---------------------|--------------|-----------|
| `/admin/login`      | `Login`      | Login multiusuário (usuário/senha). Fora do layout do painel. Após entrar, o `AuthContext` lê `GET /me/`. Já autenticado → redireciona. |
| `/admin/senha`      | `TrocarSenha` | Troca de senha. Quando a senha é **provisória**, o `RotaProtegida` traz o usuário para cá e só libera o painel após definir a nova (valida tudo de uma vez; limpa `senha_provisoria` no backend). |
| `/admin/funcionarios` | `Funcionarios` | **Só Dono.** Tabela ordenável (nome, usuário, status, financeiro, criado em) com busca e truncamento+tooltip. "Novo funcionário" em modal (nome, usuário, e-mail opcional, senha provisória, interruptor "Liberar financeiro"). Ações por linha: ativar/desativar, resetar senha (gera provisória e mostra ao Dono), liberar/revogar financeiro, excluir (`ConfirmarExclusao`). |
| `/admin`            | `Dashboard`  | **"Pergunte ao painel"** (busca semântica `lib/perguntas.js`) em **destaque no topo**, antes dos cartões. **Cartões de métrica** (peças, ativas/ocultas, variações, esgotadas, categorias, destaques, encomendas novas e — se `podeFinanceiro` — Vendas pagas no mês/aguardando) com **ícone lucide**, número em destaque e destaque vermelho para esgotadas/encomendas novas/aguardando; **cada cartão é clicável e abre um `Modal` de detalhe** calculado dos dados já carregados (lista com selos, texto truncado) + link "Abrir a página completa". **3 gráficos `recharts`** (Peças por categoria/Encomendas por status — barras com **`LabelList`** mostrando o valor; Estoque — rosca com **total no centro** + legenda com valores) — **sem depender de hover** — e **altura responsiva** (`h-56 sm:h-64 lg:h-72`), 1 col mobile / 2 desktop. |
| `/admin/pecas`      | `PecasLista` | Tabela **ordenável** (busca + filtro por categoria), status na vitrine/estoque; "Editar"/"Excluir" (ícones) + atalho de destaque. **Seleção em massa** (checkbox por linha + "todos", barra de ação) e **exclusão com aviso** (`ConfirmarExclusao` lista variações/imagens da peça + "sai dos destaques"; confirmação reforçada por ser cascata). "Nova peça" abre o **modal** (`NovaPecaModal`, `?nova=1`); "Editar" abre `EditarPecaModal` (`?editar=<id>`). Os forms avisam **nome duplicado** junto ao campo Nome (peça é única). |
| `/admin/pecas/nova` | →redirect    | Redireciona para `/admin/pecas?nova=1` (cadastro em modal). |
| `/admin/pecas/:id`  | →redirect    | `RedirecionaEdicao` → `/admin/pecas?editar=<id>` (edição em modal). Mantém deep links e o "ver detalhes" das Categorias. |
| `/admin/estoque`    | `Estoque`    | Tabela **ordenável** de variações; edição por linha com ícone, botões +1/−1 e número manual (nunca < 0); salva via PATCH; destaque/filtro de esgotadas; busca. **Excluir variação** (lixeira) e **seleção em massa** com aviso (`ConfirmarExclusao`). |
| `/admin/categorias` | `Categorias` | CRUD de categorias (inputs de largura fixa padronizada; "Nova categoria" em **modal**) + controle da vitrine (tabela ordenável com Mostrar/Ocultar). Cada peça tem **olho** (`Eye` → modal SÓ LEITURA `DetalhePecaModal`) e **lápis** separado (`Pencil` → `EditarPecaModal`). **Excluir categoria** (única ou em massa) abre `ConfirmarExclusao` listando as **peças que cairão em cascata** (e suas variações/imagens); confirmação reforçada por **checkbox** "entendo que é irreversível" (sem digitar nada). |
| `/admin/cores`      | `Cores`      | CRUD da **paleta de cores** (swatch + nome + hex). "Nova cor"/editar abrem **modal** com picker `react-colorful` (HEX) + nome (máx. 30) + campo hex (`#RRGGBB`). Tabela **ordenável** (`useOrdenacao`) com **seleção em massa** (checkbox por linha + "todos" + barra de ação). Exclusão única ou em lote via `ConfirmarExclusao`. Erros PT-BR do backend (nome duplicado / hex inválido) exibidos no form. |
| `/admin/destaques`  | `Destaques`  | Curadoria das **peças em destaque** da Home. Tabela **ordenável** (nome, categoria, preço, status, destaque) com busca por nome e atalho "Só em destaque". Toggle por peça (ícone `Star`/`StarOff`) via PATCH `{destaque}` (`atualizarPeca`) — invalida `["admin","pecas"]` e `["pecas"]`. Contador "N peças em destaque" + lembrete suave acima de 8 (a Home mostra até 8). Aviso "em destaque, mas oculta" quando a peça está em destaque mas `ativo=false`. |
| `/admin/encomendas` | `Encomendas` | Tabela **ordenável** das encomendas sob medida (cliente, contato **formatado `(DD) NÚMERO`**, prazo, status, data) com destaque das **novas** (`recebido`). **Seleção em massa** + exclusão com aviso (`ConfirmarExclusao` lista as imagens de referência que serão removidas). Detalhe em **modal**: dados, descrição, galeria das imagens (abrem em **popup/lightbox** na própria página, com setas e Esc), seletor de status (PATCH) e excluir (confirmação). |
| `/admin/vendas`     | `Vendas`     | **Pedidos do pagamento online** (Mercado Pago) — tabela **ordenável** (Cliente, Itens=contagem, Total via `Preco`, Status, Data) com filtro por status no cliente (carga completa via `useAdminPedidos`). Selo: `pago`→verde, `aguardando_pagamento`→acento, `expirado`→cinza, `cancelado`→vermelho. Clique na linha / ícone `Eye` abre **modal** de detalhe: cliente (nome+contato), status, total, criado/expira em, **lista de itens** (`peca_nome`, `variacao_descricao`, qtd, `preco_unit` via `Preco`) e os **IDs do Mercado Pago** (`mp_preference_id`, `mp_payment_id`). **SOMENTE LEITURA**: nota explícita de que estorno/cancelamento são feitos no painel do Mercado Pago — sem ações de editar/excluir. |
| `/admin/whatsapp`   | `Whatsapp`   | **Conectar o WhatsApp do bot** por QR Code e gerenciar o **WhatsApp do dono**. Mostra sempre o número atual autorizado (`whatsappDono` → `GET /whatsapp/dono/`), permite trocar por campo numérico com confirmação (`atualizarWhatsappDono` → `PATCH /whatsapp/dono/`, salva `WHATSAPP_DONO` no `.env` via backend) e mantém o fluxo de status/QR: `whatsappStatus`, botão **"Conectar"** (`whatsappConectar` → exibe o **QR `<img>`** + código de pareamento), **polling** enquanto o QR está na tela e botão **"Desconectar"** quando conectado. O backend é proxy (a chave da Evolution nunca chega ao navegador). |

## Como consome a API

- Base: `VITE_API_URL` + `/api/`.
- **Cliente (leitura pública)**: `GET /categorias/`, `GET /pecas/` (paginado
  `{count,next,previous,results}` — hooks extraem `results`), `GET /pecas/{id}/`.
  Filtros: `?categoria=<id>`, `?search=<texto>`, `?ordering=`.
- **Admin (escrita autenticada)**: `Authorization: Bearer <access>` em CRUD de
  `pecas`/`variacoes`/`imagens`/`categorias` e na listagem do admin (que assim enxerga peças
  **inativas** — anônimo só vê ativas). Upload de imagem via **multipart** em `POST /imagens/`.
- **Cores (paleta)**: `listarCores()` (público, percorre paginação → array `{id,nome,hex}`),
  `criarCor`/`atualizarCor`/`excluirCor` (auth). A variação envia `cor` (nome) **e** `cor_hex`
  (hex) ao escolher uma cor salva. O `VariacaoSerializer` retorna `cor_hex`.
- **Checkout (pagamento online)**: `criarCheckout({nome, contato, itens})` faz `POST /checkout/`
  **público** (sem auth; servidor recomputa preços). `itens` = `[{variacao_id, quantidade}]`
  só dos itens com variação. Sucesso 201 `{pedido_id, init_point}` → `window.location.href =
  init_point` (checkout hospedado do MP). `back_urls`: `/pagamento/sucesso|pendente|falha`
  (o MP anexa `?status=&external_reference=<pedido_id>&…` no retorno — a confirmação real é por
  webhook; as páginas só dão UX). Erros: 400 por campo, 409 `{disponibilidade}` (estoque
  insuficiente), 502 `{detalhe}`, 429 throttle.
- **Disponibilidade**: `VariacaoSerializer` retorna `disponivel` (estoque − reservas ativas,
  nunca negativo). O catálogo usa `disponivel` (não `esgotado`/`estoque`) para o selo "Esgotado"
  (`disponivel===0`) e para travar o seletor de quantidade; o item entra no carrinho com
  `estoque: variacao.disponivel`. Helpers em `lib/pecas.js` (`disponivelDaVariacao`,
  `variacaoIndisponivel`).
- **Encomendas**: `criarEncomenda()` faz `POST /encomendas/` **público** (multipart, campo
  `imagens` repetido por arquivo) — devolve `{id,status,mensagem}`. Admin: `listarTodasEncomendas()`
  (auth, paginação completa), `obterEncomenda(id)`, `atualizarEncomendaStatus(id, status)` (PATCH
  JSON) e `excluirEncomenda(id)`. Erros de validação (incl. limites de imagem) vêm por campo PT-BR
  e o formulário também valida no cliente antes de enviar.
- **Vendas/Pedidos (só leitura, admin)**: `listarTodosPedidos(filtros, {auth:true})` percorre a
  paginação de `GET /pedidos/` (filtro `?status=`) e `obterPedido(id)` (`GET /pedidos/{id}/`), ambos
  com JWT (anônimo → 401). Hook `useAdminPedidos` (chave `["admin","pedidos",filtros]`). Os pedidos
  são criados pelo checkout público e confirmados por **webhook do Mercado Pago**; o painel **não**
  cria/edita/exclui (estorno/cancelamento são feitos no painel do MP). Shape: `{id, nome, contato,
  status, total, mp_preference_id, mp_payment_id, criado_em, expira_em, itens:[{id, variacao,
  variacao_descricao, peca_nome, quantidade, preco_unit}]}`.
- **Conexão do WhatsApp (admin)**: `whatsappStatus()` (`GET /whatsapp/status/`), `whatsappConectar()`
  (`POST /whatsapp/conectar/` → `{estado, qr_base64, pairing_code, mensagem}`), `whatsappDesconectar()`
  (`POST /whatsapp/desconectar/`), `whatsappDono()` (`GET /whatsapp/dono/`) e `atualizarWhatsappDono(numero)`
  (`PATCH /whatsapp/dono/`), todos com JWT. O backend é proxy da Evolution (a `EVOLUTION_API_KEY`
  nunca vai ao navegador). A página `Whatsapp.jsx` faz polling do status enquanto o QR está visível e mostra sempre o número autorizado atual.
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
- **Auth do admin (multiusuário)**: tokens JWT em `localStorage`; refresh automático no 401; logout
  limpa tokens. Após login (e no 1º carregamento com token), o `AuthContext` busca `GET /me/` e expõe
  `papel`/`ehDono`/`podeFinanceiro` (= dono **ou** `acesso_financeiro`)/`senhaProvisoria`/`usuario` +
  `recarregarMe`. **Guardas** (`components/admin/RotaProtegida.jsx`): `RequerLogin` (login + espera o
  `/me/`), `RotaProtegida` (login + se `senhaProvisoria`, força `/admin/senha`), `ExigeDono` e
  `ExigeFinanceiro` (acesso direto por URL volta ao Resumo). A navegação (`AdminLayout`) e os cartões
  de Vendas do Dashboard são montados por papel — **mas a segurança é do backend** (esconder é só UX).
  O Dashboard só busca `/pedidos/` quando `podeFinanceiro` (evita 403 do funcionário).
- **Auth do cliente (separada do admin)**: `ContaContext`/`useConta` gerenciam a sessão do cliente
  com um cofre de tokens **próprio** (`tokensCliente`, chaves `atelie_cliente_*` — nunca mistura com
  o admin). `lib/api.js` aceita `auth: "cliente"` (token/refresh/evento `auth:expirou:cliente`
  próprios). Expõe `logado`/`cliente`/`entrar`/`cadastrar`/`sair`/`recarregar`. Guarda `RotaCliente`
  manda ao `/conta/login?next=…`. CPF/telefone com máscara+validação em `lib/cpf.js` e
  `lib/telefone.js` (esta reusada pela Encomenda). O backend reforça tudo (cliente ≠ staff).
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
- **Paginação (10/página) no admin**: os hooks (`useAdminPecas`/`useAdminEncomendas`/`useAdminPedidos`,
  `listarUsuarios`, `useCores`) **agregam todas as páginas** do backend num array; a **UI pagina no
  cliente** com `hooks/usePaginacao.js` (`ITENS_POR_PAGINA = 10`) + `components/admin/Paginacao.jsx`,
  **depois** de busca/filtro/ordenação (recebe a lista já filtrada/ordenada; `resetKey` volta à
  página 1 ao mudar filtro; a página é clampada quando a lista encolhe). Igual em tabela (desktop) e
  cartões (mobile) — muda só a fatia. "Selecionar todos" usa os ids da **página atual**; a exclusão em
  massa age sobre tudo que estiver selecionado. O **backend já pagina** (`PageNumberPagination`,
  `count/next/previous/results`, `PAGE_SIZE=20`). *Melhoria futura (admin):* se o volume chegar a
  milhares, migrar o admin para server-side (`?page=` sob demanda). A mesma `Paginacao` também é usada
  nos **detalhes do Resumo** (listas dos modais de métrica do Dashboard, 10/página, cliente) e na
  **vitrine pública**, esta já **server-side**: `usePecasPaginadas` passa `page` ao backend e usa o
  `count` para os controles (20/página); volta à página 1 ao mudar busca/categoria.
- **Ícones**: sempre componentes do `lucide-react` (ex.: `Plus`, `Minus`, `Pencil`, `Trash2`,
  `Eye`, `X`, `Check`), nunca imagem/SVG inline. Ícones decorativos com `aria-hidden`; quando a
  ação é só ícone, usar `aria-label`.

## Histórico de mudanças

- **2026-06-25** — **Código de rastreio dos Correios** no front. **Admin › Vendas**: o modal de
  detalhe ganhou um `RastreioEditor` — campo `codigo_rastreio` editável **só em pedido pago** (salva
  via `atualizarRastreio` → `PATCH /pedidos/{id}/rastreio/`, com feedback e invalidação das queries
  `["admin","pedido",id]`/`["admin","pedidos"]`); ícone `Truck` discreto na lista quando há rastreio;
  notas de "somente leitura" viraram "somente leitura, exceto o código de rastreio". **Cliente ›
  Meus pedidos**: quando há `codigo_rastreio`, bloco com o código + **Copiar** (`navigator.clipboard`)
  + link "Acompanhar nos Correios" (site oficial, nova aba). Novo helper `atualizarRastreio` no
  `lib/api.js`.
- **2026-06-25** — **Relatórios (financeiro)** no front. Nova página **`/admin/relatorios`**
  (`pages/admin/Relatorios.jsx`, gate `ExigeFinanceiro`; item "Relatórios" no grupo *Pedidos* do
  `AdminNav`, só Dono/`acesso_financeiro`) com **3 relatórios em abas**: Vendas por período (filtro
  de datas + granularidade; cartões faturamento/pedidos/ticket; `BarChart`; tabela), Produtos mais
  vendidos (datas + top N; `BarChart` horizontal; tabela quantidade/receita), Resumo do mês
  (`type=month`; cartões + tabela de **cupons** usados). Tabelas paginadas (10) e ordenáveis
  (`useOrdenacao`/`usePaginacao`); estados carregando/vazio/erro; gráficos `recharts` responsivos.
  **Exportar** com caixa de formato **CSV/PDF** → `baixarRelatorio` (download **autenticado** por
  blob — busca com o token e dispara `<a download>`). Novos helpers em `lib/api.js`
  (`relatorioVendasPeriodo`/`relatorioProdutosVendidos`/`relatorioResumoMes`/`baixarRelatorio`).
- **2026-06-25** — **Promoções e cupons** no front. **Vitrine/Detalhe**: `PecaCard` e `DetalhePeca`
  mostram preço **riscado + promocional** + selo "Promoção" quando `em_promocao` (a peça vai ao
  carrinho pelo `preco_promocional`; o servidor reconfirma). **Carrinho**: campo **Cupom** + "Aplicar"
  → `validarCupom` (mostra desconto e total; erros amigáveis) e o código segue no `criarCheckout`
  (o checkout reconfirma no servidor). **Admin › Promoções** (`/admin/promocoes`, no grupo *Pedidos*,
  visível só a Dono/`acesso_financeiro`): tabela paginada/ordenável + busca, criar/editar em modal
  (validação de tipo/escopo/valor/datas/limite/acumulável), ativar/desativar, **ver detalhes**
  (`DetalhePromocao` — modal read-only: situação/vigência agora, escopo completo, período legível,
  usos, acumulável), ver usos, excluir (`ConfirmarExclusao`). Helpers em `lib/api.js` (`validarCupom`,
  `listar/criar/atualizar/excluirPromocao`).
  **Refino do form**: valor em R$ usa máscara BRL (`CampoPreco`) e em % tem sufixo "%" + teto 100;
  escopo por **peça(s)/categoria(s)** com **seletor de busca + múltipla seleção** (`SeletorMulti`,
  lista com **rolagem** + atalhos "Selecionar todas (filtradas)"/"Limpar"); **prévia** do preço com
  desconto por peça (`PreviaDesconto`, rola com +10 peças); na tabela, o escopo mostra só os 5
  primeiros nomes (+"…", lista completa no `title`); datas `datetime-local` com `step=60` e **`min` =
  agora** (não seleciona passado) + fim ≥ início, enviadas como **ISO com fuso** (`new Date(local)
  .toISOString()`) p/ o período valer no horário local escolhido; dica legível "dd/mm/aaaa às hh:mm";
  **limite de usos até 10 dígitos**. `npm run build` (SSG) ok.
- **2026-06-25** — **Código de compra legível** (`PED-000042`) exibido em **Meus pedidos** (cliente),
  **Vendas** do admin (coluna + detalhe; vira o título do cartão no mobile) e nas três telas de
  **retorno do pagamento**. Vem do backend (`pedido.codigo`); onde só há o id na URL (retornos),
  `lib/pedido.js` (`codigoPedido`) formata igual. `npm run build` (SSG) ok.
- **2026-06-25** — **Header responsivo** (só layout; design/tokens inalterados). Desktop (≥sm): uma
  linha alinhada — logo · nav (Início/Vitrine/Encomenda) · conta (Entrar/Criar conta ou Minha
  conta/Sair) + botão "Meu pedido" (`acento-escuro`). Mobile (<sm): logo + carrinho **compacto**
  (ícone + badge sobreposto, sem texto) + **hambúrguer** que abre um painel com **navegação + conta**;
  fecha no Esc, clique fora e ao escolher item (`aria-expanded`/`aria-controls`, foco visível). Sem
  overflow/quebra em ~320–380px; sticky + backdrop-blur mantidos. `npm run build` (SSG) ok.
- **2026-06-25** — **Rebrand para "Ateliê da Sete"** (Roupas & Artigos Religiosos — Umbanda +
  Candomblé, Campo Grande/MS, dona Gabrielly Liberato). Trocados **só copy/marca/contexto** (design
  intacto): nome/tagline em `config/site.js` (+ FAQ de 6 itens e depoimentos placeholder das copys),
  todas as seções da **Home** reescritas conforme `COPYS_HOME.md` (Hero, Alguns trabalhos, manifesto,
  O que costuramos, Diferenciais, Depoimentos, FAQ, CTA — CTAs de WhatsApp com a microcopy nova),
  SEO/`meta.js` (titles/descriptions por rota) e JSON-LD (ClothingStore + FAQPage), `index.html`
  `<title>`, footer (NAP + "Feito com axé… Saravá as Sete Linhas"), e os textos de marca em Header,
  AdminLayout, Login, retornos de pagamento, DetalhePeca e Apresentacao. Regras de copy respeitadas
  ("conforme o fundamento da sua casa"; sem termos proibidos). `npm run build` (SSG) ok.
- **2026-06-25** — **Paginação estendida aos detalhes do Resumo e à vitrine pública.** Os modais de
  detalhe das métricas do Dashboard agora paginam (10/página, `DetalheLista` reusando `usePaginacao`
  + `Paginacao`). A **vitrine** (`/vitrine`) ganhou paginação **server-side** (novo hook
  `usePecasPaginadas` que devolve `{itens,total}`; passa `page` ao backend; controles `Paginacao`,
  20/página; volta à página 1 ao mudar busca/categoria) — antes mostrava só os 20 primeiros. `usePecas`
  (array) segue intacto para a Home. `npm run build` (SSG) ok.
- **2026-06-25** — **Paginação na UI (10/página) em TODAS as tabelas do admin** (Peças, Estoque,
  Categorias [2 tabelas], Cores, Destaques, Encomendas, Vendas, Funcionários). Novos `hooks/
  usePaginacao.js` + `components/admin/Paginacao.jsx` (reutilizáveis; desktop + cartões mobile),
  aplicados **após** busca/filtro/ordenação, voltando à página 1 ao mudar o filtro; "selecionar
  todos" = página atual (exclusão em massa intacta). Os hooks do admin continuam agregando todas as
  páginas do backend; só a renderização é fatiada. Backend de paginação **verificado** (`/api/pecas/`
  → `count/next/previous/results`, 20/página) — vitrine pública inalterada. `npm run build` (SSG) ok.
- **2026-06-25** — **Resumo (Dashboard) reorganizado e enriquecido** (mantendo `recharts`): a caixa
  **"Pergunte ao painel"** subiu para o topo (em destaque); **cartões de métrica** ganharam ícone
  lucide + número destacado e agora **abrem um `Modal` de detalhe** (lista das peças/variações/
  categorias/encomendas/pedidos da métrica, com selos e texto truncado + link "Abrir a página
  completa") em vez de navegar. **Gráficos com números visíveis** (`LabelList` nas barras; total no
  centro da rosca + legenda com valores) e **altura responsiva** no mobile (`h-56 sm:h-64 lg:h-72`),
  eixos mais enxutos. Regra de papel/financeiro intacta (cartões/queries de Vendas só com
  `podeFinanceiro`). `npm run build` (SSG) ok.
- **2026-06-25** — **Conta de cliente com login** (checkout passa a exigir conta). Nova sessão de
  cliente **separada do admin**: `context/ContaContext.jsx` (`useConta` + guarda `RotaCliente`),
  cofre de tokens `tokensCliente` e `auth:"cliente"` em `lib/api.js` (helpers `contaCadastro`/
  `contaLogin`/`contaMe`/`contaAtualizar`/`contaTrocarSenha`/`contaPedidos`). Novas páginas públicas
  `pages/conta/{Cadastro,Login,MinhaConta,MeusPedidos}.jsx` (validação completa, máscaras/validação
  de CPF/telefone em `lib/cpf.js`+`lib/telefone.js`, placeholders "Ex:", estados, mensagens PT-BR).
  `Header` mostra Entrar/Criar conta × Minha conta/Sair. **`Carrinho`** deixou de coletar nome/contato
  — exige login (CTA p/ `/conta/login?next=/carrinho`) e usa os dados da conta; `criarCheckout({itens})`
  agora vai com a auth do cliente. `Encomenda` passou a reusar `lib/telefone.js`. `ContaProvider`
  somado ao `Providers`. `npm run build` (SSG) ok. Sem mexer no admin nem na Encomenda (fluxo WhatsApp).
- **2026-06-25** — **Tabelas do admin viram cartões no mobile** (desktop intacto), de forma
  reutilizável: a `<table>` recebe `tabela-cartoes` e cada `<td>` anota `data-rotulo="…"` +
  `cel-principal`/`cel-selecao`/`cel-acoes`; o CSS em `index.css` (`@media max-width:639px`) empilha
  em cartões (título + rótulo:valor + ações no rodapé + checkbox no canto). Novo `OrdenarMobile`
  (em `CabecalhoOrdenavel.jsx`) dá o "Ordenar por ▾" + inverter no mobile, reusando `useOrdenacao`
  (ordenação persiste igual ao desktop). Seleção em massa por checkbox no cartão (barra de ação
  inalterada). Contêiner da tabela só mostra borda/scroll a partir de `sm:` (640px), alinhado ao
  breakpoint dos cartões. Aplicado a Peças, Estoque, Categorias (2 tabelas), Cores, Destaques,
  Encomendas, Vendas e Funcionários. Sem mudar dados/rotas/permissões. `npm run build` (SSG) ok.
- **2026-06-25** — **Navegação do painel agrupada** em `components/admin/AdminNav.jsx` (extraída do
  `AdminLayout`): 5 itens de topo — Resumo (link), **Catálogo ▾** (Peças/Categorias/Cores/Destaques),
  Estoque (link), **Pedidos ▾** (Encomendas/Vendas), **Configurações ▾** (Funcionários/WhatsApp).
  Desktop: dropdown abre por **hover + clique + foco do teclado**, fecha com atraso ~150ms / `Esc` /
  clique fora; item de topo destacado quando a rota atual é filha. Mobile: **hambúrguer + sanfona**.
  Visibilidade por papel (Vendas só com financeiro; Configurações só Dono; grupo vazio some).
  Acessível (`aria-haspopup`/`aria-expanded`, `role=menu/menuitem`, teclado, foco visível; itens são
  `NavLink`). **Não** mudou rotas, telas nem permissões. `npm run build` (SSG) ok.
- **2026-06-24** — **Multiusuário com papéis** no painel. `AuthContext` passou a buscar `GET /me/`
  (papel/`acesso_financeiro`/`senha_provisoria`) e expõe `ehDono`/`podeFinanceiro`/`senhaProvisoria`.
  Novas guardas em `RotaProtegida.jsx` (`RequerLogin`, `RotaProtegida` com redirecionamento de senha
  provisória, `ExigeDono`, `ExigeFinanceiro`). Nova tela **`/admin/senha`** (`TrocarSenha`) — troca
  forçada da senha provisória antes de usar o painel. Nova seção **`/admin/funcionarios`**
  (`Funcionarios`, só Dono): tabela ordenável + busca, criar funcionário em modal (com senha
  provisória + interruptor de financeiro), ativar/desativar, resetar senha (mostra a provisória uma
  vez), liberar/revogar financeiro e excluir (`ConfirmarExclusao`). `AdminLayout` monta a navegação
  por papel (Vendas só com financeiro; Funcionários e WhatsApp só Dono). Dashboard oculta os cartões
  de Vendas e só busca `/pedidos/` quando `podeFinanceiro` (sem 403). Novos helpers em `lib/api.js`
  (`obterMe`, `mudarSenha`, `listarUsuarios`, `criarUsuario`, `atualizarUsuario`, `excluirUsuario`);
  `useAdminPedidos` aceita `{ enabled }`. `npm run build` (SSG) ok. Backend reforça as permissões.
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
- **2026-06-21** — **Pagamento online** (checkout Mercado Pago, Subagente B): o `/carrinho`
  deixou de finalizar pelo WhatsApp e passou a ter um form **"Finalizar compra"** (Nome ≤80,
  Contato ≤100, validação completa PT-BR) que chama `criarCheckout` (`POST /checkout/`, público)
  e redireciona ao `init_point` do MP; itens **sob medida** (sem `variacaoId`) ficam de fora com
  aviso para a Encomenda; 409 mostra a disponibilidade. Não limpa o carrinho aqui. Três rotas de
  **retorno** sob o layout do cliente (CSR, **fora do `ROTAS_SSG`**): `/pagamento/sucesso`
  (limpa o carrinho), `/pagamento/pendente` e `/pagamento/falha` — leem `external_reference`/
  `status` só para a cópia (confirmação real = webhook). Catálogo passou a usar **`disponivel`**
  (estoque − reservas) no selo "Esgotado", no cap do seletor e no `estoque` do item do carrinho
  (`lib/pecas.js`: `disponivelDaVariacao`/`variacaoIndisponivel`; `SeletorVariacao`/`DetalhePeca`/
  `PecaCard`). Encomenda e WhatsApp da encomenda **intactos**. `lint` (0 erros) e `npm run build`
  (SSG) ok.
- **2026-06-21** — Cores, validação completa, máscaras e gráficos do admin (Subagente B):
  **Cores** — nova seção `/admin/cores` (`pages/admin/Cores.jsx`) + item no `AdminLayout`; CRUD da
  paleta com picker `react-colorful` (instalado, suporta React 19), tabela ordenável e exclusão via
  `ConfirmarExclusao`. Helpers `lib/api.js` (`listarCores`/`criarCor`/`atualizarCor`/`excluirCor`),
  hook `useCores`, `lib/cores.js`. Novo `SeletorCor` (swatches da paleta + "Nova cor") usado nas
  variações do `NovaPecaModal` e do `VariacoesEditor`; a variação persiste `cor` + `cor_hex`.
  **Validação completa** — `lib/validarPeca.js` acumula TODOS os erros por campo de uma vez
  (nome/preço/categoria/estoque das variações), exibidos inline + resumo no topo (Nova e Editar peça).
  **Máscaras/contadores** — `lib/moeda.js` + `CampoPreco` (moeda BRL, teto R$ 1.000.000, envia
  decimal à API); contadores de caracteres em nome (80) e descrição (600). **Olho = só leitura** —
  `DetalhePecaModal` (visualização) separado do lápis (edição) em Categorias. **Dashboard** — removida
  a seção "Atalhos"; 3 gráficos `recharts` (instalado) + caixinha de perguntas (`lib/perguntas.js`,
  intenções por palavra-chave, sem API paga). `lint` (0 erros) e `npm run build` (SSG) ok — recharts
  não entra no bundle SSR (só rotas públicas são pré-renderizadas).
- **2026-06-21** — Entradas do **cliente** com menos cliques e restritas (Subagente C):
  **Encomenda** (`Encomenda.jsx`) — Tamanho virou **chips** de seleção única (P/M/G/GG/Único +
  "+ Outro" com texto livre que alimenta `tamanho_medidas`); Busto/Cintura/Quadril/Comprimento
  são **numéricos** com sufixo fixo "cm" + **stepper +/−** (lucide `Plus`/`Minus`, faixa 20–250,
  opcionais); Nome `maxLength 80` + **auto-capitalização**; Contato com **máscara de telefone**
  `(67) 99999-9999` (10/11 dígitos, trava no fim); Descrição `maxLength 600` + **contador**;
  Prazo nativo com `min`=hoje e `max`≈1 ano; **validação acumula todos os erros** (mapa por campo,
  inline em vermelho + resumo no topo, `noValidate`) e mapeia o erro do backend. Upload/limites de
  imagem, tela "enviada" e botão do WhatsApp mantidos. **Carrinho** — observação `maxLength 300` +
  contador. **Vitrine** — busca `maxLength 60` (`Filtro.jsx`). Admin intacto.
  `lint` (0 erros) e `npm run build` (SSG) ok.
- **2026-06-22** — Seção **Vendas** no painel (`/admin/vendas`, `pages/admin/Vendas.jsx`) para
  acompanhar os **pedidos do pagamento online** (Mercado Pago) — modelada na `Encomendas.jsx`.
  Tabela **ordenável** (Cliente, Itens, Total via `Preco`, Status, Data) com filtro por status no
  cliente (carga completa) e **modal de detalhe** (dados do cliente, status/total/datas, lista de
  itens e os IDs do MP). **Somente leitura** com nota de que estorno/cancelamento são no painel do
  MP. Novos helpers em `lib/api.js` (`listarTodosPedidos`/`obterPedido`, `GET /pedidos/`, auth),
  hook `useAdminPedidos`, item "Vendas" no `AdminLayout` e dois cartões no Dashboard ("Vendas pagas
  no mês" → link p/ Vendas, "Pedidos aguardando pagamento"). `lint` (0 erros, só warnings
  pré-existentes de react-refresh) e `npm run build` (SSG) ok.
- **2026-06-22** — Seção **WhatsApp** no painel (`/admin/whatsapp`, `pages/admin/Whatsapp.jsx`) para
  o dono **parear o número por QR Code** sem usar curl/README. Mostra status (`whatsappStatus`),
  botão "Conectar" que pede o QR (`whatsappConectar`) e o exibe como `<img>` + código de pareamento,
  faz **polling** do status enquanto o QR está visível (some ao conectar — ajuste de estado na
  renderização, sem efeito) e "Desconectar" quando conectado. Helpers `whatsappStatus/Conectar/
  Desconectar` em `lib/api.js`; item "WhatsApp" no `AdminLayout`. O backend é proxy (chave da
  Evolution nunca chega ao navegador). `lint` (0 erros) e `npm run build` (SSG) ok.
- **2026-06-22** — `/admin/whatsapp` ganhou seção **WhatsApp do dono**: mostra sempre o número autorizado atual, permite informar novo número em formato internacional (somente dígitos) e exige confirmação antes de salvar. Novos helpers `whatsappDono`/`atualizarWhatsappDono` em `lib/api.js`; `lint` sem erros (warnings antigos de react-refresh) e `npm run build` ok.
- **2026-06-24** — **Auditoria de conformidade** (telas admin + cliente) à Padronização do `STYLE.md`,
  só corrigindo desvios (sem redesenho): (1) **Fim dos `window.confirm`** — `VariacoesEditor` e
  `ImagensEditor` (remover variação/imagem na edição) e o modal de detalhe de **Encomendas** passaram
  a usar `ConfirmarExclusao`; em **Whatsapp**, "trocar WhatsApp do dono" e "desconectar" usam agora um
  **modal de confirmação** reutilizando `Modal` (padrão para confirmações que não são exclusão).
  (2) **Placeholders** de exemplo em **itálico + cor mais suave** e no formato "Ex.: …"
  (`inputClasse` do admin + `inputClasse` local do cliente em `Carrinho`/`Encomenda`/`Filtro`).
  (3) **Truncamento + tooltip** (`title`) nas células de Cliente (Encomendas/Vendas) e Peça
  (`PecasLista`). (4) **Erros sem jargão**: rótulos de estado do painel de WhatsApp deixaram de citar
  "Evolution" ("Erro no serviço"/"Serviço indisponível"). (5) **Retorno do pagamento**: `Sucesso.jsx`
  não afirma mais aprovação por query param ("Pedido recebido!" + confirmação via webhook), conforme
  a regra do `STYLE.md`. Também: botões "Adicionando…"/"Desconectando…" reforçando o anti-duplo-envio.
  (6) **Seleção em massa em Cores**: a tabela de `/admin/cores` ganhou checkbox por linha + "todos" +
  barra de ação (exclusão em lote via `ConfirmarExclusao`), alinhando-a às demais tabelas do admin.
  `npm run build` (SSG) ok. Backend não foi tocado.
- **2026-06-24** — Exclusão **sem digitar nada**: `ConfirmarExclusao` deixou de exigir digitar o
  nome do item / a palavra `EXCLUIR`. A confirmação reforçada em cascata (categorias/peças) passou a
  ser só o **checkbox** "Entendo que esta ação é irreversível"; exclusões simples seguem só com o
  botão. Removida a prop `confirmacaoTexto` do componente e de todos os chamadores
  (Categorias/Peças/Estoque/Cores/Encomendas). `npm run build` (SSG) ok.
