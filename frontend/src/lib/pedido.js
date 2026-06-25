// Código de compra legível (ex.: PED-000042), derivado do id do pedido.
// Espelha o `Pedido.codigo` do backend para as telas que só têm o id (retornos
// de pagamento, que recebem o external_reference na URL).
export function codigoPedido(id) {
  const n = Number(id);
  if (!id || Number.isNaN(n)) return "";
  return `PED-${String(n).padStart(6, "0")}`;
}
