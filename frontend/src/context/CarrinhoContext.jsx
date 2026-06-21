import { createContext, useContext, useEffect, useMemo, useState } from "react";

const CarrinhoContext = createContext(null);
const CHAVE_STORAGE = "atelie_carrinho";

function carregarInicial() {
  try {
    const bruto = localStorage.getItem(CHAVE_STORAGE);
    return bruto ? JSON.parse(bruto) : [];
  } catch {
    return [];
  }
}

// Chave única do item: identifica peça + variação escolhida.
function chaveItem({ pecaId, variacaoId }) {
  return `${pecaId}:${variacaoId ?? "sem-variacao"}`;
}

// Limita a quantidade ao estoque disponível. `estoque` nulo/indefinido
// (ex.: peça sob medida) significa sem limite.
function limitarAoEstoque(quantidade, estoque) {
  if (typeof estoque === "number" && estoque >= 0) {
    return Math.max(1, Math.min(quantidade, estoque));
  }
  return Math.max(1, quantidade);
}

export function CarrinhoProvider({ children }) {
  const [itens, setItens] = useState(carregarInicial);

  useEffect(() => {
    localStorage.setItem(CHAVE_STORAGE, JSON.stringify(itens));
  }, [itens]);

  function adicionar(novo) {
    const chave = chaveItem(novo);
    setItens((atual) => {
      const existente = atual.find((i) => i.chave === chave);
      if (existente) {
        // Já existe a mesma peça/variação: soma a quantidade (limitada ao estoque).
        const estoque = novo.estoque ?? existente.estoque;
        return atual.map((i) =>
          i.chave === chave
            ? {
                ...i,
                estoque,
                quantidade: limitarAoEstoque(
                  i.quantidade + novo.quantidade,
                  estoque
                ),
              }
            : i
        );
      }
      return [
        ...atual,
        {
          ...novo,
          chave,
          quantidade: limitarAoEstoque(novo.quantidade, novo.estoque),
        },
      ];
    });
  }

  function remover(chave) {
    setItens((atual) => atual.filter((i) => i.chave !== chave));
  }

  function ajustarQuantidade(chave, quantidade) {
    if (quantidade < 1) return;
    setItens((atual) =>
      atual.map((i) =>
        i.chave === chave
          ? { ...i, quantidade: limitarAoEstoque(quantidade, i.estoque) }
          : i
      )
    );
  }

  function limpar() {
    setItens([]);
  }

  const totalItens = useMemo(
    () => itens.reduce((soma, i) => soma + i.quantidade, 0),
    [itens]
  );

  // Soma de preço × quantidade de todos os itens (subtotal do pedido).
  const totalPreco = useMemo(
    () =>
      itens.reduce((soma, i) => soma + (Number(i.preco) || 0) * i.quantidade, 0),
    [itens]
  );

  const valor = {
    itens,
    totalItens,
    totalPreco,
    adicionar,
    remover,
    ajustarQuantidade,
    limpar,
  };

  return (
    <CarrinhoContext.Provider value={valor}>
      {children}
    </CarrinhoContext.Provider>
  );
}

export function useCarrinho() {
  const ctx = useContext(CarrinhoContext);
  if (!ctx) {
    throw new Error("useCarrinho deve ser usado dentro de <CarrinhoProvider>.");
  }
  return ctx;
}
