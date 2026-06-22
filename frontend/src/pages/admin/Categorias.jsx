import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Eye, Pencil, Plus, Trash2 } from "lucide-react";
import { useCategorias } from "../../hooks/useCategorias";
import { useAdminPecas } from "../../hooks/useAdminPecas";
import { useOrdenacao, ordenarPor } from "../../hooks/useOrdenacao";
import { useSelecao } from "../../hooks/useSelecao";
import { CabecalhoOrdenavel } from "../../components/admin/CabecalhoOrdenavel";
import NovaCategoriaModal from "../../components/admin/NovaCategoriaModal";
import Modal from "../../components/admin/Modal";
import EditarPecaModal from "../../components/admin/EditarPecaModal";
import DetalhePecaModal from "../../components/admin/DetalhePecaModal";
import ConfirmarExclusao from "../../components/admin/ConfirmarExclusao";
import { CaixaTodos, CaixaLinha, BarraSelecao } from "../../components/admin/Selecao";
import { descreverPeca, resumoTotais } from "../../lib/exclusao";
import {
  atualizarCategoria,
  excluirCategoria,
  atualizarPeca,
} from "../../lib/api";
import { Carregando, Erro, Vazio } from "../../components/Estado";
import {
  BotaoPrimario,
  BotaoPerigo,
  Feedback,
  Selo,
} from "../../components/admin/ui";

// Monta o plano de exclusão (itens agrupados + resumo + cascata) de categorias,
// usando a lista de peças já carregada para listar os dependentes em cascata.
function planoCategorias(cats, pecasTodas) {
  let totalPecas = 0;
  let totalVar = 0;
  let totalImg = 0;
  const itens = cats.map((c) => {
    const pecasCat = pecasTodas.filter((p) => p.categoria === c.id);
    totalPecas += pecasCat.length;
    pecasCat.forEach((p) => {
      totalVar += (p.variacoes ?? []).length;
      totalImg += (p.imagens ?? []).length;
    });
    return {
      chave: `cat-${c.id}`,
      titulo: `Categoria "${c.nome}"`,
      vazio: pecasCat.length === 0,
      linhas: pecasCat.map(descreverPeca),
    };
  });
  return {
    itens,
    resumo: resumoTotais({
      categorias: cats.length,
      pecas: totalPecas,
      variacoes: totalVar,
      imagens: totalImg,
    }),
    cascata: totalPecas > 0,
  };
}

// Largura fixa padronizada para os campos de nome de categoria (igual no modal).
const campoCategoriaClasse =
  "w-56 rounded-lg border border-borda bg-superficie px-3 py-2 text-texto placeholder:text-texto-suave focus:border-acento-escuro focus:outline-none focus:ring-2 focus:ring-acento-escuro/30";

export default function Categorias() {
  const qc = useQueryClient();
  const catQ = useCategorias();
  const pecasQ = useAdminPecas({ ordering: "nome" });

  const [erro, setErro] = useState("");
  const [ok, setOk] = useState("");
  const [modalAberto, setModalAberto] = useState(false);
  // Peça aberta em VISUALIZAÇÃO (olho, só leitura) ou em EDIÇÃO (lápis).
  const [pecaVerId, setPecaVerId] = useState(null);
  const [pecaEditarId, setPecaEditarId] = useState(null);
  // Pedido de exclusão atual (single ou em massa) para o modal de confirmação.
  const [exclusao, setExclusao] = useState(null);

  const sel = useSelecao();

  const ordCat = useOrdenacao("admin-categorias", { coluna: "nome", direcao: "asc" });
  const ordVit = useOrdenacao("admin-vitrine", { coluna: "nome", direcao: "asc" });

  const recarregarCategorias = () =>
    qc.invalidateQueries({ queryKey: ["categorias"] });

  const renomearMut = useMutation({
    mutationFn: ({ id, nome }) => atualizarCategoria(id, { nome }),
    onSuccess: recarregarCategorias,
    onError: (e) => setErro(e.message),
  });

  const ativoMut = useMutation({
    mutationFn: ({ id, ativo }) => atualizarPeca(id, { ativo }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "pecas"] }),
    onError: (e) => setErro(e.message),
  });

  const categorias = ordenarPor(
    catQ.data ?? [],
    ordCat.ordenacao.coluna,
    ordCat.ordenacao.direcao,
    { nome: (c) => c.nome }
  );

  const pecas = ordenarPor(
    pecasQ.data ?? [],
    ordVit.ordenacao.coluna,
    ordVit.ordenacao.direcao,
    {
      nome: (p) => p.nome,
      categoria: (p) => p.categoria_nome,
      ativo: (p) => (p.ativo ? 1 : 0),
    }
  );

  const idsCategorias = categorias.map((c) => c.id);
  const pecasTodas = pecasQ.data ?? [];

  // Abre o modal de confirmação para uma ou várias categorias.
  function pedirExclusao(cats) {
    if (cats.length === 0) return;
    setErro("");
    setOk("");
    const { itens, resumo, cascata } = planoCategorias(cats, pecasTodas);
    setExclusao({
      titulo: cats.length > 1 ? "Excluir categorias" : "Excluir categoria",
      itens,
      resumo,
      cascata,
      // Single: digitar o nome da categoria; em massa: digitar EXCLUIR.
      confirmacaoTexto: cats.length === 1 ? cats[0].nome : "EXCLUIR",
      alvos: cats.map((c) => ({ id: c.id, rotulo: `Categoria "${c.nome}"` })),
      excluir: excluirCategoria,
    });
  }

  function aoConcluirExclusao({ sucesso, falhas }) {
    recarregarCategorias();
    qc.invalidateQueries({ queryKey: ["admin", "pecas"] });
    sel.limpar();
    if (falhas.length === 0) setOk(`${sucesso} item(ns) excluído(s).`);
    else setErro(`${falhas.length} item(ns) não puderam ser excluídos.`);
  }

  const selecionadas = categorias.filter((c) => sel.estaSelecionado(c.id));

  return (
    <section className="space-y-10">
      <div>
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-display text-3xl font-semibold">Categorias</h1>
          <BotaoPrimario
            type="button"
            onClick={() => {
              setErro("");
              setModalAberto(true);
            }}
          >
            <Plus size={18} aria-hidden="true" />
            Nova categoria
          </BotaoPrimario>
        </div>

        {erro && (
          <div className="mb-4">
            <Feedback tipo="erro">{erro}</Feedback>
          </div>
        )}
        {ok && (
          <div className="mb-4">
            <Feedback tipo="sucesso">{ok}</Feedback>
          </div>
        )}

        {catQ.isLoading && <Carregando texto="Carregando categorias..." />}
        {catQ.isError && (
          <Erro mensagem={catQ.error.message} aoTentarNovamente={catQ.refetch} />
        )}

        {!catQ.isLoading && categorias.length === 0 && (
          <Vazio texto="Nenhuma categoria cadastrada." />
        )}

        {categorias.length > 0 && (
          <>
            <BarraSelecao
              quantidade={sel.quantidade}
              aoExcluir={() => pedirExclusao(selecionadas)}
              aoLimpar={sel.limpar}
            />
            <div className="overflow-x-auto rounded-lg border border-borda">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-borda text-texto-suave">
                  <tr>
                    <th className="w-10 px-4 py-3">
                      <CaixaTodos
                        ids={idsCategorias}
                        estaSelecionado={sel.estaSelecionado}
                        definirVarios={sel.definirVarios}
                        rotulo="Selecionar todas as categorias"
                      />
                    </th>
                    <CabecalhoOrdenavel
                      coluna="nome"
                      rotulo="Categoria"
                      ordenacao={ordCat.ordenacao}
                      aoOrdenar={ordCat.alternar}
                    />
                    <th className="px-4 py-3 font-medium">Atalho</th>
                    <th className="px-4 py-3 font-medium text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-borda">
                  {categorias.map((c) => (
                    <LinhaCategoria
                      key={c.id}
                      categoria={c}
                      salvando={renomearMut.isPending}
                      selecionada={sel.estaSelecionado(c.id)}
                      caixa={
                        <CaixaLinha
                          id={c.id}
                          estaSelecionado={sel.estaSelecionado}
                          alternar={sel.alternar}
                          rotulo={`Selecionar categoria ${c.nome}`}
                        />
                      }
                      onRenomear={(nome) => {
                        setErro("");
                        renomearMut.mutate({ id: c.id, nome });
                      }}
                      onExcluir={() => pedirExclusao([c])}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Controle da vitrine */}
      <div>
        <h2 className="mb-1 font-display text-2xl font-semibold">Vitrine</h2>
        <p className="mb-4 text-sm text-texto-suave">
          Mostre ou oculte peças rapidamente na vitrine pública.
        </p>

        {pecasQ.isLoading && <Carregando texto="Carregando peças..." />}
        {pecasQ.isError && (
          <Erro
            mensagem={pecasQ.error.message}
            aoTentarNovamente={pecasQ.refetch}
          />
        )}
        {!pecasQ.isLoading && pecas.length === 0 && (
          <Vazio texto="Nenhuma peça cadastrada." />
        )}

        {pecas.length > 0 && (
          <div className="overflow-x-auto rounded-lg border border-borda">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-borda text-texto-suave">
                <tr>
                  <CabecalhoOrdenavel
                    coluna="nome"
                    rotulo="Peça"
                    ordenacao={ordVit.ordenacao}
                    aoOrdenar={ordVit.alternar}
                  />
                  <CabecalhoOrdenavel
                    coluna="categoria"
                    rotulo="Categoria"
                    ordenacao={ordVit.ordenacao}
                    aoOrdenar={ordVit.alternar}
                  />
                  <CabecalhoOrdenavel
                    coluna="ativo"
                    rotulo="Status"
                    ordenacao={ordVit.ordenacao}
                    aoOrdenar={ordVit.alternar}
                  />
                  <th className="px-4 py-3 font-medium text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-borda">
                {pecas.map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-texto">{p.nome}</p>
                    </td>
                    <td className="px-4 py-3 text-texto-suave">
                      {p.categoria_nome}
                    </td>
                    <td className="px-4 py-3">
                      {p.ativo ? (
                        <Selo cor="verde">Ativa</Selo>
                      ) : (
                        <Selo cor="cinza">Oculta</Selo>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setPecaVerId(p.id)}
                          aria-label={`Ver detalhes de ${p.nome}`}
                          className="inline-flex items-center justify-center rounded-lg border border-borda p-1.5 text-texto-suave transition hover:border-acento-escuro hover:text-acento-escuro focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acento-escuro"
                        >
                          <Eye size={18} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setPecaEditarId(p.id)}
                          aria-label={`Editar ${p.nome}`}
                          className="inline-flex items-center justify-center rounded-lg border border-borda p-1.5 text-texto-suave transition hover:border-acento-escuro hover:text-acento-escuro focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acento-escuro"
                        >
                          <Pencil size={18} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          disabled={ativoMut.isPending}
                          onClick={() => {
                            setErro("");
                            ativoMut.mutate({ id: p.id, ativo: !p.ativo });
                          }}
                          className="rounded-lg border border-borda px-3 py-1.5 text-sm text-texto transition hover:border-acento-escuro focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acento-escuro disabled:opacity-50"
                        >
                          {p.ativo ? "Ocultar" : "Mostrar"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <NovaCategoriaModal
        aberto={modalAberto}
        aoFechar={() => setModalAberto(false)}
      />

      {/* Olho: visualização só leitura. */}
      <Modal
        aberto={Boolean(pecaVerId)}
        aoFechar={() => setPecaVerId(null)}
        titulo="Detalhes da peça"
        tamanho="xl"
      >
        {pecaVerId && <DetalhePecaModal pecaId={pecaVerId} />}
      </Modal>

      {/* Lápis: edição. */}
      <Modal
        aberto={Boolean(pecaEditarId)}
        aoFechar={() => setPecaEditarId(null)}
        titulo="Editar peça"
        tamanho="xl"
      >
        {pecaEditarId && (
          <EditarPecaModal
            pecaId={pecaEditarId}
            aoFechar={() => setPecaEditarId(null)}
          />
        )}
      </Modal>

      <ConfirmarExclusao
        aberto={Boolean(exclusao)}
        aoFechar={() => setExclusao(null)}
        titulo={exclusao?.titulo}
        itens={exclusao?.itens ?? []}
        resumo={exclusao?.resumo ?? ""}
        cascata={exclusao?.cascata ?? false}
        confirmacaoTexto={exclusao?.confirmacaoTexto ?? null}
        alvos={exclusao?.alvos ?? []}
        excluir={exclusao?.excluir}
        aoConcluir={aoConcluirExclusao}
      />
    </section>
  );
}

function LinhaCategoria({ categoria, salvando, selecionada, caixa, onRenomear, onExcluir }) {
  const [nome, setNome] = useState(() => categoria.nome);
  const mudou = nome.trim() !== categoria.nome && nome.trim() !== "";

  return (
    <tr className={selecionada ? "bg-acento/5" : ""}>
      <td className="px-4 py-3">{caixa}</td>
      <td className="px-4 py-3">
        <input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          aria-label={`Nome da categoria ${categoria.nome}`}
          className={campoCategoriaClasse}
        />
      </td>
      <td className="px-4 py-3 text-xs text-texto-suave">/{categoria.slug}</td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            disabled={!mudou || salvando}
            onClick={() => onRenomear(nome.trim())}
            className="rounded-lg border border-borda px-3 py-1.5 text-sm text-texto transition hover:border-acento-escuro focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acento-escuro disabled:opacity-40"
          >
            Salvar
          </button>
          <BotaoPerigo type="button" onClick={onExcluir}>
            <Trash2 size={15} aria-hidden="true" />
            Excluir
          </BotaoPerigo>
        </div>
      </td>
    </tr>
  );
}
