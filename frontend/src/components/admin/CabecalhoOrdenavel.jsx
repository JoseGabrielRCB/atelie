import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";

// Cabeçalho de tabela clicável que controla a ordenação.
// Use com o hook useOrdenacao: passe `ordenacao` e `aoOrdenar={alternar}`.
export function CabecalhoOrdenavel({
  coluna,
  rotulo,
  ordenacao,
  aoOrdenar,
  alinhar = "left",
  className = "",
}) {
  const ativo = ordenacao.coluna === coluna;
  const Icone = !ativo
    ? ChevronsUpDown
    : ordenacao.direcao === "asc"
    ? ChevronUp
    : ChevronDown;

  return (
    <th
      className={`px-4 py-3 font-medium ${className}`}
      aria-sort={
        ativo ? (ordenacao.direcao === "asc" ? "ascending" : "descending") : "none"
      }
    >
      <button
        type="button"
        onClick={() => aoOrdenar(coluna)}
        className={
          "inline-flex items-center gap-1 rounded transition hover:text-acento-escuro focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acento-escuro " +
          (alinhar === "right" ? "flex-row-reverse" : "")
        }
        aria-label={`Ordenar por ${rotulo}`}
      >
        <span>{rotulo}</span>
        <Icone
          size={14}
          aria-hidden="true"
          className={ativo ? "text-acento-escuro" : "text-texto-suave/50"}
        />
      </button>
    </th>
  );
}
