// Funções auxiliares derivadas dos dados de uma peça.

// URL da imagem principal (ou a primeira disponível); null se não houver.
export function imagemPrincipal(peca) {
  const imagens = peca?.imagens ?? [];
  if (imagens.length === 0) return null;
  const principal = imagens.find((img) => img.principal);
  return (principal ?? imagens[0]).arquivo;
}

// Disponibilidade REAL de uma variação (estoque − reservas ativas), nunca
// negativa. O backend envia `disponivel`; itens antigos sem o campo caem no
// `estoque`. Usar isto (não `esgotado`/`estoque`) para decidir compra.
export function disponivelDaVariacao(v) {
  const d = typeof v?.disponivel === "number" ? v.disponivel : v?.estoque;
  return typeof d === "number" ? Math.max(0, d) : 0;
}

// Variação indisponível para compra: disponibilidade real == 0.
export function variacaoIndisponivel(v) {
  return disponivelDaVariacao(v) === 0;
}

// Peça esgotada: tem variações e TODAS estão sem disponibilidade real.
// Peça sob medida sem variações NÃO é considerada esgotada.
export function pecaEsgotada(peca) {
  const variacoes = peca?.variacoes ?? [];
  return variacoes.length > 0 && variacoes.every(variacaoIndisponivel);
}

// Variações com disponibilidade real (> 0).
export function variacoesDisponiveis(peca) {
  return (peca?.variacoes ?? []).filter((v) => !variacaoIndisponivel(v));
}
