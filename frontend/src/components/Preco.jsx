// Formata um valor "199.90" (string da API) como "R$ 199,90".
const formatador = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export default function Preco({ valor, className = "" }) {
  const numero = Number(valor);
  const texto = Number.isFinite(numero) ? formatador.format(numero) : "—";
  return <span className={className}>{texto}</span>;
}
