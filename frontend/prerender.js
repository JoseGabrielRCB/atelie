// Pré-renderização (SSG) — roda após `vite build` (cliente) e o build SSR.
// Para cada rota pública: renderiza o HTML, injeta <head> (title/description/
// canonical/OG) + JSON-LD e grava dist/<rota>/index.html. Gera sitemap + robots.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, "dist");

const {
  render,
  ROTAS_SSG,
  getMeta,
  buildHead,
  jsonLdLocalBusiness,
  jsonLdFaqPage,
  SITE,
} = await import("./dist-server/entry-server.js");

const template = fs.readFileSync(path.join(distDir, "index.html"), "utf-8");

for (const url of ROTAS_SSG) {
  const appHtml = render(url);
  const jsonLd = url === "/" ? [jsonLdLocalBusiness(), jsonLdFaqPage()] : [];
  const head = buildHead(getMeta(url), jsonLd);

  const html = template
    .replace(/<title>[\s\S]*?<\/title>/, "")
    .replace("</head>", `    ${head}\n  </head>`)
    .replace('<div id="root"></div>', `<div id="root">${appHtml}</div>`);

  const outDir = url === "/" ? distDir : path.join(distDir, url.replace(/^\//, ""));
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "index.html"), html);
  console.log("✓ pré-renderizado:", url);
}

// sitemap.xml (apenas rotas públicas)
const sitemap =
  `<?xml version="1.0" encoding="UTF-8"?>\n` +
  `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  ROTAS_SSG.map((u) => `  <url><loc>${SITE.dominio}${u}</loc></url>`).join("\n") +
  `\n</urlset>\n`;
fs.writeFileSync(path.join(distDir, "sitemap.xml"), sitemap);

// robots.txt (bloqueia /admin)
const robots =
  `User-agent: *\nAllow: /\nDisallow: /admin\n\n` +
  `Sitemap: ${SITE.dominio}/sitemap.xml\n`;
fs.writeFileSync(path.join(distDir, "robots.txt"), robots);

console.log("✓ sitemap.xml e robots.txt gerados");
