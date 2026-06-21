// Primitivos de UI reutilizados no painel admin (botões, campos, feedback).

export function BotaoPrimario({ className = "", ...props }) {
  return (
    <button
      className={
        "inline-flex items-center justify-center gap-2 rounded-lg bg-acento-escuro px-4 py-2 font-medium text-white transition hover:bg-acento-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acento-escuro focus-visible:ring-offset-2 focus-visible:ring-offset-fundo disabled:cursor-not-allowed disabled:opacity-50 " +
        className
      }
      {...props}
    />
  );
}

export function BotaoSecundario({ className = "", ...props }) {
  return (
    <button
      className={
        "inline-flex items-center justify-center gap-2 rounded-lg border border-borda bg-superficie px-4 py-2 text-texto transition hover:border-acento-escuro focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acento-escuro disabled:cursor-not-allowed disabled:opacity-50 " +
        className
      }
      {...props}
    />
  );
}

export function BotaoPerigo({ className = "", ...props }) {
  return (
    <button
      className={
        "inline-flex items-center justify-center gap-2 rounded-lg border border-erro/40 bg-superficie px-3 py-1.5 text-sm text-erro transition hover:bg-erro/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-erro disabled:cursor-not-allowed disabled:opacity-50 " +
        className
      }
      {...props}
    />
  );
}

export const inputClasse =
  "w-full rounded-lg border border-borda bg-superficie px-3 py-2 text-texto placeholder:text-texto-suave focus:border-acento-escuro focus:outline-none focus:ring-2 focus:ring-acento-escuro/30";

export function Campo({ label, htmlFor, dica, children }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1 block text-sm font-medium text-texto">
        {label}
      </label>
      {children}
      {dica && <p className="mt-1 text-xs text-texto-suave">{dica}</p>}
    </div>
  );
}

// Mensagem de feedback (sucesso/erro) acessível.
export function Feedback({ tipo = "sucesso", children }) {
  if (!children) return null;
  const cor = tipo === "erro" ? "text-erro" : "text-sucesso";
  return (
    <p className={`text-sm ${cor}`} role={tipo === "erro" ? "alert" : "status"}>
      {children}
    </p>
  );
}

// Selo de status (ativo/oculto, esgotado, etc.).
export function Selo({ cor = "neutro", children }) {
  const cores = {
    verde: "bg-sucesso/15 text-sucesso",
    cinza: "bg-esgotado/20 text-texto-suave",
    vermelho: "bg-erro/15 text-erro",
    acento: "bg-acento/15 text-acento-escuro",
    neutro: "bg-borda/60 text-texto-suave",
  };
  return (
    <span
      className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${cores[cor]}`}
    >
      {children}
    </span>
  );
}
