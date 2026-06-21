import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

// Galeria de imagens da peça: imagem grande + setas (anterior/próxima) e
// miniaturas clicáveis. A ordem vem da API (principal primeiro). Funciona como
// um "carretel": as setas circulam da primeira (principal) à última e voltam.
// Use `key={peca.id}` ao montar para reiniciar o índice ao trocar de peça.
export default function Galeria({ imagens, alt }) {
  const [atual, setAtual] = useState(0);

  if (imagens.length === 0) {
    return (
      <div className="aspect-[3/4] w-full overflow-hidden rounded-lg bg-superficie">
        <div className="flex h-full w-full items-center justify-center text-texto-suave">
          Sem foto
        </div>
      </div>
    );
  }

  const total = imagens.length;
  const temVarias = total > 1;
  const ir = (i) => setAtual((i + total) % total); // circular

  const btnSeta =
    "absolute top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-superficie/80 text-texto shadow transition hover:bg-superficie focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acento-escuro";

  return (
    <div>
      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-lg bg-superficie">
        <img
          src={imagens[atual].arquivo}
          alt={temVarias ? `${alt} — imagem ${atual + 1} de ${total}` : alt}
          className="h-full w-full object-cover"
        />

        {temVarias && (
          <>
            <button
              type="button"
              onClick={() => ir(atual - 1)}
              aria-label="Imagem anterior"
              className={btnSeta + " left-2"}
            >
              <ChevronLeft size={20} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => ir(atual + 1)}
              aria-label="Próxima imagem"
              className={btnSeta + " right-2"}
            >
              <ChevronRight size={20} aria-hidden="true" />
            </button>
            <span className="absolute bottom-2 right-2 rounded bg-black/50 px-2 py-0.5 text-xs font-medium text-white">
              {atual + 1}/{total}
            </span>
          </>
        )}
      </div>

      {temVarias && (
        <div className="mt-3 flex gap-3 overflow-x-auto pb-1">
          {imagens.map((img, i) => (
            <button
              key={img.id}
              type="button"
              onClick={() => setAtual(i)}
              aria-label={`Ver imagem ${i + 1}`}
              aria-current={i === atual}
              className={
                "h-20 w-16 flex-shrink-0 overflow-hidden rounded-lg border-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acento-escuro " +
                (i === atual
                  ? "border-acento-escuro"
                  : "border-transparent opacity-70 hover:opacity-100")
              }
            >
              <img
                src={img.arquivo}
                alt=""
                className="h-full w-full object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
