import { useCallback, useState } from "react";

// Seleção de linhas (por id) para ações em massa nas tabelas do admin.
// Guarda os ids num Set; a página decide quais ids são "visíveis" (filtro/busca).
export function useSelecao() {
  const [ids, setIds] = useState(() => new Set());

  const alternar = useCallback((id) => {
    setIds((prev) => {
      const novo = new Set(prev);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }, []);

  // Marca/desmarca uma lista de ids de uma vez (ex.: "selecionar todos" do filtro).
  const definirVarios = useCallback((lista, marcar) => {
    setIds((prev) => {
      const novo = new Set(prev);
      lista.forEach((id) => (marcar ? novo.add(id) : novo.delete(id)));
      return novo;
    });
  }, []);

  const limpar = useCallback(() => setIds(new Set()), []);

  const estaSelecionado = useCallback((id) => ids.has(id), [ids]);

  return { ids, alternar, definirVarios, limpar, estaSelecionado, quantidade: ids.size };
}
