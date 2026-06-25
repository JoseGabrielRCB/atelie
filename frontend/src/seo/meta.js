// Metadados de SEO por rota + builders de JSON-LD. Fonte única usada tanto no
// cliente (useSeo) quanto na pré-renderização (prerender.js via entry-server).
import { SITE, FAQ } from "../config/site";

const DOMINIO = SITE.dominio; // placeholder [DOMINIO] até o deploy
const OG_IMAGE_PATH = "/apresentacao-atelie.jpg";

// Rotas públicas que recebem HTML pré-renderizado (NUNCA /admin).
export const ROTAS_SSG = ["/", "/vitrine", "/encomenda"];

const PADRAO = {
  title: "Ateliê da Sete | Roupas de Umbanda e Candomblé - Campo Grande",
  description:
    "Roupas e paramentos de Umbanda e Candomblé, sob medida e conforme o fundamento da sua casa. De Campo Grande/MS para todo o Brasil. Fale no WhatsApp.",
};

const META = {
  "/": { ...PADRAO, canonical: "/" },
  "/vitrine": {
    title: "Os trabalhos | Ateliê da Sete — roupas e paramentos de terreiro",
    description:
      "Conheça os trabalhos do Ateliê da Sete: roupa branca de corrente, paramentos de guias e Orixás. Sob medida, conforme o fundamento da sua casa.",
    canonical: "/vitrine",
  },
  "/encomenda": {
    title: "Encomenda sob medida | Ateliê da Sete — Campo Grande/MS",
    description:
      "Encomende a sua roupa de trabalho ou paramento conforme o fundamento da sua casa: descreva o guia e a casa, envie referências e medidas. Combinamos pelo WhatsApp.",
    canonical: "/encomenda",
  },
};

export function getMeta(pathname) {
  return META[pathname] ?? { ...PADRAO, canonical: pathname };
}

function abs(caminho) {
  return `${DOMINIO}${caminho}`;
}

export function jsonLdLocalBusiness() {
  return {
    "@context": "https://schema.org",
    "@type": "ClothingStore",
    name: SITE.nome,
    description:
      "Roupas e paramentos de Umbanda e Candomblé, sob medida, conforme o fundamento de cada casa. Campo Grande/MS, para todo o Brasil.",
    image: abs(OG_IMAGE_PATH),
    areaServed: ["Campo Grande - MS", "Brasil"],
    address: {
      "@type": "PostalAddress",
      addressLocality: "Campo Grande",
      addressRegion: "MS",
      addressCountry: "BR",
    },
    telephone: SITE.whatsapp ? `+${SITE.whatsapp}` : "[+55 67 NÚMERO]",
    url: abs("/"),
    sameAs: [
      `https://instagram.com/${String(SITE.instagram).replace(/^@/, "")}`,
    ],
  };
}

export function jsonLdFaqPage() {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ.map((f) => ({
      "@type": "Question",
      name: f.pergunta,
      acceptedAnswer: { "@type": "Answer", text: f.resposta },
    })),
  };
}

function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function tagJsonLd(obj) {
  // < evita fechar o <script> caso o conteúdo tenha "<".
  return `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, "\\u003c")}</script>`;
}

// Monta as tags de <head> de uma rota (string), usada na pré-renderização.
export function buildHead(meta, jsonLdList = []) {
  const canonical = abs(meta.canonical || "/");
  const ogImg = abs(OG_IMAGE_PATH);
  return [
    `<title>${esc(meta.title)}</title>`,
    `<meta name="description" content="${esc(meta.description)}" />`,
    `<link rel="canonical" href="${esc(canonical)}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:title" content="${esc(meta.title)}" />`,
    `<meta property="og:description" content="${esc(meta.description)}" />`,
    `<meta property="og:image" content="${esc(ogImg)}" />`,
    `<meta property="og:url" content="${esc(canonical)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${esc(meta.title)}" />`,
    `<meta name="twitter:description" content="${esc(meta.description)}" />`,
    `<meta name="twitter:image" content="${esc(ogImg)}" />`,
    ...jsonLdList.map(tagJsonLd),
  ].join("\n    ");
}
