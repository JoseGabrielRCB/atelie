// Mostra as variações como chips. As esgotadas aparecem apagadas e não clicáveis.
import { variacaoIndisponivel } from "../lib/pecas";

function rotulo(v) {
  const partes = [v.tamanho, v.cor].filter(Boolean);
  return partes.length ? partes.join(" · ") : "Única";
}

export default function SeletorVariacao({ variacoes, selecionada, onSelecionar }) {
  return (
    <div>
      <p className="mb-2 text-sm font-medium text-texto">Tamanho e cor</p>
      <div className="flex flex-wrap gap-2">
        {variacoes.map((v) => {
          const ativa = selecionada?.id === v.id;
          if (variacaoIndisponivel(v)) {
            return (
              <span
                key={v.id}
                aria-disabled="true"
                title="Esgotado"
                className="cursor-not-allowed rounded-lg border border-borda px-3 py-2 text-sm text-esgotado line-through"
              >
                {rotulo(v)}
              </span>
            );
          }
          return (
            <button
              key={v.id}
              type="button"
              onClick={() => onSelecionar(v)}
              className={
                "rounded-lg border px-3 py-2 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acento-escuro focus-visible:ring-offset-1 focus-visible:ring-offset-fundo " +
                (ativa
                  ? "border-acento-escuro bg-acento-escuro text-white"
                  : "border-borda text-texto hover:border-acento-escuro")
              }
            >
              {rotulo(v)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
