import { useQuery } from "@tanstack/react-query";
import { listarCategorias } from "../lib/api";

// Lista de categorias. A resposta pode vir paginada ({results}) ou como array.
export function useCategorias() {
  return useQuery({
    queryKey: ["categorias"],
    queryFn: listarCategorias,
    select: (data) => (Array.isArray(data) ? data : data.results ?? []),
  });
}
