// Helpers da paleta de cores (validação de hex e normalização).

export const HEX_REGEX = /^#[0-9A-Fa-f]{6}$/;

export function hexValido(hex) {
  return HEX_REGEX.test(String(hex ?? "").trim());
}

// Normaliza para "#RRGGBB" em maiúsculas (o input nativo de cor devolve minúsculo).
export function normalizarHex(hex) {
  const limpo = String(hex ?? "").trim();
  return hexValido(limpo) ? limpo.toUpperCase() : limpo;
}

// Cor de texto legível (preto/branco) sobre um fundo hex — para swatches grandes.
export function corDeTextoSobre(hex) {
  if (!hexValido(hex)) return "#1A1816";
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  // Luminância relativa simples.
  const luminancia = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminancia > 0.6 ? "#1A1816" : "#FFFFFF";
}
