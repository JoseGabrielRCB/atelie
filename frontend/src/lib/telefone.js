// Máscara e validação de telefone BR, reutilizadas pela Encomenda e pela conta.
// Aceita fixo (10 dígitos) e celular (11 dígitos).

export function soDigitosTelefone(valor) {
  return String(valor || "").replace(/\D/g, "").slice(0, 11);
}

// Formata "(67) 99999-9999" (11 díg.) ou "(67) 9999-9999" (10 díg.) enquanto digita.
export function mascararTelefone(valor) {
  const d = soDigitosTelefone(valor);
  if (d.length === 0) return "";
  if (d.length <= 2) return `(${d}`;
  const ddd = d.slice(0, 2);
  const resto = d.slice(2);
  if (resto.length <= 4) return `(${ddd}) ${resto}`;
  const corte = resto.length <= 8 ? 4 : 5; // 10 díg. → 4+4; 11 díg. → 5+4
  return `(${ddd}) ${resto.slice(0, corte)}-${resto.slice(corte)}`;
}

export function telefoneValido(valor) {
  const d = soDigitosTelefone(valor);
  return d.length === 10 || d.length === 11;
}
