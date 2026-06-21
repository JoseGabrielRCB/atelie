# Estrutura da nova Home + Plano de SEO — Ateliê ++

Blueprint da página principal (landing) do site. Base para as copys e para o prompt de implementação.

## Mudança de rotas

- `/` → **nova Home** (landing de apresentação). É a página principal.
- `/vitrine` → catálogo completo (a antiga home / vitrine atual move para cá).
- Mantém: `/peca/:id`, `/carrinho`, `/encomenda`, `/admin/*`.
- Atualizar o menu/header para refletir: Home · Vitrine · Encomenda (+ botão Meu pedido).

## Plano técnico de SEO (decisão: SSG / pré-renderização)

- **Pré-renderizar (SSG)** as páginas públicas (Home, Vitrine, Sobre/Encomenda) com o suporte de
  **pré-render do React Router v7** → HTML pronto para os crawlers (inclusive os de IA, que não rodam JS).
  Admin (`/admin/*`) continua só CSR (não precisa de SEO).
- **Title + meta description únicos por página** (gerenciar via `<head>` por rota).
- **Dados estruturados JSON-LD:**
  - `LocalBusiness` (ou `ClothingStore`): nome "Ateliê ++", área atendida **Campo Grande – MS**, telefone/WhatsApp, horário (a definir), redes sociais.
  - `Product` para peças do catálogo (nome, imagem, preço em BRL, disponibilidade).
  - `BreadcrumbList` nas páginas internas.
- **Open Graph + Twitter Card** (og:title, og:description, og:image = logo/foto de apresentação).
- **sitemap.xml** + **robots.txt** (gerados no build) e **canonical** por página.
- **HTML semântico** (`header/main/section/article`, hierarquia `h1>h2>h3`), `alt` em todas as imagens, `loading="lazy"`.
- **Core Web Vitals / Lighthouse**: imagens otimizadas, fontes com `display=swap` (já), pouco JS.
- `lang="pt-BR"` (já), URLs limpas (sem hash — já usa browser router).

## Palavras-chave alvo (para títulos, headings e copy)

- Primárias: "ateliê de costura Campo Grande", "costura sob medida Campo Grande MS", "roupas sob medida Campo Grande".
- Secundárias: "ateliê de roupas", "peças sob medida", "conserto e ajuste de roupas" (se aplicável), "Atelie ++".
- Long-tail: "vestido sob medida Campo Grande", "encomenda de roupa personalizada MS".

## Seções da Home (ordem + conteúdo + SEO)

### 1. Hero  *(contém o `<h1>`)*
- `<h1>` com a proposta + palavra-chave (ex.: "Ateliê ++ — costura sob medida em Campo Grande").
- Subtítulo curto (proposta de valor), 2 CTAs: **Ver a vitrine** (primário) e **Fazer uma encomenda** (secundário).
- Imagem/identidade (logo/foto). `og:image` daqui.

### 2. Peças em destaque
- O **admin escolhe** quais peças aparecem em destaque na home (curadoria manual, não automático).
- **Requer mudança no backend:** novo campo `destaque` (booleano, default False) no modelo `Peca`
  (+ migration); expor na API e permitir filtro `?destaque=true`. A Home busca as peças com
  `destaque=true` (limite ~4–8); se não houver nenhuma marcada, cai para as mais recentes.
- **No painel admin:** um jeito rápido de marcar/desmarcar "Destaque" (ex.: toggle na lista de peças
  e/ou checkbox no formulário da peça), do mesmo modo que hoje se ativa/oculta na vitrine.
- Cada card = `Product` (JSON-LD). Botão "Ver vitrine completa" → `/vitrine`.

### 3. Sobre o ateliê
- `<h2>` "Sobre o Ateliê ++". Texto de história/proposta + **foto de apresentação**.
- Reforça localização (Campo Grande – MS) de forma natural no texto (SEO local).

### 4. O que oferecemos
- `<h2>` + dois blocos: **Peças prontas** (estoque, compra pelo WhatsApp) e **Sob medida** (encomenda).
- Cada bloco com CTA (Ver vitrine / Fazer encomenda).

### 5. Como funciona
- `<h2>` + passo a passo curto (3–4 passos): escolher a peça → enviar pelo WhatsApp / preencher encomenda → o ateliê responde → produção/entrega.

### 6. Depoimentos / prova social
- `<h2>` + cards de avaliações de clientes. *(precisa de depoimentos reais — usar placeholders marcados até o dono fornecer.)*
- Opcional: `Review`/`AggregateRating` no JSON-LD quando houver avaliações reais.

### 7. FAQ — Perguntas frequentes  *(forte para AEO / busca por IA)*
- `<h2>` + 5–6 perguntas reais com **respostas diretas e curtas** (o que a IA consegue extrair e citar).
- Marcar com **`FAQPage` (JSON-LD)** para aparecer em rich results / AI Overviews.

### 8. CTA final + Contato / rodapé
- Chamada final ("Pronta para sua próxima peça?") + WhatsApp.
- Rodapé com **NAP** (Nome, Área/Endereço: Campo Grande – MS, Telefone/WhatsApp), redes sociais, links (Home, Vitrine, Encomenda).

## Pendências de conteúdo (do dono)
- Telefone/WhatsApp público e horário de atendimento.
- Depoimentos reais (nome + texto).
- Endereço exato ou "atende em Campo Grande – MS / por encomenda" (definir o que exibir).
- Redes sociais (Instagram?).

## Próximo passo
Escrever as **copys** (todos os textos prontos de cada seção, em PT-BR, com SEO) e o **prompt** de implementação para o Claude Code (estrutura + SSG + metadados + JSON-LD).
