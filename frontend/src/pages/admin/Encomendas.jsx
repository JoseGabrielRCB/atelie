import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, X, ChevronLeft, ChevronRight } from "lucide-react";
import { useAdminEncomendas } from "../../hooks/useAdminEncomendas";
import { useOrdenacao, ordenarPor } from "../../hooks/useOrdenacao";
import { useSelecao } from "../../hooks/useSelecao";
import { CabecalhoOrdenavel } from "../../components/admin/CabecalhoOrdenavel";
import { CaixaTodos, CaixaLinha, BarraSelecao } from "../../components/admin/Selecao";
import ConfirmarExclusao from "../../components/admin/ConfirmarExclusao";
import { plural, resumoTotais } from "../../lib/exclusao";
import Modal from "../../components/admin/Modal";
import {
  obterEncomenda,
  atualizarEncomendaStatus,
  excluirEncomenda,
} from "../../lib/api";
import { Carregando, Erro, Vazio } from "../../components/Estado";
import {
  BotaoPrimario,
  BotaoPerigo,
  Feedback,
  Selo,
  inputClasse,
} from "../../components/admin/ui";

// Metadados de cada status (rótulo PT-BR + cor do selo).
const STATUS = {
  recebido: { rotulo: "Recebido", cor: "acento" },
  em_andamento: { rotulo: "Em andamento", cor: "neutro" },
  concluida: { rotulo: "Concluída", cor: "verde" },
  cancelada: { rotulo: "Cancelada", cor: "cinza" },
};
const ORDEM_STATUS = ["recebido", "em_andamento", "concluida", "cancelada"];

function dataCurta(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// Formata o contato como "(DD) NÚMERO" quando parece um telefone brasileiro.
// Remove o código do país (55) se presente; se não parecer telefone, mostra o texto original.
function formatarContato(contato) {
  if (!contato) return "—";
  let digitos = String(contato).replace(/\D/g, "");
  if (digitos.length > 11 && digitos.startsWith("55")) digitos = digitos.slice(2);
  if (digitos.length === 11)
    return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 7)}-${digitos.slice(7)}`;
  if (digitos.length === 10)
    return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 6)}-${digitos.slice(6)}`;
  return contato;
}

export default function Encomendas() {
  const qc = useQueryClient();
  const q = useAdminEncomendas();
  const [detalheId, setDetalheId] = useState(null);
  const [exclusao, setExclusao] = useState(null);
  const [erro, setErro] = useState("");
  const [ok, setOk] = useState("");
  const sel = useSelecao();
  const ord = useOrdenacao("admin-encomendas", { coluna: "criado_em", direcao: "desc" });

  const lista = ordenarPor(
    q.data ?? [],
    ord.ordenacao.coluna,
    ord.ordenacao.direcao,
    {
      nome: (e) => e.nome,
      contato: (e) => e.contato,
      prazo_desejado: (e) => e.prazo_desejado ?? "",
      status: (e) => ORDEM_STATUS.indexOf(e.status),
      criado_em: (e) => e.criado_em,
    }
  );

  const novas = lista.filter((e) => e.status === "recebido").length;
  const idsVisiveis = lista.map((e) => e.id);
  const selecionadas = lista.filter((e) => sel.estaSelecionado(e.id));

  function pedirExclusao(encomendas) {
    if (encomendas.length === 0) return;
    setErro("");
    setOk("");
    let totalImg = 0;
    const itens = encomendas.map((e) => {
      const n = (e.imagens ?? []).length;
      totalImg += n;
      return {
        chave: `enc-${e.id}`,
        titulo: `Encomenda de "${e.nome}"`,
        linhas: n ? [`${n} ${plural(n, "imagem de referência", "imagens de referência")}`] : [],
      };
    });
    setExclusao({
      titulo: encomendas.length > 1 ? "Excluir encomendas" : "Excluir encomenda",
      itens,
      resumo: resumoTotais({ encomendas: encomendas.length, imagens: totalImg }),
      cascata: false,
      confirmacaoTexto: null,
      alvos: encomendas.map((e) => ({ id: e.id, rotulo: `Encomenda de "${e.nome}"` })),
      excluir: excluirEncomenda,
    });
  }

  function aoConcluirExclusao({ sucesso, falhas }) {
    qc.invalidateQueries({ queryKey: ["admin", "encomendas"] });
    sel.limpar();
    if (falhas.length === 0) setOk(`${sucesso} encomenda(s) excluída(s).`);
    else setErro(`${falhas.length} encomenda(s) não puderam ser excluídas.`);
  }

  return (
    <section>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-semibold">Encomendas</h1>
        {novas > 0 && <Selo cor="acento">{novas} nova(s)</Selo>}
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

      {q.isLoading && <Carregando texto="Carregando encomendas..." />}
      {q.isError && <Erro mensagem={q.error.message} aoTentarNovamente={q.refetch} />}
      {!q.isLoading && !q.isError && lista.length === 0 && (
        <Vazio texto="Nenhuma encomenda recebida ainda." />
      )}

      {lista.length > 0 && (
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
                    ids={idsVisiveis}
                    estaSelecionado={sel.estaSelecionado}
                    definirVarios={sel.definirVarios}
                    rotulo="Selecionar todas as encomendas"
                  />
                </th>
                <CabecalhoOrdenavel coluna="nome" rotulo="Cliente" ordenacao={ord.ordenacao} aoOrdenar={ord.alternar} />
                <CabecalhoOrdenavel coluna="contato" rotulo="Contato" ordenacao={ord.ordenacao} aoOrdenar={ord.alternar} />
                <CabecalhoOrdenavel coluna="prazo_desejado" rotulo="Prazo" ordenacao={ord.ordenacao} aoOrdenar={ord.alternar} />
                <CabecalhoOrdenavel coluna="status" rotulo="Status" ordenacao={ord.ordenacao} aoOrdenar={ord.alternar} />
                <CabecalhoOrdenavel coluna="criado_em" rotulo="Recebida em" ordenacao={ord.ordenacao} aoOrdenar={ord.alternar} />
                <th className="px-4 py-3 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-borda">
              {lista.map((e) => (
                <tr
                  key={e.id}
                  className={
                    sel.estaSelecionado(e.id)
                      ? "bg-acento/10"
                      : e.status === "recebido"
                      ? "bg-acento/5"
                      : ""
                  }
                >
                  <td className="px-4 py-3">
                    <CaixaLinha
                      id={e.id}
                      estaSelecionado={sel.estaSelecionado}
                      alternar={sel.alternar}
                      rotulo={`Selecionar encomenda de ${e.nome}`}
                    />
                  </td>
                  <td className="px-4 py-3 font-medium text-texto">{e.nome}</td>
                  <td className="px-4 py-3 text-texto-suave">{formatarContato(e.contato)}</td>
                  <td className="px-4 py-3 text-texto-suave">{dataCurta(e.prazo_desejado)}</td>
                  <td className="px-4 py-3">
                    <Selo cor={STATUS[e.status]?.cor ?? "neutro"}>
                      {STATUS[e.status]?.rotulo ?? e.status}
                    </Selo>
                  </td>
                  <td className="px-4 py-3 text-texto-suave">{dataCurta(e.criado_em)}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => setDetalheId(e.id)}
                        aria-label={`Ver detalhes da encomenda de ${e.nome}`}
                        className="inline-flex items-center justify-center rounded-lg border border-borda p-1.5 text-texto-suave transition hover:border-acento-escuro hover:text-acento-escuro focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acento-escuro"
                      >
                        <Eye size={18} aria-hidden="true" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
      )}

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

      <Modal
        aberto={Boolean(detalheId)}
        aoFechar={() => setDetalheId(null)}
        titulo="Detalhes da encomenda"
        tamanho="xl"
      >
        {detalheId && (
          <DetalheEncomenda id={detalheId} aoFechar={() => setDetalheId(null)} />
        )}
      </Modal>
    </section>
  );
}

function DetalheEncomenda({ id, aoFechar }) {
  const qc = useQueryClient();
  const [erro, setErro] = useState("");
  const [ok, setOk] = useState("");
  const [lightbox, setLightbox] = useState(null); // índice da imagem aberta

  const detalheQ = useQuery({
    queryKey: ["admin", "encomenda", String(id)],
    queryFn: () => obterEncomenda(id),
  });

  const invalidar = () =>
    qc.invalidateQueries({ queryKey: ["admin", "encomendas"] });

  const statusMut = useMutation({
    mutationFn: (status) => atualizarEncomendaStatus(id, status),
    onSuccess: () => {
      invalidar();
      qc.invalidateQueries({ queryKey: ["admin", "encomenda", String(id)] });
      setOk("Status atualizado.");
    },
    onError: (e) => setErro(e.message),
  });

  const excluirMut = useMutation({
    mutationFn: () => excluirEncomenda(id),
    onSuccess: () => {
      invalidar();
      aoFechar();
    },
    onError: (e) => setErro(e.message),
  });

  if (detalheQ.isLoading) return <Carregando texto="Carregando..." />;
  if (detalheQ.isError)
    return <Erro mensagem={detalheQ.error.message} aoTentarNovamente={detalheQ.refetch} />;

  const e = detalheQ.data;
  const imagens = e.imagens ?? [];

  return (
    <div className="space-y-5">
      <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
        <Linha rotulo="Cliente" valor={e.nome} />
        <Linha rotulo="Contato" valor={formatarContato(e.contato)} />
        <Linha rotulo="Prazo desejado" valor={dataCurta(e.prazo_desejado)} />
        <Linha rotulo="Recebida em" valor={dataCurta(e.criado_em)} />
        <Linha rotulo="Tamanho/medidas" valor={e.tamanho_medidas || "—"} />
      </dl>

      <div>
        <p className="text-sm font-medium text-texto-suave">Descrição</p>
        <p className="mt-1 whitespace-pre-line text-texto">{e.descricao}</p>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-texto-suave">
          Imagens de referência ({imagens.length})
        </p>
        {imagens.length === 0 ? (
          <p className="text-sm text-texto-suave">Nenhuma imagem enviada.</p>
        ) : (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            {imagens.map((img, i) => (
              <button
                key={img.id}
                type="button"
                onClick={() => setLightbox(i)}
                aria-label={`Ampliar imagem ${i + 1}`}
                className="block overflow-hidden rounded-lg border border-borda focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acento-escuro"
              >
                <img
                  src={img.arquivo}
                  alt="Referência da encomenda"
                  className="aspect-square w-full object-cover transition hover:opacity-90"
                />
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-borda pt-4">
        <label htmlFor="enc-status" className="mb-1 block text-sm font-medium text-texto">
          Status
        </label>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <select
            id="enc-status"
            defaultValue={e.status}
            onChange={(ev) => {
              setErro("");
              setOk("");
              statusMut.mutate(ev.target.value);
            }}
            disabled={statusMut.isPending}
            className={inputClasse + " sm:max-w-xs"}
          >
            {ORDEM_STATUS.map((s) => (
              <option key={s} value={s}>
                {STATUS[s].rotulo}
              </option>
            ))}
          </select>
          {ok && <Feedback tipo="sucesso">{ok}</Feedback>}
        </div>
      </div>

      {erro && <Feedback tipo="erro">{erro}</Feedback>}

      <div className="flex flex-col gap-3 border-t border-borda pt-4 sm:flex-row sm:justify-between">
        <BotaoPerigo
          type="button"
          disabled={excluirMut.isPending}
          onClick={() => {
            setErro("");
            if (window.confirm("Excluir esta encomenda? Esta ação não pode ser desfeita.")) {
              excluirMut.mutate();
            }
          }}
        >
          Excluir encomenda
        </BotaoPerigo>
        <BotaoPrimario type="button" onClick={aoFechar}>
          Fechar
        </BotaoPrimario>
      </div>

      {lightbox !== null && (
        <LightboxImagens
          imagens={imagens}
          indice={lightbox}
          aoFechar={() => setLightbox(null)}
          aoNavegar={(delta) =>
            setLightbox((i) => (i + delta + imagens.length) % imagens.length)
          }
        />
      )}
    </div>
  );
}

// Visualização ampliada (popup) das imagens da encomenda, com setas e Esc.
// Portal em document.body (irmão do modal de detalhe), então o Esc daqui não
// fecha o modal por baixo. O foco entra no popup ao abrir.
function LightboxImagens({ imagens, indice, aoFechar, aoNavegar }) {
  const fecharRef = useRef(null);

  useEffect(() => {
    fecharRef.current?.focus();
    function aoTeclar(e) {
      if (e.key === "Escape") aoFechar();
      else if (e.key === "ArrowLeft") aoNavegar(-1);
      else if (e.key === "ArrowRight") aoNavegar(1);
    }
    document.addEventListener("keydown", aoTeclar);
    return () => document.removeEventListener("keydown", aoTeclar);
  }, [aoFechar, aoNavegar]);

  const img = imagens[indice];
  if (!img) return null;
  const total = imagens.length;
  const btn =
    "absolute top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-texto shadow transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acento-escuro";

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) aoFechar();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={`Imagem ${indice + 1} de ${total}`}
    >
      <button
        ref={fecharRef}
        type="button"
        onClick={aoFechar}
        aria-label="Fechar"
        className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-texto shadow transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acento-escuro"
      >
        <X size={22} aria-hidden="true" />
      </button>

      {total > 1 && (
        <button
          type="button"
          onClick={() => aoNavegar(-1)}
          aria-label="Imagem anterior"
          className={btn + " left-4"}
        >
          <ChevronLeft size={24} aria-hidden="true" />
        </button>
      )}

      <img
        src={img.arquivo}
        alt={`Referência ${indice + 1} de ${total}`}
        className="max-h-[88vh] max-w-full rounded-lg object-contain"
      />

      {total > 1 && (
        <button
          type="button"
          onClick={() => aoNavegar(1)}
          aria-label="Próxima imagem"
          className={btn + " right-4"}
        >
          <ChevronRight size={24} aria-hidden="true" />
        </button>
      )}

      {total > 1 && (
        <span className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded bg-black/60 px-3 py-1 text-sm font-medium text-white">
          {indice + 1}/{total}
        </span>
      )}
    </div>,
    document.body
  );
}

function Linha({ rotulo, valor }) {
  return (
    <div>
      <dt className="text-sm font-medium text-texto-suave">{rotulo}</dt>
      <dd className="text-texto">{valor}</dd>
    </div>
  );
}
