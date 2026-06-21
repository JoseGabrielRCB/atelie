import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useAdminPecas } from "../../hooks/useAdminPecas";
import { useCategorias } from "../../hooks/useCategorias";
import { excluirPeca } from "../../lib/api";
import { useOrdenacao, ordenarPor } from "../../hooks/useOrdenacao";
import Preco from "../../components/Preco";
import { Carregando, Erro, Vazio } from "../../components/Estado";
import { Feedback, Selo, inputClasse } from "../../components/admin/ui";
import { CabecalhoOrdenavel } from "../../components/admin/CabecalhoOrdenavel";
import NovaPecaModal from "../../components/admin/NovaPecaModal";
import EditarPecaModal from "../../components/admin/EditarPecaModal";
import Modal from "../../components/admin/Modal";

export default function PecasLista() {
  const [busca, setBusca] = useState("");
  const [buscaDeb, setBuscaDeb] = useState("");
  const [categoria, setCategoria] = useState("");
  const [erroAcao, setErroAcao] = useState("");

  const [params, setParams] = useSearchParams();
  // Abre o modal de NOVA peça quando a URL tem ?nova=1 (atalho do Resumo
  // e redirecionamento de /admin/pecas/nova).
  const modalAberto = params.get("nova") === "1";
  // Abre o modal de EDIÇÃO quando a URL tem ?editar=<id> (link "Editar" da
  // lista e redirecionamento de /admin/pecas/:id, ex.: "ver detalhes").
  const editarId = params.get("editar");

  useEffect(() => {
    const t = setTimeout(() => setBuscaDeb(busca), 350);
    return () => clearTimeout(t);
  }, [busca]);

  const { data: categorias = [] } = useCategorias();
  const pecasQ = useAdminPecas({ search: buscaDeb, categoria, ordering: "nome" });
  const qc = useQueryClient();

  const { ordenacao, alternar } = useOrdenacao("admin-pecas", {
    coluna: "nome",
    direcao: "asc",
  });

  const excluirMut = useMutation({
    mutationFn: excluirPeca,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "pecas"] }),
    onError: (e) => setErroAcao(e.message),
  });

  function aoExcluir(peca) {
    setErroAcao("");
    if (
      window.confirm(
        `Excluir a peça "${peca.nome}"? Esta ação não pode ser desfeita.`
      )
    ) {
      excluirMut.mutate(peca.id);
    }
  }

  function abrirModal() {
    const novos = new URLSearchParams(params);
    novos.set("nova", "1");
    setParams(novos);
  }

  function fecharModal() {
    const novos = new URLSearchParams(params);
    novos.delete("nova");
    setParams(novos);
  }

  function abrirEdicao(id) {
    const novos = new URLSearchParams(params);
    novos.set("editar", String(id));
    setParams(novos);
  }

  function fecharEdicao() {
    const novos = new URLSearchParams(params);
    novos.delete("editar");
    setParams(novos);
  }

  const pecas = pecasQ.data ?? [];
  const lista = ordenarPor(pecas, ordenacao.coluna, ordenacao.direcao, {
    nome: (p) => p.nome,
    categoria: (p) => p.categoria_nome,
    preco: (p) => Number(p.preco),
    tipo: (p) => p.tipo,
    ativo: (p) => (p.ativo ? 1 : 0),
  });

  return (
    <section>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-semibold">Peças</h1>
        <button
          type="button"
          onClick={abrirModal}
          className="inline-flex items-center gap-2 rounded-lg bg-acento-escuro px-4 py-2 font-medium text-white transition hover:bg-acento-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acento-escuro focus-visible:ring-offset-2 focus-visible:ring-offset-fundo"
        >
          <Plus size={18} aria-hidden="true" />
          Nova peça
        </button>
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <input
          type="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nome..."
          className={inputClasse + " sm:flex-1"}
        />
        <select
          value={categoria}
          onChange={(e) => setCategoria(e.target.value)}
          className={inputClasse + " sm:w-56"}
        >
          <option value="">Todas as categorias</option>
          {categorias.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </select>
      </div>

      {erroAcao && (
        <div className="mb-4">
          <Feedback tipo="erro">{erroAcao}</Feedback>
        </div>
      )}

      {pecasQ.isLoading && <Carregando texto="Carregando peças..." />}
      {pecasQ.isError && (
        <Erro mensagem={pecasQ.error.message} aoTentarNovamente={pecasQ.refetch} />
      )}

      {!pecasQ.isLoading && !pecasQ.isError && pecas.length === 0 && (
        <Vazio texto="Nenhuma peça encontrada." />
      )}

      {!pecasQ.isLoading && !pecasQ.isError && pecas.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-borda">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-borda bg-superficie text-left text-texto-suave">
                <CabecalhoOrdenavel
                  coluna="nome"
                  rotulo="Peça"
                  ordenacao={ordenacao}
                  aoOrdenar={alternar}
                />
                <CabecalhoOrdenavel
                  coluna="categoria"
                  rotulo="Categoria"
                  ordenacao={ordenacao}
                  aoOrdenar={alternar}
                />
                <CabecalhoOrdenavel
                  coluna="preco"
                  rotulo="Preço"
                  ordenacao={ordenacao}
                  aoOrdenar={alternar}
                />
                <CabecalhoOrdenavel
                  coluna="tipo"
                  rotulo="Tipo"
                  ordenacao={ordenacao}
                  aoOrdenar={alternar}
                />
                <CabecalhoOrdenavel
                  coluna="ativo"
                  rotulo="Vitrine"
                  ordenacao={ordenacao}
                  aoOrdenar={alternar}
                />
                <th className="px-4 py-3 font-medium">Estoque</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {lista.map((p) => {
                const temEsgotada = (p.variacoes ?? []).some((v) => v.esgotado);
                const semVariacoes = (p.variacoes ?? []).length === 0;
                return (
                  <tr
                    key={p.id}
                    className="border-b border-borda last:border-0 hover:bg-fundo"
                  >
                    <td className="px-4 py-3 font-medium text-texto">{p.nome}</td>
                    <td className="px-4 py-3 text-texto-suave">
                      {p.categoria_nome}
                    </td>
                    <td className="px-4 py-3">
                      <Preco valor={p.preco} />
                    </td>
                    <td className="px-4 py-3 text-texto-suave">
                      {p.tipo === "sob_medida" ? "Sob medida" : "Pronta"}
                    </td>
                    <td className="px-4 py-3">
                      {p.ativo ? (
                        <Selo cor="verde">Ativa</Selo>
                      ) : (
                        <Selo cor="cinza">Oculta</Selo>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {semVariacoes ? (
                        <span className="text-texto-suave">—</span>
                      ) : temEsgotada ? (
                        <Selo cor="vermelho">Tem esgotado</Selo>
                      ) : (
                        <Selo cor="verde">OK</Selo>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-3 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => abrirEdicao(p.id)}
                          className="inline-flex items-center gap-1 font-medium text-acento-escuro hover:underline"
                        >
                          <Pencil size={15} aria-hidden="true" />
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => aoExcluir(p)}
                          className="inline-flex items-center gap-1 text-erro hover:underline"
                        >
                          <Trash2 size={15} aria-hidden="true" />
                          Excluir
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

      <Modal
        aberto={modalAberto}
        aoFechar={fecharModal}
        titulo="Nova peça"
        tamanho="xl"
      >
        <NovaPecaModal aoFechar={fecharModal} />
      </Modal>

      <Modal
        aberto={Boolean(editarId)}
        aoFechar={fecharEdicao}
        titulo="Editar peça"
        tamanho="xl"
      >
        {editarId && (
          <EditarPecaModal pecaId={editarId} aoFechar={fecharEdicao} />
        )}
      </Modal>
    </section>
  );
}
