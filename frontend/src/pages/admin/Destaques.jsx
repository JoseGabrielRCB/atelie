import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Star, StarOff, AlertTriangle } from "lucide-react";
import { useAdminPecas } from "../../hooks/useAdminPecas";
import { atualizarPeca } from "../../lib/api";
import { useOrdenacao, ordenarPor } from "../../hooks/useOrdenacao";
import Preco from "../../components/Preco";
import { Carregando, Erro, Vazio } from "../../components/Estado";
import { Feedback, Selo, inputClasse } from "../../components/admin/ui";
import { CabecalhoOrdenavel } from "../../components/admin/CabecalhoOrdenavel";

// A Home mostra até 8 peças na seção "Peças em destaque".
const LIMITE_HOME = 8;

export default function Destaques() {
  const [busca, setBusca] = useState("");
  const [buscaDeb, setBuscaDeb] = useState("");
  const [soDestaque, setSoDestaque] = useState(false);
  const [feedback, setFeedback] = useState({ tipo: "", texto: "" });

  useEffect(() => {
    const t = setTimeout(() => setBuscaDeb(busca.trim().toLowerCase()), 300);
    return () => clearTimeout(t);
  }, [busca]);

  const pecasQ = useAdminPecas({ ordering: "nome" });
  const qc = useQueryClient();
  const { ordenacao, alternar } = useOrdenacao("admin-destaques", {
    coluna: "destaque",
    direcao: "desc",
  });

  const destaqueMut = useMutation({
    mutationFn: ({ id, destaque }) => atualizarPeca(id, { destaque }),
    onMutate: () => setFeedback({ tipo: "", texto: "" }),
    onSuccess: (_dado, { destaque }) => {
      qc.invalidateQueries({ queryKey: ["admin", "pecas"] });
      // Mantém a Home (vitrine pública) em sincronia.
      qc.invalidateQueries({ queryKey: ["pecas"] });
      setFeedback({
        tipo: "sucesso",
        texto: destaque ? "Peça adicionada aos destaques." : "Peça removida dos destaques.",
      });
    },
    onError: (e) => setFeedback({ tipo: "erro", texto: e.message }),
  });

  const pecas = pecasQ.data ?? [];
  const totalDestaque = pecas.filter((p) => p.destaque).length;
  const passouLimite = totalDestaque > LIMITE_HOME;

  // Busca por nome + atalho "só em destaque".
  const filtradas = pecas.filter((p) => {
    if (soDestaque && !p.destaque) return false;
    if (buscaDeb && !p.nome.toLowerCase().includes(buscaDeb)) return false;
    return true;
  });

  const lista = ordenarPor(filtradas, ordenacao.coluna, ordenacao.direcao, {
    nome: (p) => p.nome,
    categoria: (p) => p.categoria_nome,
    preco: (p) => Number(p.preco),
    ativo: (p) => (p.ativo ? 1 : 0),
    destaque: (p) => (p.destaque ? 1 : 0),
  });

  return (
    <section>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-semibold">Destaques</h1>
        <Selo cor={totalDestaque > 0 ? "acento" : "neutro"}>
          {totalDestaque} {totalDestaque === 1 ? "peça em destaque" : "peças em destaque"}
        </Selo>
      </div>
      <p className="mb-4 max-w-2xl text-sm text-texto-suave">
        Escolha as peças que aparecem na seção “Peças em destaque” da Home.
        Recomendado até {LIMITE_HOME}.
      </p>

      {passouLimite && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-borda bg-acento/10 px-4 py-3 text-sm text-texto">
          <AlertTriangle size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-acento-escuro" />
          <span>
            Você marcou {totalDestaque} peças. A Home exibe apenas as primeiras{" "}
            {LIMITE_HOME} — as demais não aparecerão. Não é um erro, só um lembrete.
          </span>
        </div>
      )}

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          type="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nome..."
          className={inputClasse + " sm:flex-1"}
        />
        <label className="inline-flex items-center gap-2 whitespace-nowrap text-sm text-texto">
          <input
            type="checkbox"
            checked={soDestaque}
            onChange={(e) => setSoDestaque(e.target.checked)}
            className="h-4 w-4 rounded border-borda text-acento-escuro focus:ring-acento-escuro"
          />
          Só em destaque
        </label>
      </div>

      {feedback.texto && (
        <div className="mb-4">
          <Feedback tipo={feedback.tipo}>{feedback.texto}</Feedback>
        </div>
      )}

      {pecasQ.isLoading && <Carregando texto="Carregando peças..." />}
      {pecasQ.isError && (
        <Erro mensagem={pecasQ.error.message} aoTentarNovamente={pecasQ.refetch} />
      )}

      {!pecasQ.isLoading && !pecasQ.isError && pecas.length === 0 && (
        <Vazio texto="Nenhuma peça cadastrada ainda." />
      )}
      {!pecasQ.isLoading && !pecasQ.isError && pecas.length > 0 && lista.length === 0 && (
        <Vazio texto="Nenhuma peça encontrada." />
      )}

      {lista.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-borda">
          <table className="w-full min-w-[680px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-borda bg-superficie text-left text-texto-suave">
                <CabecalhoOrdenavel coluna="nome" rotulo="Peça" ordenacao={ordenacao} aoOrdenar={alternar} />
                <CabecalhoOrdenavel coluna="categoria" rotulo="Categoria" ordenacao={ordenacao} aoOrdenar={alternar} />
                <CabecalhoOrdenavel coluna="preco" rotulo="Preço" ordenacao={ordenacao} aoOrdenar={alternar} />
                <CabecalhoOrdenavel coluna="ativo" rotulo="Status" ordenacao={ordenacao} aoOrdenar={alternar} />
                <CabecalhoOrdenavel coluna="destaque" rotulo="Destaque" ordenacao={ordenacao} aoOrdenar={alternar} />
                <th className="px-4 py-3 text-right font-medium">Ação</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((p) => {
                const ocultaEmDestaque = p.destaque && !p.ativo;
                const salvando =
                  destaqueMut.isPending && destaqueMut.variables?.id === p.id;
                return (
                  <tr
                    key={p.id}
                    className={
                      "border-b border-borda last:border-0 hover:bg-fundo " +
                      (p.destaque ? "bg-acento/5" : "")
                    }
                  >
                    <td className="px-4 py-3 font-medium text-texto">
                      <div className="flex items-center gap-2">
                        {p.destaque && (
                          <Star
                            size={15}
                            aria-hidden="true"
                            className="shrink-0 fill-acento text-acento-escuro"
                          />
                        )}
                        {p.nome}
                      </div>
                      {ocultaEmDestaque && (
                        <span className="mt-1 inline-flex items-center gap-1 text-xs text-erro">
                          <AlertTriangle size={13} aria-hidden="true" />
                          Em destaque, mas oculta — não aparece na Home.
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-texto-suave">{p.categoria_nome}</td>
                    <td className="px-4 py-3">
                      <Preco valor={p.preco} />
                    </td>
                    <td className="px-4 py-3">
                      {p.ativo ? (
                        <Selo cor="verde">Ativa</Selo>
                      ) : (
                        <Selo cor="cinza">Oculta</Selo>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {p.destaque ? (
                        <Selo cor="acento">Em destaque</Selo>
                      ) : (
                        <span className="text-texto-suave">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() =>
                            destaqueMut.mutate({ id: p.id, destaque: !p.destaque })
                          }
                          disabled={salvando}
                          aria-pressed={p.destaque}
                          aria-label={
                            p.destaque
                              ? `Remover "${p.nome}" dos destaques`
                              : `Marcar "${p.nome}" como destaque`
                          }
                          className={
                            "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acento-escuro disabled:cursor-not-allowed disabled:opacity-50 " +
                            (p.destaque
                              ? "border-acento-escuro bg-acento/15 text-acento-escuro hover:bg-acento/25"
                              : "border-borda bg-superficie text-texto-suave hover:border-acento-escuro hover:text-acento-escuro")
                          }
                        >
                          {p.destaque ? (
                            <Star size={15} aria-hidden="true" className="fill-acento" />
                          ) : (
                            <StarOff size={15} aria-hidden="true" />
                          )}
                          {p.destaque ? "Em destaque" : "Destacar"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-4 text-sm text-texto-suave">
        Para editar uma peça, vá em{" "}
        <Link to="/admin/pecas" className="font-medium text-acento-escuro hover:underline">
          Peças
        </Link>
        .
      </p>
    </section>
  );
}
