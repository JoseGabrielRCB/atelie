// Funções auxiliares derivadas dos dados de uma peça.

// URL da imagem principal (ou a primeira disponível); null se não houver.
export function imagemPrincipal(peca) {
  const imagens = peca?.imagens ?? [];
  if (imagens.length === 0) return null;
  const principal = imagens.find((img) => img.principal);
  return (principal ?? imagens[0]).arquivo;
}

// Peça esgotada: tem variações e TODAS estão esgotadas.
// Peça sob medida sem variações NÃO é considerada esgotada.
export function pecaEsgotada(peca) {
  const variacoes = peca?.variacoes ?? [];
  return variacoes.length > 0 && variacoes.every((v) => v.esgotado);
}

// Variações com estoque disponível.
export function variacoesDisponiveis(peca) {
  return (peca?.variacoes ?? []).filter((v) => !v.esgotado);
}
