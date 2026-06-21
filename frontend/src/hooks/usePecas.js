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
