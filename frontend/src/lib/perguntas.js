// "Caixinha de perguntas" do painel: mapeia uma pergunta em linguagem natural a
// um conjunto pequeno de intenções por palavras-chave/sinônimos (SEM API paga) e
// responde com números já calculados a partir das queries do admin.

// Normaliza: minúsculas, sem acento — para casar palavras-chave com tolerância.
function normalizar(texto) {
  return String(texto ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

function temAlguma(txt, termos) {
  return termos.some((t) => txt.includes(t));
}

// Intenções, em ordem de prioridade (a 1ª que casar responde).
const INTENCOES = [
  {
    // Peças esgotadas (todas as variações esgotadas).
    chaves: (t) => temAlguma(t, ["esgotad"]) && temAlguma(t, ["peca", "peças", "pecas", "produto"]),
    responder: ({ pecas }) => {
      const lista = pecas.filter((p) => {
        const vs = p.variacoes ?? [];
        return vs.length > 0 && vs.every((v) => v.esgotado);
      });
      if (lista.length === 0) return "Nenhuma peça está totalmente esgotada.";
      return `${lista.length} peça(s) totalmente esgotada(s): ${lista
        .map((p) => p.nome)
        .join(", ")}.`;
    },
  },
  {
    // Variações esgotadas (estoque 0).
    chaves: (t) => temAlguma(t, ["esgotad"]),
    responder: ({ variacoes }) => {
      const n = variacoes.filter((v) => v.esgotado).length;
      return `Há ${n} variação(ões) esgotada(s) (estoque zerado).`;
    },
  },
  {
    // Peças sem foto.
    chaves: (t) =>
      temAlguma(t, ["sem foto", "sem imagem", "sem fotos", "sem imagens"]) ||
      (temAlguma(t, ["foto", "imagem"]) && temAlguma(t, ["sem", "falta"])),
    responder: ({ pecas }) => {
      const lista = pecas.filter((p) => (p.imagens ?? []).length === 0);
      if (lista.length === 0) return "Todas as peças têm pelo menos uma imagem.";
      return `${lista.length} peça(s) sem foto: ${lista.map((p) => p.nome).join(", ")}.`;
    },
  },
  {
    // Encomendas recebidas este mês.
    chaves: (t) =>
      temAlguma(t, ["encomenda"]) && temAlguma(t, ["mes", "este mes", "mês"]),
    responder: ({ encomendas }) => {
      const agora = new Date();
      const n = encomendas.filter((e) => {
        if (!e.criado_em) return false;
        const d = new Date(e.criado_em);
        return (
          d.getFullYear() === agora.getFullYear() && d.getMonth() === agora.getMonth()
        );
      }).length;
      return `Foram recebidas ${n} encomenda(s) este mês.`;
    },
  },
  {
    // Encomendas novas (status recebido).
    chaves: (t) => temAlguma(t, ["encomenda"]) && temAlguma(t, ["nova", "novas", "recebid"]),
    responder: ({ encomendas }) => {
      const n = encomendas.filter((e) => e.status === "recebido").length;
      return `Há ${n} encomenda(s) nova(s) aguardando análise.`;
    },
  },
  {
    // Total de encomendas.
    chaves: (t) => temAlguma(t, ["encomenda"]),
    responder: ({ encomendas }) => `Há ${encomendas.length} encomenda(s) no total.`,
  },
  {
    // Peças em destaque.
    chaves: (t) => temAlguma(t, ["destaque", "destacad"]),
    responder: ({ pecas }) => {
      const n = pecas.filter((p) => p.destaque).length;
      return `Há ${n} peça(s) em destaque na Home.`;
    },
  },
  {
    // Peças ocultas / inativas.
    chaves: (t) => temAlguma(t, ["oculta", "ocultas", "inativa", "inativas", "escondid"]),
    responder: ({ pecas }) => {
      const n = pecas.filter((p) => !p.ativo).length;
      return `Há ${n} peça(s) oculta(s) na vitrine.`;
    },
  },
  {
    // Peças ativas.
    chaves: (t) => temAlguma(t, ["ativa", "ativas", "vitrine"]) && temAlguma(t, ["peca", "peças", "pecas", "quant"]),
    responder: ({ pecas }) => {
      const n = pecas.filter((p) => p.ativo).length;
      return `Há ${n} peça(s) ativa(s) na vitrine.`;
    },
  },
  {
    // Total de variações.
    chaves: (t) => temAlguma(t, ["variac", "variaç"]),
    responder: ({ variacoes }) => `Há ${variacoes.length} variação(ões) cadastrada(s).`,
  },
  {
    // Total de peças.
    chaves: (t) => temAlguma(t, ["peca", "peças", "pecas", "produto"]),
    responder: ({ pecas }) => `Há ${pecas.length} peça(s) cadastrada(s).`,
  },
];

export function responderPergunta(pergunta, dados) {
  const t = normalizar(pergunta);
  if (!t.trim()) return "Digite uma pergunta para eu responder.";
  for (const intencao of INTENCOES) {
    if (intencao.chaves(t)) return intencao.responder(dados);
  }
  return "Não entendi a pergunta. Tente algo como “quantas peças esgotadas?”, “quais peças sem foto?” ou “encomendas recebidas este mês?”.";
}
