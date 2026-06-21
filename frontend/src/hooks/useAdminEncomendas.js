import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { listarTodasEncomendas } from "../lib/api";

// Lista TODAS as encomendas (admin), percorrendo a paginação, com filtros opcionais.
export function useAdminEncomendas(filtros = {}) {
  return useQuery({
    queryKey: ["admin", "encomendas", filtros],
    queryFn: () => listarTodasEncomendas(filtros),
    placeholderData: keepPreviousData,
  });
}
