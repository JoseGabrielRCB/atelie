import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { listarTodosPedidos } from "../lib/api";

// Lista TODOS os pedidos/vendas (admin), percorrendo a paginação, com filtros
// opcionais. Somente leitura (criação é pelo checkout público; confirmação via
// webhook do Mercado Pago).
export function useAdminPedidos(filtros = {}, opcoes = {}) {
  return useQuery({
    queryKey: ["admin", "pedidos", filtros],
    queryFn: () => listarTodosPedidos(filtros),
    placeholderData: keepPreviousData,
    // Permite desligar a busca (ex.: funcionário sem acesso ao financeiro, que
    // receberia 403 em /pedidos/). Vendas é gerida pela guarda de rota no back.
    ...opcoes,
  });
}
