import { ChevronUp, ChevronDown, ChevronsUpDown, ArrowDownAZ, ArrowUpAZ } from "lucide-react";
import { inputClasse } from "./ui";

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

// Controle de ordenação para o MOBILE (onde a tabela vira cartões e não há
// cabeçalho clicável). Reaproveita o mesmo estado do `useOrdenacao` — a
// ordenação persiste igual ao desktop. Só aparece abaixo de ~640px (md:hidden).
//
// Props: `colunas` = [{ coluna, rotulo }] (as ordenáveis); `ordenacao` e
// `aoOrdenar` vêm do `useOrdenacao` (mesmos do `CabecalhoOrdenavel`).
export function OrdenarMobile({ colunas, ordenacao, aoOrdenar, id = "ordenar-mobile", className = "" }) {
  const asc = ordenacao.direcao === "asc";
  return (
    <div className={"flex items-center gap-2 sm:hidden " + className}>
      <label htmlFor={id} className="shrink-0 text-sm text-texto-suave">
        Ordenar por
      </label>
      <select
        id={id}
        value={ordenacao.coluna ?? ""}
        onChange={(e) => aoOrdenar(e.target.value)}
        className={inputClasse + " flex-1"}
      >
        {colunas.map((c) => (
          <option key={c.coluna} value={c.coluna}>
            {c.rotulo}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => ordenacao.coluna && aoOrdenar(ordenacao.coluna)}
        aria-label={asc ? "Ordem crescente (toque para inverter)" : "Ordem decrescente (toque para inverter)"}
        title={asc ? "Crescente" : "Decrescente"}
        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-borda text-texto-suave transition hover:border-acento-escuro hover:text-acento-escuro focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acento-escuro"
      >
        {asc ? <ArrowUpAZ size={18} aria-hidden="true" /> : <ArrowDownAZ size={18} aria-hidden="true" />}
      </button>
    </div>
  );
}
