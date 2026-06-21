import { useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

const FOCAVEIS =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

// Modal acessível reutilizável (foco preso, Esc/clique fora fecham, role=dialog).
// Visual conforme STYLE.md: superfície branca, borda, cantos 8px, sombra suave,
// fundo escurecido por trás. Devolve o foco ao elemento anterior ao fechar.
export default function Modal({ aberto, aoFechar, titulo, children, tamanho = "md" }) {
  const caixaRef = useRef(null);
  const focoAnteriorRef = useRef(null);

  const aoTeclar = useCallback(
    (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        aoFechar();
        return;
      }
      if (e.key === "Tab") {
        // Mantém o foco preso dentro do modal.
        const focaveis = caixaRef.current?.querySelectorAll(FOCAVEIS);
        if (!focaveis || focaveis.length === 0) return;
        const primeiro = focaveis[0];
        const ultimo = focaveis[focaveis.length - 1];
        if (e.shiftKey && document.activeElement === primeiro) {
          e.preventDefault();
          ultimo.focus();
        } else if (!e.shiftKey && document.activeElement === ultimo) {
          e.preventDefault();
          primeiro.focus();
        }
      }
    },
    [aoFechar]
  );

  useEffect(() => {
    if (!aberto) return;
    // Guarda o foco atual e bloqueia o scroll do fundo.
    focoAnteriorRef.current = document.activeElement;
    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Foca o primeiro elemento do modal.
    const t = setTimeout(() => {
      const focaveis = caixaRef.current?.querySelectorAll(FOCAVEIS);
      (focaveis && focaveis[0] ? focaveis[0] : caixaRef.current)?.focus();
    }, 0);

    return () => {
      clearTimeout(t);
      document.body.style.overflow = overflowAnterior;
      // Devolve o foco ao elemento anterior.
      focoAnteriorRef.current?.focus?.();
    };
  }, [aberto]);

  if (!aberto) return null;

  const larguras = {
    sm: "max-w-md",
    md: "max-w-lg",
    lg: "max-w-2xl",
    xl: "max-w-4xl",
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:p-6"
      onMouseDown={(e) => {
        // Fecha só no clique sobre o fundo (não dentro da caixa).
        if (e.target === e.currentTarget) aoFechar();
      }}
      onKeyDown={aoTeclar}
    >
      <div
        ref={caixaRef}
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        tabIndex={-1}
        className={
          "my-8 w-full rounded-lg border border-borda bg-superficie shadow-[0_10px_40px_rgba(0,0,0,0.18)] focus:outline-none " +
          (larguras[tamanho] ?? larguras.md)
        }
      >
        <div className="flex items-center justify-between border-b border-borda px-5 py-4">
          <h2 className="font-display text-xl font-semibold text-texto">{titulo}</h2>
          <button
            type="button"
            onClick={aoFechar}
            aria-label="Fechar"
            className="rounded-lg p-1 text-texto-suave transition hover:bg-borda/50 hover:text-texto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acento-escuro"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <div className="px-5 py-5">{children}</div>
      </div>
    </div>,
    document.body
  );
}
