import { useQuery } from "@tanstack/react-query";
import { obterPeca } from "../lib/api";

// Detalhe de uma peça pelo id.
export function usePeca(id) {
  return useQuery({
    queryKey: ["peca", id],
    queryFn: () => obterPeca(id),
    enabled: Boolean(id),
  });
}
