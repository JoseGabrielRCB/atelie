// Componentes de estado reutilizáveis: carregando, erro e vazio (PT-BR).

export function Carregando({ texto = "Carregando..." }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-texto-suave">
      <div className="mb-3 h-8 w-8 animate-spin rounded-full border-2 border-borda border-t-acento" />
      <p>{texto}</p>
    </div>
  );
}

export function Erro({ mensagem, aoTentarNovamente }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <p className="mb-4 max-w-md text-erro">
        {mensagem || "Algo deu errado. Tente novamente."}
      </p>
      {aoTentarNovamente && (
        <button
          onClick={aoTentarNovamente}
          className="rounded-lg border border-borda px-4 py-2 text-sm text-texto transition hover:bg-superficie"
        >
          Tentar novamente
        </button>
      )}
    </div>
  );
}

export function Vazio({ texto = "Nada por aqui.", children }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center text-texto-suave">
      <p className="mb-4">{texto}</p>
      {children}
    </div>
  );
}

// Esqueleto de carregamento para a grade da vitrine.
export function GradeSkeleton({ quantidade = 8 }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: quantidade }).map((_, i) => (
        <div key={i} className="animate-pulse">
          <div className="aspect-[3/4] w-full rounded-lg bg-borda/60" />
          <div className="mt-3 h-4 w-3/4 rounded bg-borda/60" />
          <div className="mt-2 h-4 w-1/3 rounded bg-borda/60" />
        </div>
      ))}
    </div>
  );
}
