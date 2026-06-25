// Máscara e validação de CPF no cliente (espelha o backend: catalogo/validators.py).
// O servidor é a fonte da verdade — isto é conveniência de UX em tempo real.

export function soDigitosCpf(valor) {
  return String(valor || "").replace(/\D/g, "").slice(0, 11);
}

// Formata progressivamente como 000.000.000-00 enquanto digita.
export function mascararCpf(valor) {
  const d = soDigitosCpf(valor);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

// Valida os 11 dígitos + dígitos verificadores (mesmo algoritmo do backend).
export function cpfValido(valor) {
  const cpf = soDigitosCpf(valor);
  if (cpf.length !== 11) return false;
  if (cpf === cpf[0].repeat(11)) return false;
  for (const tamanho of [9, 10]) {
    let soma = 0;
    for (let i = 0; i < tamanho; i += 1) {
      soma += Number(cpf[i]) * (tamanho + 1 - i);
    }
    const resto = (soma * 10) % 11;
    const digito = resto === 10 ? 0 : resto;
    if (digito !== Number(cpf[tamanho])) return false;
  }
  return true;
}
