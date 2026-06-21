import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Minus, Check, X } from "lucide-react";
import { useAdminPecas } from "../../hooks/useAdminPecas";
import { atualizarVariacao } from "../../lib/api";
import { useOrdenacao, ordenarPor } from "../../hooks/useOrdenacao";
import { CabecalhoOrdenavel } from "../../components/admin/CabecalhoOrdenavel";
import { Carregando, Erro, Vazio } from "../../components/Estado";
import { Feedback, Selo, inputClasse } from "../../components/admin/ui";

// Uma linha da tabela de estoque. Mantém o próprio estado local de edição,
// inicializado a partir das props (sem efeitos). Os botões +/− e o input
// ajustam esse estado (com clamp em 0); "Salvar" dispara a mutation.
function LinhaEstoque({ v, salvarMut }) {
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState(String(v.estoque));
  const [feedback, setFeedback] = useState(null); // { tipo, texto }

  const rotulo = `${v.pecaNome} ${v.tamanho || ""} ${v.cor || ""}`.trim();
  const numero = Number(valor);
  const valido = Number.isInteger(numero) && numero >= 0;
  const mudou = numero !== v.estoque;

  function iniciarEdicao() {
    setValor(String(v.estoque));
    setFeedback(null);
    setEditando(true);
  }

  function cancelar() {
    setValor(String(v.estoque));
    setFeedback(null);
    setEditando(false);
  }

  function ajustar(delta) {
    setFeedback(null);
    setValor((atual) => {
      const base = Number(atual);
      const seguro = Number.isFinite(base) ? base : 0;
      return String(Math.max(0, seguro + delta));
    });
  }

  function salvar() {
    if (!valido) {
      setFeedback({ tipo: "erro", texto: "Informe um número inteiro maior ou igual a 0." });
      return;
    }
    if (!mudou) {
      setEditando(false);
      return;
    }
    setFeedback(null);
    salvarMut.mutate(
      { id: v.id, estoque: numero },
      {
        onSuccess: () => {
          setFeedback({ tipo: "sucesso", texto: "Estoque atualizado." });
          setEditando(false);
        },
        onError: (e) => setFeedback({ tipo: "erro", texto: e.message }),
      }
    );
  }

  const salvando = salvarMut.isPending && salvarMut.variables?.id === v.id;

  return (
    <tr
      className={
        "border-b border-borda last:border-0 " +
        (v.esgotado ? "bg-erro/5" : "hover:bg-fundo")
      }
    >
      <td className="px-4 py-3 font-medium text-texto">{v.pecaNome}</td>
      <td className="px-4 py-3">{v.tamanho || "—"}</td>
      <td className="px-4 py-3">{v.cor || "—"}</td>
      <td className="px-4 py-3">
        {editando ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => ajustar(-1)}
                disabled={numero <= 0 || salvando}
                aria-label={`Diminuir estoque de ${rotulo}`}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-borda text-texto transition hover:border-acento-escuro focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acento-escuro disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Minus size={16} aria-hidden="true" />
              </button>
              <input
                type="number"
                min="0"
                step="1"
                value={valor}
                onChange={(e) => {
                  setFeedback(null);
                  setValor(e.target.value);
                }}
                aria-label={`Estoque de ${rotulo}`}
                className={inputClasse + " w-20 text-center"}
              />
              <button
                type="button"
                onClick={() => ajustar(1)}
                disabled={salvando}
                aria-label={`Aumentar estoque de ${rotulo}`}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-borda text-texto transition hover:border-acento-escuro focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acento-escuro disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Plus size={16} aria-hidden="true" />
              </button>
              {v.esgotado && <Selo cor="vermelho">Esgotado</Selo>}
            </div>
            {feedback && <Feedback tipo={feedback.tipo}>{feedback.texto}</Feedback>}
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="tabular-nums text-texto">{v.estoque}</span>
              {v.esgotado && <Selo cor="vermelho">Esgotado</Selo>}
            </div>
            {feedback?.tipo === "sucesso" && (
              <Feedback tipo="sucesso">{feedback.texto}</Feedback>
            )}
          </div>
        )}
      </td>
      <td className="px-4 py-3 text-right">
        {editando ? (
          <div className="inline-flex items-center gap-1.5">
            <button
              type="button"
              onClick={salvar}
              disabled={!valido || salvando}
              aria-label={`Salvar estoque de ${rotulo}`}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-acento-escuro text-white transition hover:bg-acento-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acento-escuro focus-visible:ring-offset-2 focus-visible:ring-offset-fundo disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Check size={16} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={cancelar}
              disabled={salvando}
              aria-label={`Cancelar edição de ${rotulo}`}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-borda text-texto transition hover:border-acento-escuro focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acento-escuro disabled:cursor-not-allowed disabled:opacity-40"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={iniciarEdicao}
            aria-label={`Editar estoque de ${rotulo}`}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-borda text-texto transition hover:border-acento-escuro focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acento-escuro"
          >
            <Pencil size={16} aria-hidden="true" />
          </button>
        )}
      </td>
    </tr>
  );
}

export default function Estoque() {
  const pecasQ = useAdminPecas();
  const qc = useQueryClient();

  const [busca, setBusca] = useState("");
  const [soEsgotadas, setSoEsgotadas] = useState(false);

  const { ordenacao, alternar } = useOrdenacao("admin-estoque", {
    coluna: "pecaNome",
    direcao: "asc",
  });

  const salvarMut = useMutation({
    mutationFn: ({ id, estoque }) => atualizarVariacao(id, { estoque }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "pecas"] });
    },
  });

  // Achata as variações de todas as peças.
  const linhas = useMemo(() => {
    const pecas = pecasQ.data ?? [];
    const todas = [];
    pecas.forEach((p) => {
      (p.variacoes ?? []).forEach((v) => {
        todas.push({ ...v, pecaNome: p.nome });
      });
    });
    return todas;
  }, [pecasQ.data]);

  const filtradas = linhas.filter((v) => {
    if (soEsgotadas && !v.esgotado) return false;
    if (busca && !v.pecaNome.toLowerCase().includes(busca.toLowerCase()))
      return false;
    return true;
  });

  const ordenadas = ordenarPor(filtradas, ordenacao.coluna, ordenacao.direcao, {
    pecaNome: (v) => v.pecaNome,
    tamanho: (v) => v.tamanho,
    cor: (v) => v.cor,
    estoque: (v) => v.estoque,
  });

  if (pecasQ.isLoading) return <Carregando texto="Carregando estoque..." />;
  if (pecasQ.isError)
    return (
      <Erro mensagem={pecasQ.error.message} aoTentarNovamente={pecasQ.refetch} />
    );

  return (
    <section>
      <h1 className="mb-6 font-display text-3xl font-semibold">Estoque</h1>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          type="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por peça..."
          aria-label="Buscar por peça"
          className={inputClasse + " sm:flex-1"}
        />
        <label className="flex items-center gap-2 text-sm text-texto">
          <input
            type="checkbox"
            checked={soEsgotadas}
            onChange={(e) => setSoEsgotadas(e.target.checked)}
            className="h-4 w-4 accent-[var(--color-acento-escuro)]"
          />
          Mostrar só esgotadas
        </label>
      </div>

      {ordenadas.length === 0 ? (
        <Vazio texto="Nenhuma variação encontrada." />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-borda">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-borda bg-superficie text-left text-texto-suave">
                <CabecalhoOrdenavel
                  coluna="pecaNome"
                  rotulo="Peça"
                  ordenacao={ordenacao}
                  aoOrdenar={alternar}
                />
                <CabecalhoOrdenavel
                  coluna="tamanho"
                  rotulo="Tamanho"
                  ordenacao={ordenacao}
                  aoOrdenar={alternar}
                />
                <CabecalhoOrdenavel
                  coluna="cor"
                  rotulo="Cor"
                  ordenacao={ordenacao}
                  aoOrdenar={alternar}
                />
                <CabecalhoOrdenavel
                  coluna="estoque"
                  rotulo="Estoque"
                  ordenacao={ordenacao}
                  aoOrdenar={alternar}
                />
                <th className="px-4 py-3 font-medium">
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {ordenadas.map((v) => (
                <LinhaEstoque key={v.id} v={v} salvarMut={salvarMut} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
