import { useEffect, useRef } from "react";
import { Trash2 } from "lucide-react";

// Checkbox "selecionar todos" do cabeçalho, com estado indeterminado quando há
// seleção parcial. `ids` são os ids VISÍVEIS (respeitam filtro/busca da tabela).
export function CaixaTodos({ ids, estaSelecionado, definirVarios, rotulo = "Selecionar todos" }) {
  const ref = useRef(null);
  const total = ids.length;
  const marcados = ids.filter(estaSelecionado).length;
  const todos = total > 0 && marcados === total;
  const parcial = marcados > 0 && marcados < total;

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = parcial;
  }, [parcial]);

  return (
    <input
      ref={ref}
      type="checkbox"
      checked={todos}
      disabled={total === 0}
      onChange={() => definirVarios(ids, !todos)}
      aria-label={rotulo}
      className="h-4 w-4 accent-[var(--color-acento-escuro)] disabled:opacity-40"
    />
  );
}

// Checkbox de uma linha.
export function CaixaLinha({ id, estaSelecionado, alternar, rotulo }) {
  return (
    <input
      type="checkbox"
      checked={estaSelecionado(id)}
      onChange={() => alternar(id)}
      aria-label={rotulo}
      className="h-4 w-4 accent-[var(--color-acento-escuro)]"
    />
  );
}

// Barra de ação em massa: aparece quando há ≥1 selecionado.
export function BarraSelecao({ quantidade, aoExcluir, aoLimpar }) {
  if (quantidade < 1) return null;
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-erro/30 bg-erro/5 px-4 py-3">
      <span className="text-sm font-medium text-texto">
        {quantidade} selecionado{quantidade > 1 ? "s" : ""}
      </span>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={aoExcluir}
          className="inline-flex items-center gap-2 rounded-lg bg-erro px-3 py-1.5 text-sm font-medium text-white transition hover:bg-erro/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-erro focus-visible:ring-offset-2 focus-visible:ring-offset-fundo"
        >
          <Trash2 size={16} aria-hidden="true" />
          Excluir selecionados
        </button>
        <button
          type="button"
          onClick={aoLimpar}
          className="rounded-lg border border-borda bg-superficie px-3 py-1.5 text-sm text-texto transition hover:border-acento-escuro focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acento-escuro"
        >
          Limpar seleção
        </button>
      </div>
    </div>
  );
}
