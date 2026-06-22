// Máscara de moeda (BRL) para os campos de preço do admin.
// Mantém o valor no estado como CENTAVOS (inteiro), exibe formatado e envia à
// API uma string decimal simples ("1234.50"). Teto de R$ 1.000.000,00.

export const TETO_PRECO = 1_000_000; // reais
const TETO_CENTAVOS = TETO_PRECO * 100;

// Extrai os dígitos do que o usuário digitou e interpreta como centavos.
export function digitarParaCentavos(texto) {
  const digitos = String(texto ?? "").replace(/\D/g, "");
  if (!digitos) return 0;
  let centavos = parseInt(digitos, 10);
  if (Number.isNaN(centavos)) centavos = 0;
  if (centavos > TETO_CENTAVOS) centavos = TETO_CENTAVOS;
  return centavos;
}

// Converte um valor vindo da API (número ou "1234.50") em centavos.
export function valorParaCentavos(valor) {
  if (valor === "" || valor == null) return 0;
  const num = Number(valor);
  if (Number.isNaN(num)) return 0;
  return Math.min(Math.round(num * 100), TETO_CENTAVOS);
}

// Formata centavos como moeda brasileira ("1.234,50") — sem o "R$" (o label já tem).
export function formatarCentavos(centavos) {
  const reais = (centavos || 0) / 100;
  return reais.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// String decimal simples para enviar à API ("1234.50").
export function centavosParaDecimal(centavos) {
  return ((centavos || 0) / 100).toFixed(2);
}
