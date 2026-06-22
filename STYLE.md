# STYLE.md — Guia de Estilo do Ateliê (fonte única)

> Fonte ÚNICA da identidade visual (substitui qualquer `ESTILO.md`). O frontend
> (React + Tailwind) deve seguir este guia. Atualize aqui antes de mudar o visual.

## Princípios

- **Clean e minimalista.** Fundo claro, espaço em branco, foco nas fotos das peças.
- **A roupa é a estrela.** A interface é neutra; a cor vem das fotos.
- **Mas legível e com destaque claro.** Minimalismo não é falta de contraste: texto tem que ler fácil e as ações (carrinho, comprar) têm que saltar aos olhos.
- **Mobile-first.** Primeiro o celular, depois o desktop.

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
- **Seletor de tamanho/cor:** chips; selecionado em `acento-escuro` com texto branco; indisponível apagado (`esgotado`) e riscado.

## Entradas do cliente (formulários públicos)

Os formulários do cliente (encomenda, carrinho, busca) seguem o mesmo princípio do painel
(entradas restritas, menos cliques), com a identidade do cliente (cantos 8px, `acento-escuro`).

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
  Categorias, Encomendas) e botão "Sair". O header/carrinho do cliente **não** aparece no admin.
- Selos de status (Ativa/Oculta, Esgotado, status de encomenda) usando `sucesso`/`esgotado`/`erro`/
  `acento` em versão suave. Encomendas **novas** (`recebido`) ganham destaque (selo `acento` +
  linha com leve tom da cor de acento).
- Foco visível e labels em todos os campos (acessibilidade). Mobile-first também aqui
  (tabelas com rolagem horizontal quando necessário).
- Continua **sem** telas de venda/pedido/financeiro — o painel é só catálogo, estoque e
  **encomendas sob medida** (pedidos do cliente com imagens; o ateliê dá retorno por fora).

### Padrões de componente do painel

- **Modal (pop-up):** formulários de **criar e editar** (nova peça, editar peça, nova categoria)
  abrem em **modal** sobre a tela atual — nunca navegam para outra página. Visual: superfície
  branca, borda `borda`, cantos 8px,
  sombra suave, fundo escurecido (`bg-black/40`) atrás. Acessível: foco preso dentro, fecha no
  `Esc` e no clique fora, `role="dialog"` + `aria-modal`, devolve o foco ao fechar. Botão "X" de
  fechar no topo (ícone lucide). Componente único reutilizável (`components/admin/Modal.jsx`).
- **Tabela ordenável:** qualquer tabela do admin pode ser ordenada por qualquer coluna — clicar no
  cabeçalho alterna asc/desc, com **seta** (ícone lucide) indicando a coluna/direção ativa. A
  ordenação **persiste** ao paginar/recarregar (guardada por tabela em `localStorage`). Cabeçalho
  reutilizável (`CabecalhoOrdenavel`) + hook `useOrdenacao`.
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
  confirmação é **reforçada**: digitar o nome do item (exclusão única) ou a palavra `EXCLUIR`
  (em massa). O botão de confirmar é **sólido em `erro`** (branco), com `Trash2`.
- **Seleção em massa:** tabelas do admin (Peças, Estoque, Categorias, Encomendas) têm **checkbox por
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
- **Gráficos do painel (Dashboard):** usar `recharts` com a paleta dos tokens (`acento-escuro`
  `#7e4e2e`, `acento` `#b07a56`, `sucesso` `#2e6b49`, `esgotado` `#8c887f`; grade `borda` `#d6cfc4`,
  eixos `texto-suave` `#57534e`). Cartões em `superficie` com borda 8px; "Sem dados ainda." quando
  vazio. Os gráficos são admin-only e **não** entram na pré-renderização (SSG só processa rotas
  públicas), então a dependência não quebra o build Node.

## Marca (definida — 20/06/2026)
- **Nome de exibição:** **Atelie ++** (grafia **sem acento**, igual ao logo — padroniza a marca e
  evita o glitch do circunflexo "ê" na fonte Cormorant Garamond). Vale para todo texto visível
  (hero da home, `<title>`, login do admin, `alt`/`aria-label`).
- **Assinatura/tagline:** *Costura sob medida*
- **Logo:** `frontend/public/logo-atelie.png` — usado no topo do site (header) e como favicon (aba do navegador, substitui o ícone padrão do Vite).
- **Imagem de apresentação:** `frontend/public/apresentacao-atelie.jpg` — bloco de apresentação do ateliê na home.
- Obs.: o ideal é o logo em PNG com **fundo transparente** para casar com o fundo claro; se vier com fundo branco, aparece uma caixa branca no header.

## Home (landing em `/`)
- Página de apresentação com **8 seções** (Hero, Peças em destaque, Sobre, O que oferecemos, Como
  funciona, Depoimentos, FAQ, CTA final), mesma identidade (terracota, Cormorant/Inter, cantos 8px,
  cartões em `superficie` com borda). Uma única `<h1>` (Hero); cada seção usa `<h2>`.
- CTAs primários em `acento-escuro` (Ver a vitrine / Falar no WhatsApp); secundários com borda.
- Catálogo fica em `/vitrine`. Textos e dados (cidade, WhatsApp, FAQ, depoimentos) vêm de
  `frontend/src/config/site.js` (placeholders do dono num lugar só).
- SEO: rotas públicas pré-renderizadas (SSG), com `<head>`/JSON-LD por rota; `/admin` fora do índice.

## Histórico
- 19/06/2026 — Criação do guia (acento terracota + Cormorant/Inter).
- 19/06/2026 — Revisão de contraste e regras de destaque/hover/carrinho; fim do glitch de filtros. Unificado `ESTILO.md` + `STYLE.md` neste arquivo.
- 20/06/2026 — Diretrizes do painel do admin (utilitário, mesma identidade; selos, layout próprio, acessibilidade).
- 20/06/2026 — Padrões de componente do painel: modal acessível para formulários "novo", tabelas ordenáveis com ordenação persistente, ícones via `lucide-react`, edição inline de estoque, campos de largura padronizada.
- 20/06/2026 — Nova Home (landing em `/`) com 8 seções + catálogo movido para `/vitrine`; placeholders centralizados em `config/site.js`; SEO com pré-renderização (SSG) das rotas públicas.
- 20/06/2026 — Marca aplicada: logo (`logo-atelie.png`) como favicon e no header do cliente e do admin; bloco de apresentação na home (`apresentacao-atelie.jpg`) com "Ateliê ++ / Costura sob medida". Cards de peça ganharam borda de destaque. Assets reais ficam em `frontend/public/` (o dono adiciona).
- 21/06/2026 — Padrão de **exclusão com aviso** (componente `ConfirmarExclusao`: lista agrupada do que será removido + total + confirmação reforçada em cascata) e **seleção em massa** nas tabelas do admin (checkbox por linha + "todos", barra de ação, progresso e falha parcial).
- 21/06/2026 — Entradas do **cliente** (formulários públicos): **chips de tamanho** (seleção única + "+ Outro"), **sufixo "cm" fixo + stepper +/−** nas medidas, **máscara de telefone** `(67) 99999-9999`, **auto-capitalização** do nome, **contadores de caracteres** (nome 80 / descrição 600 / observação 300 / busca 60, espelhando o backend) e **validação completa** na encomenda (todos os erros de uma vez, inline + resumo).
- 21/06/2026 — Padrões novos do painel: **paleta de cores** para variações (`SeletorCor` + seção `/admin/cores`, picker `react-colorful`, persiste `cor`+`cor_hex`); **máscara de moeda BRL** com teto R$ 1.000.000 (`CampoPreco`); **contadores de caracteres** (nome 80 / descrição 600); **validação completa** (todos os erros de uma vez, inline + resumo); **olho = só leitura** vs **lápis = editar**; **gráficos do Dashboard** (`recharts`) com a paleta dos tokens (admin-only, fora do SSG).
