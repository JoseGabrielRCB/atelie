import { ChevronLeft, ChevronRight } from "lucide-react";

// Controles de paginação reutilizáveis (Anterior/Próxima + "Página X de Y" +
// total). Funciona igual no desktop (tabela) e no mobile (cartões), pois só
// muda a fatia renderizada. Acessível (nav rotulada, aria-live no resumo).
//
// Props: vêm do hook `usePaginacao` — `pagina`, `totalPaginas`, `total`,
// `porPagina`, `aoMudar(novaPagina)`. `rotuloItens` para o texto ("peças"…).
export function Paginacao({ pagina, totalPaginas, total, porPagina, aoMudar, rotuloItens = "itens" }) {
  if (total === 0) return null;
  const inicio = (pagina - 1) * porPagina + 1;
  const fim = Math.min(total, pagina * porPagina);

  const botao =
    "inline-flex items-center gap-1 rounded-lg border border-borda bg-superficie px-3 py-1.5 text-sm text-texto transition hover:border-acento-escuro focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acento-escuro disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <nav
      aria-label="Paginação"
      className="mt-4 flex flex-col items-center justify-between gap-3 sm:flex-row"
    >
      <p className="text-sm text-texto-suave" aria-live="polite">
        {inicio}–{fim} de {total} {rotuloItens}
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => aoMudar(pagina - 1)}
          disabled={pagina <= 1}
          aria-label="Página anterior"
          className={botao}
        >
          <ChevronLeft size={16} aria-hidden="true" />
          Anterior
        </button>
        <span className="px-1 text-sm text-texto">
          Página {pagina} de {totalPaginas}
        </span>
        <button
          type="button"
          onClick={() => aoMudar(pagina + 1)}
          disabled={pagina >= totalPaginas}
          aria-label="Próxima página"
          className={botao}
        >
          Próxima
          <ChevronRight size={16} aria-hidden="true" />
        </button>
      </div>
    </nav>
  );
}
