import { useState } from "react";

// Paginação no cliente (10 por página) para as tabelas do admin. Recebe a lista
// JÁ filtrada/ordenada e devolve só a fatia da página atual. Volta à página 1
// quando `resetKey` muda (busca/filtro/ordenação) — ajuste de estado na
// renderização (padrão do React, sem efeito). Se a lista encolher (ex.: exclusão
// em massa), a página é "clampada" automaticamente, sem flash.
export const ITENS_POR_PAGINA = 10;

export function usePaginacao(itens, { porPagina = ITENS_POR_PAGINA, resetKey = "" } = {}) {
  const [pagina, setPagina] = useState(1);
  const [chaveAnterior, setChaveAnterior] = useState(resetKey);

  if (resetKey !== chaveAnterior) {
    setChaveAnterior(resetKey);
    setPagina(1);
  }

  const total = itens.length;
  const totalPaginas = Math.max(1, Math.ceil(total / porPagina));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const inicio = (paginaAtual - 1) * porPagina;
  const itensPagina = itens.slice(inicio, inicio + porPagina);

  return {
    pagina: paginaAtual,
    setPagina,
    totalPaginas,
    total,
    porPagina,
    itensPagina,
  };
}
