import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { listarTodasPecas } from "../lib/api";

// Lista TODAS as peças (inclusive inativas) para o admin, com filtros opcionais.
// Percorre a paginação e usa o token (auth) para enxergar peças ocultas.
export function useAdminPecas(filtros = {}) {
  return useQuery({
    queryKey: ["admin", "pecas", filtros],
    queryFn: () => listarTodasPecas(filtros, { auth: true }),
    placeholderData: keepPreviousData,
  });
}
