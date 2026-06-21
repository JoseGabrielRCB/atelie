import { useCallback, useEffect, useState } from "react";

const PREFIXO = "atelie_admin_ordenacao_";

// Estado de ordenação de uma tabela, persistido em localStorage por `tabelaId`.
// Assim a ordenação escolhida NÃO reseta ao paginar/recarregar — vive fora do
// componente da página.
export function useOrdenacao(tabelaId, inicial = { coluna: null, direcao: "asc" }) {
  const chave = PREFIXO + tabelaId;

  const [ordenacao, setOrdenacao] = useState(() => {
    try {
      const bruto = localStorage.getItem(chave);
      return bruto ? JSON.parse(bruto) : inicial;
    } catch {
      return inicial;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(chave, JSON.stringify(ordenacao));
    } catch {
      /* ignora indisponibilidade do storage */
    }
  }, [chave, ordenacao]);

  // Clicar numa coluna: alterna asc/desc se já ativa; senão ativa em asc.
  const alternar = useCallback((coluna) => {
    setOrdenacao((o) =>
      o.coluna === coluna
        ? { coluna, direcao: o.direcao === "asc" ? "desc" : "asc" }
        : { coluna, direcao: "asc" }
    );
  }, []);

  return { ordenacao, alternar };
}

// Ordena uma lista por `coluna`/`direcao`. `acessores` mapeia coluna → fn(item)
// que devolve o valor a comparar (default: item[coluna]). Números comparam
// numericamente; o resto via localeCompare PT-BR (numérico, sem acento/caixa).
export function ordenarPor(lista, coluna, direcao, acessores = {}) {
  if (!coluna) return lista;
  const acessor = acessores[coluna] ?? ((item) => item[coluna]);
  const fator = direcao === "desc" ? -1 : 1;
  return [...lista].sort((a, b) => {
    const va = acessor(a);
    const vb = acessor(b);
    if (typeof va === "number" && typeof vb === "number") {
      return (va - vb) * fator;
    }
    return (
      String(va ?? "").localeCompare(String(vb ?? ""), "pt-BR", {
        numeric: true,
        sensitivity: "base",
      }) * fator
    );
  });
}
