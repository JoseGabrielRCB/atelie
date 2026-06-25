import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { listarPecas } from "../lib/api";

// Lista de peças ativas com filtros opcionais: { categoria, search, ordering, tipo }.
// keepPreviousData mantém os resultados anteriores visíveis enquanto a nova
// consulta (após mudar busca/filtro) carrega — evita o "piscar" da grade.
export function usePecas(filtros = {}) {
  return useQuery({
    queryKey: ["pecas", filtros],
    queryFn: () => listarPecas(filtros),
    select: (data) => data.results ?? [],
    placeholderData: keepPreviousData,
  });
}

// Variante PAGINADA (server-side) para a vitrine: além dos itens da página,
// devolve `total` (count do backend) para montar os controles de paginação.
// Passe `page` nos filtros (a vitrine usa a paginação padrão do backend, 20/pág.).
export function usePecasPaginadas(filtros = {}) {
  return useQuery({
    queryKey: ["pecas", filtros],
    queryFn: () => listarPecas(filtros),
    select: (data) => ({ itens: data.results ?? [], total: data.count ?? 0 }),
    placeholderData: keepPreviousData,
  });
}
