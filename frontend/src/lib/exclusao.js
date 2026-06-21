// Helpers para montar o aviso de exclusão (o que será removido, agrupado e total).

export function plural(n, singular, pluralForma) {
  return n === 1 ? singular : pluralForma;
}

// Conta variações e imagens de uma peça (vindas do PecaSerializer aninhado).
export function contarDependentesPeca(peca) {
  return {
    variacoes: (peca.variacoes ?? []).length,
    imagens: (peca.imagens ?? []).length,
  };
}

// Linha descritiva de uma peça: 'Peça "X" — 3 variações, 2 imagens'.
export function descreverPeca(peca) {
  const { variacoes, imagens } = contarDependentesPeca(peca);
  return (
    `Peça "${peca.nome}" — ` +
    `${variacoes} ${plural(variacoes, "variação", "variações")}, ` +
    `${imagens} ${plural(imagens, "imagem", "imagens")}`
  );
}

// "Total: 2 categorias, 2 peças, 4 variações, 3 imagens" — só conta o que houver.
export function resumoTotais(totais = {}) {
  const partes = [];
  const add = (n, s, p) => {
    if (n) partes.push(`${n} ${plural(n, s, p)}`);
  };
  add(totais.categorias, "categoria", "categorias");
  add(totais.pecas, "peça", "peças");
  add(totais.variacoes, "variação", "variações");
  add(totais.imagens, "imagem", "imagens");
  add(totais.encomendas, "encomenda", "encomendas");
  return partes.length ? `Total: ${partes.join(", ")}` : "";
}
