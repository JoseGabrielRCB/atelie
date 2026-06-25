# STYLE.md — Guia de Estilo do Ateliê (fonte única)

> Fonte ÚNICA da identidade visual (substitui qualquer `ESTILO.md`). O frontend
> (React + Tailwind) deve seguir este guia. Atualize aqui antes de mudar o visual.

## Princípios

- **Clean e minimalista.** Fundo claro, espaço em branco, foco nas fotos das peças.
- **A roupa é a estrela.** A interface é neutra; a cor vem das fotos.
- **Mas legível e com destaque claro.** Minimalismo não é falta de contraste: texto tem que ler fácil e as ações (carrinho, comprar) têm que saltar aos olhos.
- **Mobile-first.** Primeiro o celular, depois o desktop.

## Padronização (regras-padrão para o agente)

> Regras válidas para **todo** o sistema, por padrão — o agente deve segui-las sem precisar ser
> lembrado a cada tarefa. A seção "Padrões de componente do painel" (mais abaixo) é a **implementação**
> destas regras no admin.

**Princípios transversais:** "menos cliques possível" (preferir chips/`+`−`/seleção a digitação livre);
**reaproveitar componentes existentes** (Modal, tabela ordenável, selos) e usar **ícones sempre via
`lucide-react`** (nunca imagem); formatos **brasileiros** por padrão (`R$ 1.234,56`, datas `dd/mm/aaaa`,
vírgula decimal).

### Tabelas
- **Ordenáveis** por qualquer coluna (clique no cabeçalho alterna asc/desc), com a ordenação
  **persistindo** ao paginar/recarregar.
- **Paginação** sempre que a lista puder crescer. **Toda tabela/listagem do admin pagina em 10 itens
  por página** — a paginação é aplicada **depois** de busca/filtro/ordenação (reflete o conjunto já
  filtrado/ordenado) e **volta à página 1** quando muda a busca/filtro/ordenação. Controles
  "Anterior/Próxima" + "Página X de Y" + total; funciona igual no desktop (tabela) e no mobile
  (cartões). Em **seleção em massa**, "selecionar todos" age na **página atual**.
- **Seleção em massa:** selecionar todas (e por linha) para **ações em lote** (ex.: excluir). Ações que
  só fazem sentido item a item (**ver detalhes**, **editar**) ficam **fora** da seleção em massa.
- **Texto longo na célula:** truncar com reticências (ex.: "Rua Antônio Emílio de…") e mostrar o
  conteúdo completo ao passar o mouse (**tooltip**).
- **No mobile (abaixo de ~640px), a tabela vira lista de cartões** (rótulo: valor), com o campo
  principal como título e as ações em botões no rodapé do cartão; a ordenação é feita por um controle
  **"Ordenar por"** (+ inverter asc/desc) no topo da lista; a seleção em massa é por **checkbox no
  cartão** (a barra "N selecionados / Excluir selecionados" continua igual). **Rolagem horizontal
  deixa de ser o padrão.** No cartão o valor pode quebrar/encurtar (não precisa de tooltip).

### Campos de preenchimento
- **Largura média**, proporcional ao dado esperado — nunca um campo gigante para um conteúdo curto.
- **Preferir entradas controladas:** revisar se o campo pode virar **botões de opção/chips** (poucas
  opções) ou **lista suspensa** (muitas). Se a lista puder ser alimentada por uma **API** (ex.:
  endereço por CEP), **consultar o dono antes** de adicionar a dependência.
- **Placeholder de exemplo** quando vazio: no formato **"Ex: …"**, em **itálico** e com cor **mais
  suave** (menor contraste) que o texto digitado — para nunca se confundir com um valor preenchido.
- **Validação contínua e contextual**, em tempo real: filtrar a digitação conforme o tipo
  (telefone/CPF não aceitam letras; campos numéricos não aceitam texto) e indicar **na hora** se o
  campo já está **válido** ou ainda **incorreto**.
- **Máscara automática** conforme o contexto, formatando enquanto se digita: moeda `R$ XX,XX`,
  telefone `(67) 99999-9999`, CPF, CEP, data.

### Formulários
- **Abrem em modal**, sem tirar o usuário da página. *(Exceção: fluxos que avançam de etapa, como o
  checkout de pagamento.)*
- **Sempre completos** — nunca em partes ocultas que só aparecem depois de preencher um trecho.
- **Botões ao final**, de forma intuitiva: ação principal (Salvar/Enviar/Criar, conforme o contexto)
  + **Cancelar**.
- **Confirmação ao concluir:** mensagem clara de que foi **salvo/enviado**.
- Validar **todos** os campos de uma vez (erros inline por campo + resumo) — nunca um erro de cada vez.

### Ações destrutivas (exclusão)
- Nunca usar o popup do navegador. Sempre um **modal** que **lista exatamente o que será removido**
  (incluindo o que cai em **cascata**), avisa que é **irreversível** e pede confirmação explícita.
- Em **exclusão múltipla**, agrupar a lista **por item**; quando houver cascata, confirmação
  **reforçada** marcando um **checkbox** "Entendo que esta ação é irreversível" (sem precisar
  digitar nada). Botão de confirmar sólido em `erro`.

### Visualizar × editar
- **Visualizar é só-leitura** (sem inputs). Editar é uma ação **separada e explícita** (lápis/botão).
  Não usar o "olho" para abrir o formulário de edição.

### Feedback e estados
- Botões de ação mostram progresso ("Salvando…") e ficam **desabilitados durante a ação** — evita
  clique duplo / envio duplicado.
- Toda tela que carrega dados tem **três estados**: **carregando** (skeleton), **vazio** (mensagem) e
  **erro** (mensagem amigável + "Tentar novamente").

### Erros (mensagens)
- **Para o usuário:** linguagem simples, **sem termos técnicos nem inglês** — explicação curta do que
  houve e o que fazer.
  - ❌ Ruim: "Evolution não está funcionando." (o usuário não sabe o que é "Evolution".)
  - ✅ Bom: "O sistema está fora do ar no momento. Tente novamente em instantes ou contate o suporte."
- **Para o desenvolvedor:** o erro técnico e específico continua **nos logs do backend** (status,
  causa, stack) — só não aparece para o usuário final.

## Paleta de cores (revisada para mais contraste — 19/06/2026)

| Token | Hex | Uso |
|-------|-----|-----|
| `fundo` | `#F7F5F1` | fundo das páginas (off-white levemente mais quente) |
| `superficie` | `#FFFFFF` | cartões, áreas elevadas (contrastam com o fundo) |
| `texto` | `#1A1816` | títulos e texto principal (mais escuro) |
| `texto-suave` | `#57534E` | textos secundários/legendas — **escurecido** para ler melhor |
| `borda` | `#D6CFC4` | linhas/contornos — **mais visível** que antes |
| `acento` | `#B07A56` | destaques leves, ícones, detalhes (terracota) |
| `acento-escuro` | `#7E4E2E` | **fundo dos botões primários** e links (contraste AA com texto branco) |
| `acento-hover` | `#653A1F` | hover/pressionado dos botões primários |
| `esgotado` | `#8C887F` | selo "Esgotado", itens indisponíveis |
| `sucesso` | `#2E6B49` | confirmações e botão do WhatsApp |
| `erro` | `#9E3633` | mensagens de erro |

> **Regra de contraste:** texto branco só sobre `acento-escuro`/`acento-hover`/`sucesso`/`erro` (nunca sobre o `acento` claro). Texto sobre fundo claro usa `texto` ou `texto-suave` — não usar cinza mais claro que `texto-suave`.

## Tipografia

- **Cormorant Garamond** (títulos, serifada elegante) + **Inter** (texto/UI). Google Fonts.

| Nível | Tamanho (mobile/desktop) | Peso | Cor |
|-------|--------------------------|------|-----|
| Título de página | 28 / 36px | 600 | `texto` |
| Nome da peça | 18 / 20px | 500 | `texto` |
| Preço | 16 / 18px | 600 | `texto` |
| Corpo | 15 / 16px | 400 | `texto` |
| Legenda/categoria | 13px | 500 | `texto-suave` |

## Espaçamento e formas

- **Escala de espaço** (px): 4, 8, 12, 16, 24, 32, 48, 64.
- **Cantos:** 8px em cartões/botões/imagens.
- **Sombra:** discreta; usar para destacar cartões no hover (ver abaixo).
- **Largura máxima:** ~1200px, centralizado, margem lateral 16px no celular.

## Destaque e interações (NOVO — foco dos ajustes)

- **Botão do carrinho (header):** é a ação mais importante — deve ser um **botão sólido** em `acento-escuro` com texto/ícone branco (não um link discreto), fixo no topo, com um **badge** mostrando a quantidade de itens. Hover em `acento-hover`. Sempre visível ao rolar (header sticky).
- **Card de peça:** tem **borda** (`borda`) ao redor para destacá-lo do fundo, com fundo `superficie` e cantos 8px. No **hover** ganha mais destaque: a borda passa a `acento`, leve elevação (sombra `0 6px 20px rgba(0,0,0,0.10)`), leve `scale` (~1.02) e zoom suave na foto (imagem `scale 1.05`), tudo com `transition` de ~200ms. No mobile não depende de hover.
- **Botão primário:** fundo `acento-escuro`, texto branco, hover `acento-hover`.
- **Foco (acessibilidade):** estados de foco visíveis (anel em `acento-escuro`) em botões, links e campos.
- **Selo "Esgotado":** fundo `esgotado`, texto branco, pequeno, no canto da foto.
- **Promoção (preço):** quando há promoção **automática**, o card/detalhe mostram o **preço novo** em
  `acento-escuro` ao lado do **preço antigo riscado** (`line-through`, `texto-suave`) + selo discreto
  "Promoção" (`acento-escuro`). No carrinho, o campo **Cupom** mostra o desconto/total ao aplicar; o
  valor final é sempre reconfirmado no servidor.
- **Seletor de tamanho/cor:** chips; selecionado em `acento-escuro` com texto branco; indisponível apagado (`esgotado`) e riscado.

## Entradas do cliente (formulários públicos)

Os formulários do cliente (encomenda, carrinho, busca, **conta**) seguem o mesmo princípio do painel
(entradas restritas, menos cliques), com a identidade do cliente (cantos 8px, `acento-escuro`).

- **Conta do cliente (login/cadastro/perfil):** cadastro e login são **páginas públicas** (não modal —
  é um fluxo, não uma ação pontual), sob o layout do cliente (com Header). **CPF obrigatório** no
  cadastro, com **máscara `000.000.000-00` + validação dos dígitos verificadores** em tempo real
  (espelha o backend); e-mail e telefone também com validação/máscara. Validação **completa** (todos
  os erros de uma vez, inline + resumo). Em "Minha conta", e-mail e CPF são **somente-leitura** (troca
  via suporte no MVP). O **checkout exige conta**: deslogado, leva a login/cadastro com `?next=` e
  volta; logado, mostra um resumo dos dados da conta + "Finalizar compra" (sem recoletar nome/CPF). A
  sessão do cliente é **separada** da do admin (storage e contexto próprios).

- **Chips de tamanho (Encomenda):** o tamanho é escolhido em **chips** de seleção única
  (P · M · G · GG · Único), não texto livre — um clique seleciona, clicar de novo desmarca.
  Selecionado = `acento-escuro` + texto branco (regra dos chips); não selecionado = borda `borda`
  com hover `acento-escuro`. Um chip **"+ Outro"** revela um campo de texto curto para tamanhos
  fora do padrão (ex.: numéricos). `aria-pressed` no chip ativo; foco visível (anel `acento-escuro`).
- **Sufixo "cm" + stepper (medidas):** Busto/Cintura/Quadril/Comprimento são **numéricos** com o
  sufixo **"cm" fixo embutido** pela UI (não digitado), botões **+/−** (ícones lucide `Plus`/`Minus`)
  e faixa sã (20–250). Opcionais (vazio = não informado); compostos no texto da encomenda.
- **Máscara de telefone:** o campo de contato auto-formata para **`(67) 99999-9999`** enquanto
  digita (só dígitos, trava no comprimento certo; aceita fixo 10 e celular 11 dígitos).
- **Auto-capitalização:** o campo de nome capitaliza as iniciais das palavras.
- **Contadores de caracteres (cliente):** campos com limite mostram "N/MÁX" e usam `maxLength`
  (encomenda: nome 80, descrição 600; carrinho: observação 300; busca da vitrine: 60). Os limites
  espelham o backend.
- **Validação completa (cliente):** o formulário de encomenda valida **TODOS** os campos de uma vez
  (mapa de erros por campo), com a mensagem **inline em vermelho** sob cada campo E um **resumo** no
  topo — nunca um erro de cada vez. Erros do backend também são mapeados. `noValidate` no `<form>`.
- **Prazo (date):** calendário nativo com `min`=hoje e `max`≈1 ano à frente.
- **Finalizar compra (carrinho → pagamento):** o botão "Finalizar compra" é **primário**
  (`acento-escuro`, texto branco) — o WhatsApp (`sucesso`) fica **só** na Encomenda, não no
  carrinho. O form do carrinho coleta Nome (≤80) e Contato (≤100) e valida **todos** os campos de
  uma vez (inline em vermelho), depois redireciona ao checkout hospedado do Mercado Pago. As
  **páginas de retorno** (`/pagamento/sucesso|pendente|falha`) são telas centradas com um ícone
  lucide grande (`CheckCircle2`/`sucesso`, `Clock`/`acento`, `XCircle`/`erro`), título Cormorant,
  texto `texto-suave` e CTA primário; nunca afirmam pagamento aprovado por conta dos query params
  (a confirmação é via webhook).

## Sem "glitch" em filtros/busca

- Ao filtrar/buscar, **não** trocar a grade inteira por skeleton (causa pulo/flash). Manter os resultados anteriores visíveis enquanto carrega (TanStack Query `placeholderData: keepPreviousData`).
- Skeleton só no **primeiro** carregamento da página.
- Reservar altura mínima da área de resultados para evitar salto de layout.
- Indicar "atualizando" de forma sutil (ex.: leve opacidade na grade), sem remover o conteúdo.

## Estados (PT-BR)

- Carregando (1ª vez): skeleton suave. Vazio: "Nenhuma peça encontrada." Erro: mensagem amigável + botão "Tentar novamente".

## Tokens para o Tailwind v4 (`@theme` em `index.css`)

```css
@theme {
  --color-fundo: #f7f5f1;
  --color-superficie: #ffffff;
  --color-texto: #1a1816;
  --color-texto-suave: #57534e;
  --color-borda: #d6cfc4;
  --color-acento: #b07a56;
  --color-acento-escuro: #7e4e2e;
  --color-acento-hover: #653a1f;
  --color-esgotado: #8c887f;
  --color-sucesso: #2e6b49;
  --color-erro: #9e3633;

  --font-display: "Cormorant Garamond", Georgia, serif;
  --font-sans: "Inter", system-ui, -apple-system, sans-serif;
}
```

## Painel do admin (`/admin`)

Mesma identidade, porém **mais utilitário**: foco em tabelas e formulários claros, legíveis.

- Reaproveita os mesmos tokens; botões primários em `acento-escuro` (hover `acento-hover`),
  botões secundários com borda `borda`, ação de excluir em `erro` (discreta, com confirmação).
- Layout próprio (`AdminLayout`): cabeçalho sticky com navegação (Resumo, Peças, Estoque,
  Categorias, Cores, Destaques, Encomendas, Vendas) e botão "Sair". O header/carrinho do cliente
  **não** aparece no admin.
- Selos de status (Ativa/Oculta, Esgotado, status de encomenda, status de venda) usando
  `sucesso`/`esgotado`/`erro`/`acento` em versão suave. Encomendas **novas** (`recebido`) ganham
  destaque (selo `acento` + linha com leve tom da cor de acento).
- Foco visível e labels em todos os campos (acessibilidade). Mobile-first também aqui
  (tabelas com rolagem horizontal quando necessário).
- O painel gere catálogo, estoque, **encomendas sob medida** e — desde o pagamento online — uma
  seção **Vendas SÓ LEITURA**: lista os pedidos do checkout (Mercado Pago), sem criar/editar/excluir
  (estorno/cancelamento são feitos no painel do MP).

### Padrões de componente do painel

> Implementação no admin das regras da seção **Padronização** (acima). Em conflito, vale a Padronização.

- **Modal (pop-up):** formulários de **criar e editar** (nova peça, editar peça, nova categoria)
  abrem em **modal** sobre a tela atual — nunca navegam para outra página. Visual: superfície
  branca, borda `borda`, cantos 8px,
  sombra suave, fundo escurecido (`bg-black/40`) atrás. Acessível: foco preso dentro, fecha no
  `Esc` e no clique fora, `role="dialog"` + `aria-modal`, devolve o foco ao fechar. Botão "X" de
  fechar no topo (ícone lucide). Componente único reutilizável (`components/admin/Modal.jsx`).
- **Navegação agrupada (menu do painel):** a barra do admin tem **5 itens de topo** — Resumo (link
  direto), **Catálogo ▾** (Peças/Categorias/Cores/Destaques), Estoque (link direto), **Pedidos ▾**
  (Encomendas/Vendas) e **Configurações ▾** (Funcionários/WhatsApp) — num componente único
  (`components/admin/AdminNav.jsx`). Itens com submenu mostram um `ChevronDown` (lucide). **Desktop:**
  o dropdown abre por **hover + clique + foco do teclado** (nunca só hover); fecha ao tirar o mouse
  (atraso ~150ms), no `Esc` e ao clicar fora; o item de topo fica em estado **ativo** (`acento-escuro`)
  quando a rota atual é uma das filhas. Painel do submenu em `superficie`/`borda`, cantos 8px, sombra
  suave. **Mobile:** sem hover — botão **hambúrguer** abre um menu **sanfona** (accordion) por grupo.
  Acessível: `aria-haspopup="menu"`/`aria-expanded`, `role="menu"`/`menuitem`, navegação por teclado
  (Tab/Enter/Esc/setas), foco visível (anel `acento-escuro`); os itens são **links de verdade**
  (`NavLink`). **Visibilidade por papel** (UI; o backend reforça): Funcionário vê Resumo/Catálogo/
  Estoque/Pedidos (Vendas só com `acesso_financeiro`); Dono vê tudo (inclui Configurações). Grupo sem
  itens para o papel **some** do menu.
- **Tabela ordenável:** qualquer tabela do admin pode ser ordenada por qualquer coluna — clicar no
  cabeçalho alterna asc/desc, com **seta** (ícone lucide) indicando a coluna/direção ativa. A
  ordenação **persiste** ao paginar/recarregar (guardada por tabela em `localStorage`). Cabeçalho
  reutilizável (`CabecalhoOrdenavel`) + hook `useOrdenacao`.
- **Tabela → cartões no mobile:** a transformação é única e reutilizável. A `<table>` recebe a classe
  **`tabela-cartoes`** e cada `<td>` declara seu rótulo via **`data-rotulo="…"`**; células marcadas
  com **`cel-principal`** (título), **`cel-selecao`** (checkbox no canto) e **`cel-acoes`** (botões no
  rodapé). Abaixo de 640px, o CSS em `index.css` empilha tudo em cartões (a lógica mora só no CSS — as
  páginas só anotam os `td`). A ordenação no mobile usa o componente **`OrdenarMobile`** (mesmo
  `useOrdenacao`), e o contêiner da tabela só mostra borda/scroll a partir de `sm:` (640px).
- **Ícones:** sempre **componentes** do `lucide-react` (`Plus`, `Minus`, `Pencil`, `Trash2`, `Eye`,
  `Check`, `X`…), nunca `<img>` de ícone nem SVG colado como imagem. Tamanho ~14–20px, herdam a
  cor do texto. Decorativos com `aria-hidden`; ações só-ícone com `aria-label`.
- **Edição inline (estoque):** ícone de lápis para editar; botões +1/−1 (ícones) ao lado do número
  editável; o valor nunca fica negativo; salvar dá feedback de sucesso/erro; esgotado em destaque.
- **Campos padronizados:** inputs de um mesmo tipo (ex.: nome de categoria) têm a **mesma largura**
  fixa e contida — não esticar com `w-full`/`flex-1` quando o conteúdo é curto.
- **Exclusão sempre com aviso:** nada é excluído sem confirmação. Um componente único
  (`ConfirmarExclusao`) abre um modal que **lista tudo o que será removido, agrupado por item**
  (cada item-pai com seus dependentes em cascata aninhados) e um **total** ao final; a ação é sempre
  marcada como **irreversível**. Quando a exclusão envolve **cascata** (categorias/peças), a
  confirmação é **reforçada** com um **checkbox** "Entendo que esta ação é irreversível" — **não**
  é preciso digitar nada. O botão de confirmar é **sólido em `erro`** (branco), com `Trash2`.
- **Seleção em massa:** tabelas do admin (Peças, Estoque, Categorias, Cores, Encomendas) têm **checkbox por
  linha** + **"selecionar todos"** no cabeçalho (respeita filtro/busca; estado indeterminado quando
  parcial). Com ≥1 selecionado aparece uma **barra de ação** (borda/fundo `erro` suave) com "N
  selecionado(s)", "Excluir selecionados" (vermelho) e "Limpar seleção". A exclusão roda item a item
  com **progresso** ("Excluindo X de N…") e **falha parcial** (lista o que não saiu, sem travar).
  Linhas selecionadas ficam realçadas (`bg-acento/5`).
- **Paleta de cores (variações):** a cor de uma variação NÃO é texto livre — é escolhida numa
  **paleta de cores salvas** (`SeletorCor`): quadradinhos (swatches, cantos 8px, borda `borda`,
  selecionado com anel `acento-escuro` + ✓) que, ao clicar, definem `cor` (nome) e `cor_hex` (hex).
  Um botão **"Nova cor"** abre um picker (`react-colorful`, HEX) + nome → cria a cor (`POST /cores/`)
  e já a seleciona. A seção **Cores** (`/admin/cores`) gerencia a paleta (swatch + nome + hex; criar/
  editar em modal com picker; excluir via `ConfirmarExclusao`). Erros PT-BR do backend (nome
  duplicado / hex fora de `#RRGGBB`) aparecem junto ao campo.
- **Máscara de moeda (preço):** campos de preço usam máscara **BRL** enquanto digita
  (`R$ 1.234,50`, milhar/decimais), com **teto de R$ 1.000.000**; o estado guarda centavos e a API
  recebe um decimal simples (`CampoPreco` + `lib/moeda.js`). Prefixo "R$" embutido, alinhado à direita.
- **Contadores de caracteres:** campos com limite mostram um contador "N/MÁX" (nome 80, descrição
  600) e usam `maxLength` no input.
- **Validação completa (sem erro a conta-gotas):** os formulários de peça validam **TODOS** os campos
  de uma vez (`lib/validarPeca.js` → mapa de erros por campo). Cada campo inválido mostra a mensagem
  **inline em vermelho** logo abaixo dele E há um **resumo** no topo ("Há N campos com problemas…").
  Nunca mostrar um erro de cada vez.
- **Olho = ver, lápis = editar:** o ícone `Eye` abre uma **visualização SÓ LEITURA** (sem inputs;
  `DetalhePecaModal`); a edição fica num ícone `Pencil` separado (`EditarPecaModal`). Não usar o olho
  para abrir o formulário de edição.
- **Seção só-leitura (Vendas):** os pedidos do pagamento online (Mercado Pago) aparecem numa tabela
  **ordenável** (Cliente, Itens, Total, Status, Data) com filtro por status e **modal de detalhe**
  (dados do cliente, total/datas, itens e IDs do MP). É **somente leitura** — sem editar/excluir nem
  seleção em massa; uma **nota** no modal lembra que estorno/cancelamento são no painel do Mercado
  Pago. Selos: `pago`→verde, `aguardando_pagamento`→acento, `expirado`→cinza, `cancelado`→vermelho.
- **Gráficos do painel (Dashboard):** usar `recharts` com a paleta dos tokens (`acento-escuro`
  `#7e4e2e`, `acento` `#b07a56`, `sucesso` `#2e6b49`, `esgotado` `#8c887f`; grade `borda` `#d6cfc4`,
  eixos `texto-suave` `#57534e`). Cartões em `superficie` com borda 8px; "Sem dados ainda." quando
  vazio. **Os números aparecem sem hover**: barras com `LabelList` (valor em cima, cor `texto`
  `#1a1816`); rosca com o **total no centro** + legenda com os valores. **Altura responsiva**
  (`h-56 sm:h-64 lg:h-72`, não fixa) e eixos enxutos no mobile; 1 coluna no celular, 2 no desktop. O
  `Tooltip` é só complemento. Os gráficos são admin-only e **não** entram na pré-renderização (SSG).
- **Cartões de métrica (Dashboard):** cada cartão tem um **ícone lucide** discreto, número em
  destaque e rótulo claro (estado **vermelho/`erro`** para esgotadas/encomendas novas/aguardando).
  São **clicáveis e abrem um `Modal` de detalhe** (lista da métrica com os selos/cores atuais, texto
  longo truncado) calculado dos dados já carregados — **sem trocar de aba**; o modal pode ter, no
  rodapé, um link secundário "Abrir a página completa". 2 colunas no mobile.

## Marca (atualizada — 25/06/2026: Ateliê da Sete)
> **Mudou só a MARCA e as COPYS — o design (paleta terracota, Cormorant/Inter, formatos) permanece igual.**
- **Nome de exibição:** **Ateliê da Sete** (com acento; "Sete" pode aparecer em dourado, como no logo).
- **Assinatura/tagline:** *Roupas & Artigos Religiosos* · Campo Grande/MS, para todo o Brasil.
- **Contexto:** ateliê de roupas e paramentos de **Umbanda e Candomblé**, sob medida. Dona: **Gabrielly Liberato**.
  Voz **firme, com axé**. Regra de ouro da copy: **nunca afirmar cor de Orixá como dogma** → "conforme o
  fundamento da sua casa". **Nunca** usar "fantasia/figurino/macumba", nem tratar Exu como "diabo". Copys em `COPYS_HOME.md`.
- **Logo:** `frontend/public/logo-atelie.png` — lockup horizontal (emblema da estrela de 7 pontas + "Ateliê da Sete"),
  fundo transparente, no header do cliente e do admin.
- **Favicon:** `frontend/public/favicon.png` (+ `apple-touch-icon.png`) — o **emblema** (estrela + agulha) em fundo azul-marinho.
- **Imagem de apresentação:** `frontend/public/apresentacao-atelie.jpg` — a marca (versão escura) no bloco da home.
- Obs.: o logo é **azul-marinho + dourado** e o site segue **terracota** (decisão do dono: manter o design). Convivem; revisitar a paleta só se o dono pedir.

## Home (landing em `/`)
- Página de apresentação com **8 seções** (Hero, **Alguns trabalhos**, **Sobre/manifesto**,
  **O que costuramos**, **Diferenciais**, Depoimentos, FAQ, CTA final), mesma identidade (terracota,
  Cormorant/Inter, cantos 8px, cartões em `superficie` com borda). Uma única `<h1>` (Hero); cada
  seção usa `<h2>`. As copys (Umbanda + Candomblé) saem de `COPYS_HOME.md`.
- CTAs primários em `acento-escuro` (Me conta o fundamento da sua casa / Falar no WhatsApp);
  secundários com borda (Ver os trabalhos). O WhatsApp usa o número de `site.js`/env.
- Catálogo (os trabalhos) fica em `/vitrine`. Textos e dados (cidade, WhatsApp, FAQ, depoimentos) vêm
  de `frontend/src/config/site.js` (placeholders do dono num lugar só: WhatsApp, Instagram, depoimentos).
- SEO: rotas públicas pré-renderizadas (SSG), com `<head>`/JSON-LD (ClothingStore + FAQPage) por rota;
  `/admin` fora do índice.

## Histórico
- 25/06/2026 — **Promoções e cupons**: preço **riscado + promocional** + selo "Promoção" na
  vitrine/detalhe (promoção automática); campo de **cupom** no carrinho (desconto/total ao aplicar,
  reconfirmado no servidor); seção **Promoções** no admin (grupo Pedidos, só Dono/`acesso_financeiro`)
  com tabela paginada/ordenável e modal de criar/editar. Descontos sempre calculados no servidor. O
  form de promoção segue a Padronização: **valor em R$ com máscara BRL (`CampoPreco`)** e em % com
  sufixo "%"/teto 100; escopo por **peça(s)/categoria(s)** com seletor de **busca + múltipla seleção**
  (lista com rolagem + "Selecionar todas"/"Limpar"); **prévia** do preço com desconto (rola com +10
  peças); datas com hora (`datetime-local`, `min` = agora, sem passado, fim ≥ início) e dica
  legível; **limite de usos até 10 dígitos**.
- 25/06/2026 — **Rebrand para "Ateliê da Sete" (Roupas & Artigos Religiosos, Umbanda + Candomblé)**:
  trocados nome/tagline/contexto e todas as copys da Home (Hero, Alguns trabalhos, manifesto, O que
  costuramos, Diferenciais, Depoimentos, FAQ, CTA) conforme `COPYS_HOME.md`; SEO/JSON-LD atualizados.
  **Só copy/marca — o design (paleta, fontes, componentes, layout) permanece idêntico.**
- 19/06/2026 — Criação do guia (acento terracota + Cormorant/Inter).
- 19/06/2026 — Revisão de contraste e regras de destaque/hover/carrinho; fim do glitch de filtros. Unificado `ESTILO.md` + `STYLE.md` neste arquivo.
- 20/06/2026 — Diretrizes do painel do admin (utilitário, mesma identidade; selos, layout próprio, acessibilidade).
- 20/06/2026 — Padrões de componente do painel: modal acessível para formulários "novo", tabelas ordenáveis com ordenação persistente, ícones via `lucide-react`, edição inline de estoque, campos de largura padronizada.
- 20/06/2026 — Nova Home (landing em `/`) com 8 seções + catálogo movido para `/vitrine`; placeholders centralizados em `config/site.js`; SEO com pré-renderização (SSG) das rotas públicas.
- 20/06/2026 — Marca aplicada: logo (`logo-atelie.png`) como favicon e no header do cliente e do admin; bloco de apresentação na home (`apresentacao-atelie.jpg`) com "Ateliê ++ / Costura sob medida". Cards de peça ganharam borda de destaque. Assets reais ficam em `frontend/public/` (o dono adiciona).
- 21/06/2026 — Padrão de **exclusão com aviso** (componente `ConfirmarExclusao`: lista agrupada do que será removido + total + confirmação reforçada em cascata) e **seleção em massa** nas tabelas do admin (checkbox por linha + "todos", barra de ação, progresso e falha parcial).
- 21/06/2026 — Entradas do **cliente** (formulários públicos): **chips de tamanho** (seleção única + "+ Outro"), **sufixo "cm" fixo + stepper +/−** nas medidas, **máscara de telefone** `(67) 99999-9999`, **auto-capitalização** do nome, **contadores de caracteres** (nome 80 / descrição 600 / observação 300 / busca 60, espelhando o backend) e **validação completa** na encomenda (todos os erros de uma vez, inline + resumo).
- 21/06/2026 — **Pagamento online** no cliente: o carrinho finaliza com **"Finalizar compra"**
  (botão primário `acento-escuro`, não mais WhatsApp — o `sucesso` do WhatsApp fica só na
  Encomenda) → checkout do Mercado Pago. Três telas de **retorno** (`/pagamento/sucesso|pendente|
  falha`) centradas, com ícone lucide grande + CTA primário; não afirmam aprovação por query param
  (confirmação = webhook). Catálogo usa `disponivel` (estoque real) para "Esgotado" e limites.
- 21/06/2026 — Padrões novos do painel: **paleta de cores** para variações (`SeletorCor` + seção `/admin/cores`, picker `react-colorful`, persiste `cor`+`cor_hex`); **máscara de moeda BRL** com teto R$ 1.000.000 (`CampoPreco`); **contadores de caracteres** (nome 80 / descrição 600); **validação completa** (todos os erros de uma vez, inline + resumo); **olho = só leitura** vs **lápis = editar**; **gráficos do Dashboard** (`recharts`) com a paleta dos tokens (admin-only, fora do SSG).
- 22/06/2026 — Seção **Vendas** (`/admin/vendas`) só-leitura: tabela ordenável dos pedidos do pagamento online (Mercado Pago) com filtro por status e modal de detalhe (cliente, total/datas, itens, IDs do MP). Sem editar/excluir; nota de que estorno/cancelamento são no painel do MP. Selos `pago`→verde / `aguardando_pagamento`→acento / `expirado`→cinza / `cancelado`→vermelho. Dois cartões de venda no Dashboard. Atualizada a regra antiga "sem telas de venda" do painel.
- 22/06/2026 — Adicionada a seção **Padronização** (regras-padrão do sistema): Tabelas, Campos, Formulários, Ações destrutivas, Visualizar×editar, Feedback/estados e Erros, mais princípios transversais (menos cliques, reuso de componentes/ícones lucide, formatos BR). A seção "Padrões de componente do painel" passou a ser a implementação dela. (Regras de engenharia — validação no servidor e segredos/dados sensíveis — ficam no `CLAUDE.md`.)
- 25/06/2026 — **Paginação (10/página) em todas as tabelas do admin** via `usePaginacao` +
  `Paginacao` (cliente fatia a lista já filtrada/ordenada; volta à página 1 ao mudar filtro;
  "selecionar todos" = página atual). Registrada a regra "toda tabela do admin pagina em 10".
  Depois estendida aos **detalhes do Resumo** (listas dos modais de métrica, 10/página) e à
  **vitrine pública** (paginação **server-side**, 20/página, mesmo componente `Paginacao`).
- 25/06/2026 — **Resumo (Dashboard)** reorganizado: "Pergunte ao painel" no topo (destaque); cartões
  de métrica com ícone lucide e **detalhe em modal** (sem trocar de aba); gráficos com **rótulos de
  valor** (LabelList / total no centro da rosca) e **altura responsiva** no mobile. Registrado o
  padrão "cartões de métrica abrem detalhe em modal" e "gráficos com valores visíveis".
- 25/06/2026 — **Conta de cliente com login**: cadastro/login viram **páginas públicas** (não modal),
  CPF obrigatório (máscara + validação), perfil com e-mail/CPF read-only, e o **checkout passa a exigir
  conta** (usa os dados da conta + CPF no Mercado Pago). Sessão do cliente separada da do admin.
- 25/06/2026 — **Tabelas responsivas do admin**: abaixo de 640px cada linha vira um **cartão**
  (rótulo: valor; título = campo principal; ações em botões; checkbox no canto). Transformação única
  via classe `tabela-cartoes` + `data-rotulo`/`cel-principal`/`cel-selecao`/`cel-acoes` (CSS em
  `index.css`) e controle **`OrdenarMobile`** (reusa `useOrdenacao`). Desktop intacto; rolagem
  horizontal deixou de ser o padrão (só a partir de `sm:`). Aplicado às 8 tabelas do painel.
- 25/06/2026 — **Navegação agrupada do painel**: 5 itens de topo (Resumo, Catálogo ▾, Estoque,
  Pedidos ▾, Configurações ▾) num `AdminNav` único — dropdown por hover+clique+teclado no desktop
  (fecha com atraso ~150ms / Esc / clique fora; topo ativo destacado) e sanfona no hambúrguer no
  mobile; visibilidade por papel; acessível (`aria-haspopup`/`expanded`, `role=menu/menuitem`,
  teclado, foco visível). Só navegação — rotas/telas/permissões intactas.
- 24/06/2026 — **Auditoria de conformidade** das telas (admin + cliente) à Padronização. Desvios
  corrigidos: removidos TODOS os resíduos de `window.confirm` (variação/imagem na edição de peça e
  encomenda no modal passaram a usar `ConfirmarExclusao`; **trocar WhatsApp do dono** e **desconectar
  o WhatsApp** passaram a usar um **modal de confirmação genérico** reutilizando `Modal` — padrão
  novo para confirmações que **não** são exclusão); placeholders de exemplo agora em **itálico + cor
  mais suave** (`placeholder:italic placeholder:text-texto-suave/70`, no `inputClasse` do admin e nos
  inputs do cliente) e no formato "Ex.: …"; **truncamento + tooltip** (`title`) nas células de
  Cliente em Encomendas/Vendas e Peça em Peças; rótulos do painel de WhatsApp sem jargão ("Evolution"
  → "serviço"); telas de retorno do pagamento não afirmam aprovação por query param ("Pagamento
  aprovado!" → "Pedido recebido!", confirmação é via webhook). O restante das telas já estava conforme.
