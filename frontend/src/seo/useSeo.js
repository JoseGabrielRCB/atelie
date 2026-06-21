import { useEffect } from "react";

// Atualiza <title> e <meta name="description"> ao navegar no SPA (client-side).
// Na pré-renderização (SSG) o <head> é injetado pelo prerender; aqui é só para
// a navegação interna manter os metadados coerentes.
export function useSeo({ title, description } = {}) {
  useEffect(() => {
    if (title) document.title = title;
    if (description) {
      let tag = document.querySelector('meta[name="description"]');
      if (!tag) {
        tag = document.createElement("meta");
        tag.setAttribute("name", "description");
        document.head.appendChild(tag);
      }
      tag.setAttribute("content", description);
    }
  }, [title, description]);
}

// Injeta/atualiza um <script type="application/ld+json"> com `id` (ex.: Product
// na página de peça). Remove ao desmontar.
export function useJsonLd(id, obj) {
  useEffect(() => {
    if (!obj) return undefined;
    let s = document.getElementById(id);
    if (!s) {
      s = document.createElement("script");
      s.type = "application/ld+json";
      s.id = id;
      document.head.appendChild(s);
    }
    s.textContent = JSON.stringify(obj);
    return () => s.remove();
  }, [id, obj]);
}
