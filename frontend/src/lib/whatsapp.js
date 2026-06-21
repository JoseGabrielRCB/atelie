// Monta a mensagem de pedido e o link wa.me para o WhatsApp do ateliê.

const NUMERO = import.meta.env.VITE_WHATSAPP ?? "";

// Descreve um item: "Vestido Floral — Tam: P, Cor: Azul — Qtd: 1".
// Itens sem variação (peças sob medida) omitem o trecho de Tam/Cor.
function descreverItem(item) {
  const partes = [`• ${item.nome}`];
  const variacao = [];
  if (item.tamanho) variacao.push(`Tam: ${item.tamanho}`);
  if (item.cor) variacao.push(`Cor: ${item.cor}`);
  if (variacao.length) partes.push(variacao.join(", "));
  partes.push(`Qtd: ${item.quantidade}`);
  return partes.join(" — ");
}

export function montarMensagem(itens, observacao = "") {
  const linhas = ["Olá! Quero fazer um pedido:", ""];
  itens.forEach((item) => linhas.push(descreverItem(item)));
  if (observacao.trim()) {
    linhas.push("", `Observação: ${observacao.trim()}`);
  }
  return linhas.join("\n");
}

export function linkWhatsapp(itens, observacao = "") {
  const texto = montarMensagem(itens, observacao);
  return `https://wa.me/${NUMERO}?text=${encodeURIComponent(texto)}`;
}

// Aviso (opcional) de que uma encomenda sob medida foi enviada pelo site.
// As imagens já foram pelo sistema; aqui é só um "oi" com o resumo em texto.
export function linkWhatsappEncomenda(nome, descricao = "") {
  const linhas = [
    "Olá! Acabei de enviar uma encomenda sob medida pelo site.",
    "",
    `Nome: ${nome}`,
  ];
  if (descricao.trim()) linhas.push(`Resumo: ${descricao.trim()}`);
  linhas.push("", "As imagens de referência já foram pelo sistema.");
  return `https://wa.me/${NUMERO}?text=${encodeURIComponent(linhas.join("\n"))}`;
}

// Link genérico do WhatsApp (CTA "Falar no WhatsApp" da Home), com texto opcional.
export function linkWhatsappTexto(texto = "") {
  const base = `https://wa.me/${NUMERO}`;
  return texto.trim() ? `${base}?text=${encodeURIComponent(texto.trim())}` : base;
}

export const whatsappConfigurado = Boolean(NUMERO);
