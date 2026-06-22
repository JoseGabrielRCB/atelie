import { useQuery } from "@tanstack/react-query";
import { listarCores } from "../lib/api";

// Paleta de cores salvas (compartilhada entre o seletor de variação e a tela
// de Cores). `listarCores` já devolve um array (percorre a paginação).
export function useCores() {
  return useQuery({
    queryKey: ["cores"],
    queryFn: listarCores,
  });
}
