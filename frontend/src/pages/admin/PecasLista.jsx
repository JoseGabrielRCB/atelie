import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Star, StarOff } from "lucide-react";
import { useAdminPecas } from "../../hooks/useAdminPecas";
import { useCategorias } from "../../hooks/useCategorias";
import { useSelecao } from "../../hooks/useSelecao";
import { excluirPeca, atualizarPeca } from "../../lib/api";
import { useOrdenacao, ordenarPor } from "../../hooks/useOrdenacao";
import { usePaginacao } from "../../hooks/usePaginacao";
import { Paginacao } from "../../components/admin/Paginacao";
import { descreverPeca, resumoTotais } from "../../lib/exclusao";
import Preco from "../../components/Preco";
import { Carregando, Erro, Vazio } from "../../components/Estado";
import { Feedback, Selo, inputClasse } from "../../components/admin/ui";
import { CabecalhoOrdenavel, OrdenarMobile } from "../../components/admin/CabecalhoOrdenavel";
import { CaixaTodos, CaixaLinha, BarraSelecao } from "../../components/admin/Selecao";
import ConfirmarExclusao from "../../components/admin/ConfirmarExclusao";
import NovaPecaModal from "../../components/admin/NovaPecaModal";
import EditarPecaModal from "../../components/admin/EditarPecaModal";
import Modal from "../../components/admin/Modal";

// Plano de exclusão de peças: cada peça com suas variações/imagens (cascata).
function planoPecas(pecas) {
  let totalVar = 0;
  let totalImg = 0;
  const itens = pecas.map((p) => {
    totalVar += (p.variacoes ?? []).length;
    totalImg += (p.imagens ?? []).length;
    const linhas = [];
    if (p.destaque) linhas.push("Sairá da seção de destaques da Home.");
    return {
      chave: `peca-${p.id}`,
      titulo: descreverPeca(p),
      linhas,
    };
  });
  return {
    itens,
    resumo: resumoTotais({
      pecas: pecas.length,
      variacoes: totalVar,
      imagens: totalImg,
    }),
    // Excluir peça remove variações/imagens em cascata → confirmação reforçada.
    cascata: true,
  };
}

export default function PecasLista() {
  const [busca, setBusca] = useState("");
  const [buscaDeb, setBuscaDeb] = useState("");
  const [categoria, setCategoria] = useState("");
  const [erroAcao, setErroAcao] = useState("");
  const [okAcao, setOkAcao] = useState("");
  const [exclusao, setExclusao] = useState(null);
  const sel = useSelecao();

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

  // Atalho de destaque direto na lista (a curadoria completa fica em /admin/destaques).
  const destaqueMut = useMutation({
    mutationFn: ({ id, destaque }) => atualizarPeca(id, { destaque }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "pecas"] });
      qc.invalidateQueries({ queryKey: ["pecas"] });
    },
    onError: (e) => setErroAcao(e.message),
  });

  function pedirExclusao(pecasAlvo) {
    if (pecasAlvo.length === 0) return;
    setErroAcao("");
    setOkAcao("");
    const { itens, resumo, cascata } = planoPecas(pecasAlvo);
    setExclusao({
      titulo: pecasAlvo.length > 1 ? "Excluir peças" : "Excluir peça",
      itens,
      resumo,
      cascata,
      alvos: pecasAlvo.map((p) => ({ id: p.id, rotulo: `Peça "${p.nome}"` })),
      excluir: excluirPeca,
    });
  }

  function aoConcluirExclusao({ sucesso, falhas }) {
    qc.invalidateQueries({ queryKey: ["admin", "pecas"] });
    qc.invalidateQueries({ queryKey: ["pecas"] });
    sel.limpar();
    if (falhas.length === 0) setOkAcao(`${sucesso} peça(s) excluída(s).`);
    else setErroAcao(`${falhas.length} peça(s) não puderam ser excluídas.`);
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
  const pag = usePaginacao(lista, {
    resetKey: `${buscaDeb}|${categoria}|${ordenacao.coluna}|${ordenacao.direcao}`,
  });
  // "Selecionar todos" age na PÁGINA atual; a seleção em massa (exclusão) usa o
  // conjunto inteiro selecionado (persistido entre páginas).
  const idsVisiveis = pag.itensPagina.map((p) => p.id);
  const selecionadas = lista.filter((p) => sel.estaSelecionado(p.id));

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
      {okAcao && (
        <div className="mb-4">
          <Feedback tipo="sucesso">{okAcao}</Feedback>
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
        <>
        <BarraSelecao
          quantidade={sel.quantidade}
          aoExcluir={() => pedirExclusao(selecionadas)}
          aoLimpar={sel.limpar}
        />
        <OrdenarMobile
          className="mb-3"
          ordenacao={ordenacao}
          aoOrdenar={alternar}
          colunas={[
            { coluna: "nome", rotulo: "Peça" },
            { coluna: "categoria", rotulo: "Categoria" },
            { coluna: "preco", rotulo: "Preço" },
            { coluna: "tipo", rotulo: "Tipo" },
            { coluna: "ativo", rotulo: "Vitrine" },
          ]}
        />
        <div className="sm:overflow-x-auto sm:rounded-lg sm:border sm:border-borda">
          <table className="tabela-cartoes w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-borda bg-superficie text-left text-texto-suave">
                <th className="w-10 px-4 py-3">
                  <CaixaTodos
                    ids={idsVisiveis}
                    estaSelecionado={sel.estaSelecionado}
                    definirVarios={sel.definirVarios}
                    rotulo="Selecionar todas as peças desta página"
                  />
                </th>
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
              {pag.itensPagina.map((p) => {
                const temEsgotada = (p.variacoes ?? []).some((v) => v.esgotado);
                const semVariacoes = (p.variacoes ?? []).length === 0;
                const marcada = sel.estaSelecionado(p.id);
                return (
                  <tr
                    key={p.id}
                    className={
                      "border-b border-borda last:border-0 " +
                      (marcada ? "bg-acento/5" : "hover:bg-fundo")
                    }
                  >
                    <td className="cel-selecao px-4 py-3">
                      <CaixaLinha
                        id={p.id}
                        estaSelecionado={sel.estaSelecionado}
                        alternar={sel.alternar}
                        rotulo={`Selecionar ${p.nome}`}
                      />
                    </td>
                    <td className="cel-principal px-4 py-3 font-medium text-texto">
                      <span className="block max-w-[18rem] truncate" title={p.nome}>
                        {p.nome}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-texto-suave" data-rotulo="Categoria">
                      {p.categoria_nome}
                    </td>
                    <td className="px-4 py-3" data-rotulo="Preço">
                      <Preco valor={p.preco} />
                    </td>
                    <td className="px-4 py-3 text-texto-suave" data-rotulo="Tipo">
                      {p.tipo === "sob_medida" ? "Sob medida" : "Pronta"}
                    </td>
                    <td className="px-4 py-3" data-rotulo="Vitrine">
                      {p.ativo ? (
                        <Selo cor="verde">Ativa</Selo>
                      ) : (
                        <Selo cor="cinza">Oculta</Selo>
                      )}
                    </td>
                    <td className="px-4 py-3" data-rotulo="Estoque">
                      {semVariacoes ? (
                        <span className="text-texto-suave">—</span>
                      ) : temEsgotada ? (
                        <Selo cor="vermelho">Tem esgotado</Selo>
                      ) : (
                        <Selo cor="verde">OK</Selo>
                      )}
                    </td>
                    <td className="cel-acoes px-4 py-3">
                      <div className="flex justify-end gap-3 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() =>
                            destaqueMut.mutate({ id: p.id, destaque: !p.destaque })
                          }
                          disabled={
                            destaqueMut.isPending &&
                            destaqueMut.variables?.id === p.id
                          }
                          aria-pressed={p.destaque}
                          aria-label={
                            p.destaque
                              ? `Remover "${p.nome}" dos destaques`
                              : `Marcar "${p.nome}" como destaque`
                          }
                          className={
                            "inline-flex items-center gap-1 font-medium hover:underline disabled:opacity-50 " +
                            (p.destaque ? "text-acento-escuro" : "text-texto-suave")
                          }
                        >
                          {p.destaque ? (
                            <Star size={15} aria-hidden="true" className="fill-acento" />
                          ) : (
                            <StarOff size={15} aria-hidden="true" />
                          )}
                          {p.destaque ? "Destaque" : "Destacar"}
                        </button>
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
                          onClick={() => pedirExclusao([p])}
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
        <Paginacao
          pagina={pag.pagina}
          totalPaginas={pag.totalPaginas}
          total={pag.total}
          porPagina={pag.porPagina}
          aoMudar={pag.setPagina}
          rotuloItens="peças"
        />
        </>
      )}

      <ConfirmarExclusao
        aberto={Boolean(exclusao)}
        aoFechar={() => setExclusao(null)}
        titulo={exclusao?.titulo}
        itens={exclusao?.itens ?? []}
        resumo={exclusao?.resumo ?? ""}
        cascata={exclusao?.cascata ?? false}
        alvos={exclusao?.alvos ?? []}
        excluir={exclusao?.excluir}
        aoConcluir={aoConcluirExclusao}
      />

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
