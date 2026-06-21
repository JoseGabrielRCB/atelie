import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Eye, Plus } from "lucide-react";
import { useCategorias } from "../../hooks/useCategorias";
import { useAdminPecas } from "../../hooks/useAdminPecas";
import { useOrdenacao, ordenarPor } from "../../hooks/useOrdenacao";
import { CabecalhoOrdenavel } from "../../components/admin/CabecalhoOrdenavel";
import NovaCategoriaModal from "../../components/admin/NovaCategoriaModal";
import Modal from "../../components/admin/Modal";
import EditarPecaModal from "../../components/admin/EditarPecaModal";
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

// Largura fixa padronizada para os campos de nome de categoria (igual no modal).
const campoCategoriaClasse =
  "w-56 rounded-lg border border-borda bg-superficie px-3 py-2 text-texto placeholder:text-texto-suave focus:border-acento-escuro focus:outline-none focus:ring-2 focus:ring-acento-escuro/30";

export default function Categorias() {
  const qc = useQueryClient();
  const catQ = useCategorias();
  const pecasQ = useAdminPecas({ ordering: "nome" });

  const [erro, setErro] = useState("");
  const [modalAberto, setModalAberto] = useState(false);
  // Peça aberta para edição no modal (sem sair da tela de Categorias).
  const [pecaDetalheId, setPecaDetalheId] = useState(null);

  const ordCat = useOrdenacao("admin-categorias", { coluna: "nome", direcao: "asc" });
  const ordVit = useOrdenacao("admin-vitrine", { coluna: "nome", direcao: "asc" });

  const recarregarCategorias = () =>
    qc.invalidateQueries({ queryKey: ["categorias"] });

  const renomearMut = useMutation({
    mutationFn: ({ id, nome }) => atualizarCategoria(id, { nome }),
    onSuccess: recarregarCategorias,
    onError: (e) => setErro(e.message),
  });

  const excluirMut = useMutation({
    mutationFn: excluirCategoria,
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

        {catQ.isLoading && <Carregando texto="Carregando categorias..." />}
        {catQ.isError && (
          <Erro mensagem={catQ.error.message} aoTentarNovamente={catQ.refetch} />
        )}

        {!catQ.isLoading && categorias.length === 0 && (
          <Vazio texto="Nenhuma categoria cadastrada." />
        )}

        {categorias.length > 0 && (
          <div className="overflow-x-auto rounded-lg border border-borda">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-borda text-texto-suave">
                <tr>
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
                    onRenomear={(nome) => {
                      setErro("");
                      renomearMut.mutate({ id: c.id, nome });
                    }}
                    onExcluir={() => {
                      setErro("");
                      if (
                        window.confirm(
                          `Excluir a categoria "${c.nome}"? (Só é possível se nenhuma peça a usar.)`
                        )
                      ) {
                        excluirMut.mutate(c.id);
                      }
                    }}
                  />
                ))}
              </tbody>
            </table>
          </div>
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
                          onClick={() => setPecaDetalheId(p.id)}
                          aria-label={`Ver detalhes de ${p.nome}`}
                          className="inline-flex items-center justify-center rounded-lg border border-borda p-1.5 text-texto-suave transition hover:border-acento-escuro hover:text-acento-escuro focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acento-escuro"
                        >
                          <Eye size={18} aria-hidden="true" />
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

      <Modal
        aberto={Boolean(pecaDetalheId)}
        aoFechar={() => setPecaDetalheId(null)}
        titulo="Editar peça"
        tamanho="xl"
      >
        {pecaDetalheId && (
          <EditarPecaModal
            pecaId={pecaDetalheId}
            aoFechar={() => setPecaDetalheId(null)}
          />
        )}
      </Modal>
    </section>
  );
}

function LinhaCategoria({ categoria, salvando, onRenomear, onExcluir }) {
  const [nome, setNome] = useState(() => categoria.nome);
  const mudou = nome.trim() !== categoria.nome && nome.trim() !== "";

  return (
    <tr>
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
            Excluir
          </BotaoPerigo>
        </div>
      </td>
    </tr>
  );
}
