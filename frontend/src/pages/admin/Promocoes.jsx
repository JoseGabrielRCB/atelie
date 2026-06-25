import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Power, Check, Trash2, Eye } from "lucide-react";
import {
  listarPromocoes,
  criarPromocao,
  atualizarPromocao,
  excluirPromocao,
} from "../../lib/api";
import { useAdminPecas } from "../../hooks/useAdminPecas";
import { useCategorias } from "../../hooks/useCategorias";
import { useOrdenacao, ordenarPor } from "../../hooks/useOrdenacao";
import { usePaginacao } from "../../hooks/usePaginacao";
import { CabecalhoOrdenavel, OrdenarMobile } from "../../components/admin/CabecalhoOrdenavel";
import { Paginacao } from "../../components/admin/Paginacao";
import Modal from "../../components/admin/Modal";
import ConfirmarExclusao from "../../components/admin/ConfirmarExclusao";
import CampoPreco from "../../components/admin/CampoPreco";
import Preco from "../../components/Preco";
import { valorParaCentavos, centavosParaDecimal } from "../../lib/moeda";
import { Carregando, Erro, Vazio } from "../../components/Estado";
import {
  BotaoPrimario,
  BotaoSecundario,
  Campo,
  Feedback,
  Selo,
  inputClasse,
} from "../../components/admin/ui";

const ROTULO_APLICACAO = { cupom: "Cupom", automatica: "Automática" };
const ROTULO_ESCOPO = { tudo: "Tudo", peca: "Peça", categoria: "Categoria" };

function formatarDesconto(p) {
  const v = Number(p.valor);
  return p.tipo_desconto === "percentual"
    ? `${v.toLocaleString("pt-BR")}%`
    : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatarUsos(p) {
  return p.limite_uso != null ? `${p.usos}/${p.limite_uso}` : String(p.usos);
}

// Lista de nomes do escopo: mostra só os 5 primeiros (com "…" se houver mais),
// para a célula não ficar enorme quando a promoção abrange muitas peças/categorias.
function listaCurta(nomes, max = 5) {
  if (!nomes?.length) return "";
  const inicio = nomes.slice(0, max).join(", ");
  return nomes.length > max ? `${inicio}…` : inicio;
}

// ISO (com tz) → valor de <input type="datetime-local"> ("YYYY-MM-DDTHH:mm").
function paraLocal(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function Promocoes() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin", "promocoes"], queryFn: listarPromocoes });
  const [busca, setBusca] = useState("");
  const [editando, setEditando] = useState(null); // promo | "nova" | null
  const [exclusao, setExclusao] = useState(null);
  const [detalhe, setDetalhe] = useState(null);
  const [erro, setErro] = useState("");
  const [ok, setOk] = useState("");
  const ord = useOrdenacao("admin-promocoes", { coluna: "criado_em", direcao: "desc" });

  const invalidar = () => {
    qc.invalidateQueries({ queryKey: ["admin", "promocoes"] });
    // Promoção automática muda o preço de exibição da vitrine.
    qc.invalidateQueries({ queryKey: ["pecas"] });
  };

  const ativoMut = useMutation({
    mutationFn: ({ id, ativo }) => atualizarPromocao(id, { ativo }),
    onSuccess: invalidar,
    onError: (e) => setErro(e.message),
  });

  const todas = q.data ?? [];
  const filtradas = busca.trim()
    ? todas.filter((p) =>
        `${p.nome} ${p.codigo ?? ""}`.toLowerCase().includes(busca.trim().toLowerCase())
      )
    : todas;
  const lista = ordenarPor(filtradas, ord.ordenacao.coluna, ord.ordenacao.direcao, {
    nome: (p) => p.nome,
    tipo_aplicacao: (p) => p.tipo_aplicacao,
    codigo: (p) => p.codigo ?? "",
    ativo: (p) => (p.ativo ? 1 : 0),
    usos: (p) => p.usos,
    criado_em: (p) => p.criado_em ?? "",
  });
  const pag = usePaginacao(lista, {
    resetKey: `${busca}|${ord.ordenacao.coluna}|${ord.ordenacao.direcao}`,
  });

  return (
    <section>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-semibold">Promoções</h1>
        <BotaoPrimario type="button" onClick={() => { setErro(""); setOk(""); setEditando("nova"); }}>
          <Plus size={18} aria-hidden="true" />
          Nova promoção
        </BotaoPrimario>
      </div>

      <p className="mb-4 text-sm text-texto-suave">
        <strong className="text-texto">Cupom</strong>: o cliente digita o código no checkout.{" "}
        <strong className="text-texto">Automática</strong>: aplica sozinha ao preço das peças no escopo.
        O desconto é sempre calculado no servidor.
      </p>

      <div className="mb-4 max-w-sm">
        <input
          type="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Ex.: nome ou código"
          aria-label="Buscar promoção"
          className={inputClasse}
        />
      </div>

      {erro && <div className="mb-4"><Feedback tipo="erro">{erro}</Feedback></div>}
      {ok && <div className="mb-4"><Feedback tipo="sucesso">{ok}</Feedback></div>}

      {q.isLoading && <Carregando texto="Carregando promoções..." />}
      {q.isError && <Erro mensagem={q.error.message} aoTentarNovamente={q.refetch} />}
      {!q.isLoading && !q.isError && lista.length === 0 && (
        <Vazio texto="Nenhuma promoção cadastrada ainda." />
      )}

      {lista.length > 0 && (
        <>
          <OrdenarMobile
            className="mb-3"
            ordenacao={ord.ordenacao}
            aoOrdenar={ord.alternar}
            colunas={[
              { coluna: "nome", rotulo: "Nome" },
              { coluna: "tipo_aplicacao", rotulo: "Tipo" },
              { coluna: "ativo", rotulo: "Status" },
              { coluna: "usos", rotulo: "Usos" },
            ]}
          />
          <div className="sm:overflow-x-auto sm:rounded-lg sm:border sm:border-borda">
            <table className="tabela-cartoes w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-borda text-texto-suave">
                <tr>
                  <CabecalhoOrdenavel coluna="nome" rotulo="Nome" ordenacao={ord.ordenacao} aoOrdenar={ord.alternar} />
                  <CabecalhoOrdenavel coluna="tipo_aplicacao" rotulo="Tipo" ordenacao={ord.ordenacao} aoOrdenar={ord.alternar} />
                  <th className="px-4 py-3 font-medium">Código</th>
                  <th className="px-4 py-3 font-medium">Desconto</th>
                  <th className="px-4 py-3 font-medium">Escopo</th>
                  <CabecalhoOrdenavel coluna="ativo" rotulo="Status" ordenacao={ord.ordenacao} aoOrdenar={ord.alternar} />
                  <CabecalhoOrdenavel coluna="usos" rotulo="Usos" ordenacao={ord.ordenacao} aoOrdenar={ord.alternar} />
                  <th className="px-4 py-3 font-medium text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-borda">
                {pag.itensPagina.map((p) => {
                  const ocupado = ativoMut.isPending && ativoMut.variables?.id === p.id;
                  return (
                    <tr key={p.id} className={p.ativo ? "" : "bg-borda/20"}>
                      <td className="cel-principal px-4 py-3 font-medium text-texto">
                        <span className="block max-w-[16rem] truncate" title={p.nome}>{p.nome}</span>
                      </td>
                      <td className="px-4 py-3 text-texto-suave" data-rotulo="Tipo">
                        {ROTULO_APLICACAO[p.tipo_aplicacao] ?? p.tipo_aplicacao}
                      </td>
                      <td className="px-4 py-3 font-mono text-texto-suave" data-rotulo="Código">
                        {p.codigo || "—"}
                      </td>
                      <td className="px-4 py-3 text-texto" data-rotulo="Desconto">{formatarDesconto(p)}</td>
                      <td
                        className="px-4 py-3 text-texto-suave"
                        data-rotulo="Escopo"
                        title={
                          p.escopo === "peca"
                            ? p.pecas_nomes?.join(", ")
                            : p.escopo === "categoria"
                            ? p.categorias_nomes?.join(", ")
                            : undefined
                        }
                      >
                        {ROTULO_ESCOPO[p.escopo]}
                        {p.escopo === "peca" && p.pecas_nomes?.length
                          ? `: ${listaCurta(p.pecas_nomes)}`
                          : ""}
                        {p.escopo === "categoria" && p.categorias_nomes?.length
                          ? `: ${listaCurta(p.categorias_nomes)}`
                          : ""}
                      </td>
                      <td className="px-4 py-3" data-rotulo="Status">
                        {p.ativo ? <Selo cor="verde">Ativa</Selo> : <Selo cor="cinza">Inativa</Selo>}
                      </td>
                      <td className="px-4 py-3 text-texto-suave" data-rotulo="Usos">{formatarUsos(p)}</td>
                      <td className="cel-acoes px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setDetalhe(p)}
                            aria-label={`Ver detalhes de ${p.nome}`}
                            title="Ver detalhes"
                            className="inline-flex items-center justify-center rounded-lg border border-borda p-1.5 text-texto-suave transition hover:border-acento-escuro hover:text-acento-escuro focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acento-escuro"
                          >
                            <Eye size={16} aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={() => { setErro(""); setOk(""); setEditando(p); }}
                            aria-label={`Editar ${p.nome}`}
                            title="Editar"
                            className="inline-flex items-center justify-center rounded-lg border border-borda p-1.5 text-texto-suave transition hover:border-acento-escuro hover:text-acento-escuro focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acento-escuro"
                          >
                            <Pencil size={16} aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            disabled={ocupado}
                            onClick={() => ativoMut.mutate({ id: p.id, ativo: !p.ativo })}
                            aria-label={p.ativo ? `Desativar ${p.nome}` : `Ativar ${p.nome}`}
                            title={p.ativo ? "Desativar" : "Ativar"}
                            className={
                              "inline-flex items-center justify-center rounded-lg border p-1.5 transition focus-visible:outline-none focus-visible:ring-2 disabled:opacity-50 " +
                              (p.ativo
                                ? "border-borda text-texto-suave hover:border-acento-escuro hover:text-acento-escuro focus-visible:ring-acento-escuro"
                                : "border-sucesso/40 text-sucesso hover:bg-sucesso/10 focus-visible:ring-sucesso")
                            }
                          >
                            {p.ativo ? <Power size={16} aria-hidden="true" /> : <Check size={16} aria-hidden="true" />}
                          </button>
                          <button
                            type="button"
                            onClick={() => { setErro(""); setOk(""); setExclusao(p); }}
                            aria-label={`Excluir ${p.nome}`}
                            title="Excluir"
                            className="inline-flex items-center justify-center rounded-lg border border-erro/40 p-1.5 text-erro transition hover:bg-erro/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-erro"
                          >
                            <Trash2 size={16} aria-hidden="true" />
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
            rotuloItens="promoções"
          />
        </>
      )}

      <DetalhePromocao
        promo={detalhe}
        aoFechar={() => setDetalhe(null)}
        aoEditar={(p) => { setDetalhe(null); setErro(""); setOk(""); setEditando(p); }}
      />

      <FormPromocao
        aberto={Boolean(editando)}
        promo={editando === "nova" ? null : editando}
        aoFechar={() => setEditando(null)}
        aoSalvar={() => { invalidar(); setOk("Promoção salva."); setEditando(null); }}
      />

      <ConfirmarExclusao
        aberto={Boolean(exclusao)}
        aoFechar={() => setExclusao(null)}
        titulo="Excluir promoção"
        itens={exclusao ? [{ chave: `promo-${exclusao.id}`, titulo: `Promoção "${exclusao.nome}"` }] : []}
        alvos={exclusao ? [{ id: exclusao.id, rotulo: exclusao.nome }] : []}
        excluir={excluirPromocao}
        aoConcluir={({ falhas }) => {
          invalidar();
          if (falhas.length) setErro("Não foi possível excluir a promoção.");
          else setOk("Promoção excluída.");
        }}
      />
    </section>
  );
}

// Situação de vigência (para o detalhe): em vigência ou o motivo de não estar.
function situacaoVigencia(p) {
  if (!p.ativo) return { ok: false, texto: "Inativa" };
  const agora = new Date();
  if (p.inicio && new Date(p.inicio) > agora)
    return { ok: false, texto: `Programada — começa em ${dataLegivel(paraLocal(p.inicio))}` };
  if (p.fim && new Date(p.fim) < agora) return { ok: false, texto: "Encerrada" };
  if (p.limite_uso != null && p.usos >= p.limite_uso)
    return { ok: false, texto: "Limite de usos atingido" };
  return { ok: true, texto: "Em vigência agora" };
}

function LinhaDet({ rotulo, children }) {
  return (
    <div className="grid grid-cols-[8rem_1fr] gap-2 py-1.5">
      <dt className="text-sm text-texto-suave">{rotulo}</dt>
      <dd className="text-sm text-texto">{children}</dd>
    </div>
  );
}

// Modal somente-leitura com os detalhes completos da promoção.
function DetalhePromocao({ promo, aoFechar, aoEditar }) {
  if (!promo) return null;
  const sit = situacaoVigencia(promo);
  const nomes = promo.escopo === "peca" ? promo.pecas_nomes : promo.categorias_nomes;
  const periodo =
    promo.inicio || promo.fim
      ? `${promo.inicio ? dataLegivel(paraLocal(promo.inicio)) : "início imediato"} → ${
          promo.fim ? dataLegivel(paraLocal(promo.fim)) : "sem data de fim"
        }`
      : "Sem período definido (vale enquanto ativa)";

  return (
    <Modal aberto={Boolean(promo)} aoFechar={aoFechar} titulo={promo.nome} tamanho="md">
      <dl className="divide-y divide-borda">
        <LinhaDet rotulo="Situação">
          {promo.ativo ? <Selo cor="verde">Ativa</Selo> : <Selo cor="cinza">Inativa</Selo>}{" "}
          <span className={sit.ok ? "text-sucesso" : "text-texto-suave"}>{sit.texto}</span>
        </LinhaDet>
        <LinhaDet rotulo="Tipo">
          {ROTULO_APLICACAO[promo.tipo_aplicacao] ?? promo.tipo_aplicacao}
          {promo.tipo_aplicacao === "cupom" && promo.codigo ? (
            <> · código <span className="font-mono font-medium">{promo.codigo}</span></>
          ) : null}
        </LinhaDet>
        <LinhaDet rotulo="Desconto">{formatarDesconto(promo)}</LinhaDet>
        <LinhaDet rotulo="Escopo">
          {ROTULO_ESCOPO[promo.escopo]}
          {nomes?.length ? (
            <ul className="mt-1 max-h-40 list-disc overflow-y-auto pl-5">
              {nomes.map((n) => <li key={n}>{n}</li>)}
            </ul>
          ) : promo.escopo === "tudo" ? (
            <span className="text-texto-suave"> — todas as peças</span>
          ) : null}
        </LinhaDet>
        <LinhaDet rotulo="Período">{periodo}</LinhaDet>
        <LinhaDet rotulo="Usos">
          {formatarUsos(promo)}
          {promo.limite_uso == null ? " (sem limite)" : ""}
        </LinhaDet>
        {promo.tipo_aplicacao === "cupom" && (
          <LinhaDet rotulo="Acumulável">
            {promo.acumulavel ? "Sim (soma com a automática)" : "Não (vale o maior desconto)"}
          </LinhaDet>
        )}
        {promo.criado_em && (
          <LinhaDet rotulo="Criada em">{dataLegivel(paraLocal(promo.criado_em))}</LinhaDet>
        )}
      </dl>
      <div className="mt-4 flex flex-col gap-3 border-t border-borda pt-4 sm:flex-row sm:justify-end">
        <BotaoSecundario type="button" onClick={aoFechar}>Fechar</BotaoSecundario>
        <BotaoPrimario type="button" onClick={() => aoEditar(promo)}>Editar</BotaoPrimario>
      </div>
    </Modal>
  );
}

// Modal de criar/editar promoção (validação completa: todos os erros de uma vez).
function FormPromocao({ aberto, promo, aoFechar, aoSalvar }) {
  const editando = Boolean(promo);
  const { data: categorias = [] } = useCategorias();
  const pecasQ = useAdminPecas({ ordering: "nome" });
  const pecas = pecasQ.data ?? [];

  const inicial = () => ({
    nome: promo?.nome ?? "",
    tipo_aplicacao: promo?.tipo_aplicacao ?? "cupom",
    codigo: promo?.codigo ?? "",
    tipo_desconto: promo?.tipo_desconto ?? "percentual",
    valor: promo?.valor ?? "",
    escopo: promo?.escopo ?? "tudo",
    pecas: promo?.pecas ?? [],
    categorias: promo?.categorias ?? [],
    inicio: paraLocal(promo?.inicio),
    fim: paraLocal(promo?.fim),
    iniciarAgora: false, // começa ao salvar (define o início no momento da confirmação)
    limite_uso: promo?.limite_uso ?? "",
    acumulavel: promo?.acumulavel ?? false,
    ativo: promo?.ativo ?? true,
  });
  const [form, setForm] = useState(inicial);
  const [erros, setErros] = useState({});

  // Reseta ao (re)abrir, sem efeito (padrão do projeto).
  const [abertoAntes, setAbertoAntes] = useState(aberto);
  if (aberto !== abertoAntes) {
    setAbertoAntes(aberto);
    if (aberto) {
      setForm(inicial());
      setErros({});
    }
  }

  const set = (campo, valor) => setForm((f) => ({ ...f, [campo]: valor }));

  // Peças selecionadas (objetos) — para a prévia do desconto.
  const pecasSelecionadas = pecas.filter((p) => form.pecas.includes(p.id));

  // "Agora" no formato do datetime-local (mín. do calendário) e os valores
  // originais (para não barrar a edição de uma promoção que já começou).
  const agoraLocal = paraLocal(new Date().toISOString());
  const inicioOriginal = paraLocal(promo?.inicio);
  const fimOriginal = paraLocal(promo?.fim);

  const mut = useMutation({
    mutationFn: () => {
      const ehCupom = form.tipo_aplicacao === "cupom";
      const payload = {
        nome: form.nome.trim(),
        tipo_aplicacao: form.tipo_aplicacao,
        codigo: ehCupom ? form.codigo.trim() : "",
        tipo_desconto: form.tipo_desconto,
        valor: form.valor,
        escopo: form.escopo,
        pecas: form.escopo === "peca" ? form.pecas : [],
        categorias: form.escopo === "categoria" ? form.categorias : [],
        // "Iniciar agora" define o início no INSTANTE da confirmação (ao salvar).
        // Caso contrário, converte o horário LOCAL escolhido no calendário para o
        // instante exato (ISO com fuso) — sem isso o backend interpretaria o
        // horário de forma ambígua e a promoção valeria num horário diferente.
        inicio: form.iniciarAgora
          ? new Date().toISOString()
          : form.inicio
          ? new Date(form.inicio).toISOString()
          : null,
        fim: form.fim ? new Date(form.fim).toISOString() : null,
        limite_uso: form.limite_uso === "" ? null : Number(form.limite_uso),
        acumulavel: form.acumulavel,
        ativo: form.ativo,
      };
      return editando ? atualizarPromocao(promo.id, payload) : criarPromocao(payload);
    },
    onSuccess: aoSalvar,
    onError: (e) => mapearErro(e.message, setErros),
  });

  function enviar(e) {
    e.preventDefault();
    const novos = {};
    if (!form.nome.trim()) novos.nome = "Informe um nome.";
    if (form.tipo_aplicacao === "cupom" && !form.codigo.trim())
      novos.codigo = "Informe o código do cupom.";
    const valor = Number(form.valor);
    if (!form.valor || Number.isNaN(valor) || valor <= 0)
      novos.valor = "Informe um valor maior que zero.";
    else if (form.tipo_desconto === "percentual" && valor > 100)
      novos.valor = "O percentual não pode passar de 100%.";
    if (form.escopo === "peca" && form.pecas.length === 0)
      novos.pecas = "Escolha ao menos uma peça.";
    if (form.escopo === "categoria" && form.categorias.length === 0)
      novos.categorias = "Escolha ao menos uma categoria.";
    // Não permitir datas no passado (exceto manter o valor original ao editar).
    // Com "iniciar agora", o início é definido ao salvar — não valida o campo.
    if (!form.iniciarAgora && form.inicio && form.inicio < agoraLocal && form.inicio !== inicioOriginal)
      novos.inicio = "A data de início não pode ser no passado.";
    if (form.fim && form.fim < agoraLocal && form.fim !== fimOriginal)
      novos.fim = "A data de fim não pode ser no passado.";
    const inicioEfetivo = form.iniciarAgora ? agoraLocal : form.inicio;
    if (inicioEfetivo && form.fim && form.fim <= inicioEfetivo)
      novos.fim = "O fim deve ser depois do início (data e hora).";
    if (Object.keys(novos).length) {
      setErros(novos);
      return;
    }
    setErros({});
    mut.mutate();
  }

  const totalErros = Object.keys(erros).filter((k) => k !== "geral").length;

  return (
    <Modal aberto={aberto} aoFechar={aoFechar} titulo={editando ? "Editar promoção" : "Nova promoção"} tamanho="lg">
      <form onSubmit={enviar} noValidate className="space-y-4">
        {(totalErros > 0 || erros.geral) && (
          <Feedback tipo="erro">
            {erros.geral || `Há ${totalErros} ${totalErros === 1 ? "campo com problema" : "campos com problemas"}. Confira abaixo.`}
          </Feedback>
        )}

        <Campo label="Nome" htmlFor="promo-nome">
          <input id="promo-nome" value={form.nome} onChange={(e) => set("nome", e.target.value)} maxLength={80} placeholder="Ex.: Cupom de boas-vindas" className={inputClasse} />
          {erros.nome && <p className="mt-1 text-sm text-erro">{erros.nome}</p>}
        </Campo>

        <div className="grid gap-4 sm:grid-cols-2">
          <Campo label="Tipo de aplicação" htmlFor="promo-aplicacao">
            <select id="promo-aplicacao" value={form.tipo_aplicacao} onChange={(e) => set("tipo_aplicacao", e.target.value)} className={inputClasse}>
              <option value="cupom">Cupom (cliente digita)</option>
              <option value="automatica">Automática</option>
            </select>
          </Campo>
          {form.tipo_aplicacao === "cupom" && (
            <Campo label="Código do cupom" htmlFor="promo-codigo">
              <input id="promo-codigo" value={form.codigo} onChange={(e) => set("codigo", e.target.value.toUpperCase())} maxLength={40} placeholder="Ex.: BEMVINDO" className={inputClasse} />
              {erros.codigo && <p className="mt-1 text-sm text-erro">{erros.codigo}</p>}
            </Campo>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Campo label="Tipo de desconto" htmlFor="promo-tipo-desc">
            <select id="promo-tipo-desc" value={form.tipo_desconto} onChange={(e) => set("tipo_desconto", e.target.value)} className={inputClasse}>
              <option value="percentual">Percentual (%)</option>
              <option value="valor">Valor (R$)</option>
            </select>
          </Campo>
          <Campo label={form.tipo_desconto === "percentual" ? "Percentual (%)" : "Valor (R$)"} htmlFor="promo-valor">
            {form.tipo_desconto === "valor" ? (
              <CampoPreco
                id="promo-valor"
                centavos={valorParaCentavos(form.valor)}
                aoMudar={(c) => set("valor", centavosParaDecimal(c))}
                invalido={Boolean(erros.valor)}
              />
            ) : (
              <div className="relative">
                <input
                  id="promo-valor"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={form.valor}
                  onChange={(e) => set("valor", e.target.value)}
                  placeholder="Ex.: 10"
                  className={inputClasse + " pr-8"}
                />
                <span aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-texto-suave">%</span>
              </div>
            )}
            {erros.valor && <p className="mt-1 text-sm text-erro">{erros.valor}</p>}
          </Campo>
        </div>

        <Campo label="Escopo" htmlFor="promo-escopo">
          <select id="promo-escopo" value={form.escopo} onChange={(e) => set("escopo", e.target.value)} className={inputClasse}>
            <option value="tudo">Tudo</option>
            <option value="peca">Peça(s)</option>
            <option value="categoria">Categoria(s)</option>
          </select>
        </Campo>
        {form.escopo === "peca" && (
          <Campo label="Peças (pode escolher mais de uma)">
            <SeletorMulti
              opcoes={pecas}
              selecionados={form.pecas}
              aoMudar={(ids) => set("pecas", ids)}
              placeholder="Pesquisar peça/modelo…"
            />
            {erros.pecas && <p className="mt-1 text-sm text-erro">{erros.pecas}</p>}
          </Campo>
        )}
        {form.escopo === "categoria" && (
          <Campo label="Categorias (pode escolher mais de uma)">
            <SeletorMulti
              opcoes={categorias}
              selecionados={form.categorias}
              aoMudar={(ids) => set("categorias", ids)}
              placeholder="Pesquisar categoria…"
            />
            {erros.categorias && <p className="mt-1 text-sm text-erro">{erros.categorias}</p>}
          </Campo>
        )}

        {/* Prévia do preço com desconto (escopo por peça). */}
        {form.escopo === "peca" && pecasSelecionadas.length > 0 && Number(form.valor) > 0 && (
          <PreviaDesconto
            pecas={pecasSelecionadas}
            tipo={form.tipo_desconto}
            valor={Number(form.valor)}
          />
        )}

        {/* Atalho: começar a valer no momento em que a promoção for salva. */}
        <label className="flex items-center gap-2 text-sm text-texto">
          <input
            type="checkbox"
            checked={form.iniciarAgora}
            onChange={(e) => set("iniciarAgora", e.target.checked)}
            className="h-4 w-4 accent-[var(--color-acento-escuro)]"
          />
          Iniciar a promoção agora (passa a valer assim que você salvar)
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <Campo
            label="Início (opcional)"
            htmlFor="promo-inicio"
            dica={form.iniciarAgora ? "Começa quando você salvar." : dataLegivel(form.inicio)}
          >
            <input
              id="promo-inicio"
              type="datetime-local"
              step="60"
              min={agoraLocal}
              value={form.iniciarAgora ? agoraLocal : form.inicio}
              onChange={(e) => set("inicio", e.target.value)}
              disabled={form.iniciarAgora}
              className={inputClasse + (form.iniciarAgora ? " opacity-60" : "")}
            />
            {erros.inicio && <p className="mt-1 text-sm text-erro">{erros.inicio}</p>}
          </Campo>
          <Campo label="Fim (opcional)" htmlFor="promo-fim" dica={dataLegivel(form.fim)}>
            <input id="promo-fim" type="datetime-local" step="60" min={form.inicio || agoraLocal} value={form.fim} onChange={(e) => set("fim", e.target.value)} className={inputClasse} />
            {erros.fim && <p className="mt-1 text-sm text-erro">{erros.fim}</p>}
          </Campo>
        </div>

        <Campo label="Limite de usos (opcional)" htmlFor="promo-limite" dica="Em branco = sem limite (até 10 dígitos).">
          <input
            id="promo-limite"
            type="text"
            inputMode="numeric"
            maxLength={10}
            value={form.limite_uso}
            onChange={(e) => set("limite_uso", e.target.value.replace(/\D/g, "").slice(0, 10))}
            placeholder="Ex.: 100"
            className={inputClasse}
          />
        </Campo>

        {form.tipo_aplicacao === "cupom" && (
          <label className="flex items-center gap-2 text-sm text-texto">
            <input type="checkbox" checked={form.acumulavel} onChange={(e) => set("acumulavel", e.target.checked)} className="h-4 w-4 accent-[var(--color-acento-escuro)]" />
            Acumula com a promoção automática (senão, vale o maior desconto)
          </label>
        )}
        <label className="flex items-center gap-2 text-sm text-texto">
          <input type="checkbox" checked={form.ativo} onChange={(e) => set("ativo", e.target.checked)} className="h-4 w-4 accent-[var(--color-acento-escuro)]" />
          Ativa
        </label>

        <div className="flex flex-col gap-3 border-t border-borda pt-4 sm:flex-row sm:justify-end">
          <BotaoSecundario type="button" onClick={aoFechar}>Cancelar</BotaoSecundario>
          <BotaoPrimario type="submit" disabled={mut.isPending}>
            {mut.isPending ? "Salvando…" : "Salvar promoção"}
          </BotaoPrimario>
        </div>
      </form>
    </Modal>
  );
}

function mapearErro(msg, setErros) {
  const texto = msg || "Não foi possível salvar a promoção.";
  const novos = {};
  if (/c[oó]digo/i.test(texto)) novos.codigo = texto;
  else if (/valor|percentual|desconto/i.test(texto)) novos.valor = texto;
  else if (/pe[çc]a/i.test(texto)) novos.pecas = texto;
  else if (/categoria/i.test(texto)) novos.categorias = texto;
  else novos.geral = texto;
  setErros(novos);
}

// "YYYY-MM-DDTHH:mm" → "DD/MM/AAAA às HH:mm" (melhora a leitura da data/hora).
function dataLegivel(local) {
  if (!local) return "Em branco = sem limite de período.";
  const [data, hora] = local.split("T");
  if (!data || !hora) return "";
  const [a, m, d] = data.split("-");
  return `${d}/${m}/${a} às ${hora}`;
}

// Seletor com busca + múltipla seleção (peças/categorias).
function SeletorMulti({ opcoes, selecionados, aoMudar, placeholder }) {
  const [busca, setBusca] = useState("");
  const marcados = new Set(selecionados);
  const filtradas = busca.trim()
    ? opcoes.filter((o) => o.nome.toLowerCase().includes(busca.trim().toLowerCase()))
    : opcoes;

  function alternar(id) {
    const novo = new Set(marcados);
    if (novo.has(id)) novo.delete(id);
    else novo.add(id);
    aoMudar([...novo]);
  }

  function selecionarTodas() {
    const novo = new Set(marcados);
    filtradas.forEach((o) => novo.add(o.id));
    aoMudar([...novo]);
  }

  return (
    <div className="overflow-hidden rounded-lg border border-borda">
      <input
        type="search"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="w-full border-0 border-b border-borda bg-superficie px-3 py-2 text-sm text-texto placeholder:italic placeholder:text-texto-suave/70 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-acento-escuro/30"
      />
      {/* Atalhos de seleção (úteis quando a lista é longa). */}
      <div className="flex items-center justify-between gap-2 border-b border-borda px-2 py-1.5 text-xs">
        <button
          type="button"
          onClick={selecionarTodas}
          disabled={filtradas.length === 0}
          className="font-medium text-acento-escuro hover:underline disabled:opacity-40"
        >
          Selecionar todas{busca.trim() ? " (filtradas)" : ""}
        </button>
        {selecionados.length > 0 && (
          <button type="button" onClick={() => aoMudar([])} className="text-texto-suave hover:underline">
            Limpar
          </button>
        )}
      </div>
      <ul className="max-h-56 overflow-y-auto p-1">
        {filtradas.length === 0 ? (
          <li className="px-2 py-2 text-sm text-texto-suave">Nada encontrado.</li>
        ) : (
          filtradas.map((o) => (
            <li key={o.id}>
              <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-texto hover:bg-borda/40">
                <input
                  type="checkbox"
                  checked={marcados.has(o.id)}
                  onChange={() => alternar(o.id)}
                  className="h-4 w-4 accent-[var(--color-acento-escuro)]"
                />
                <span className="truncate">{o.nome}</span>
              </label>
            </li>
          ))
        )}
      </ul>
      {selecionados.length > 0 && (
        <p className="border-t border-borda px-3 py-1.5 text-xs text-texto-suave">
          {selecionados.length} selecionada(s)
        </p>
      )}
    </div>
  );
}

// Prévia: quanto cada peça selecionada fica com o desconto.
function PreviaDesconto({ pecas, tipo, valor }) {
  // Com muitas peças, a lista poderia ficar enorme — rola a partir de 10 itens.
  const rolavel = pecas.length > 10;
  return (
    <div className="rounded-lg border border-borda bg-fundo p-3">
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-texto-suave">
        Com o desconto{rolavel ? ` (${pecas.length} peças)` : ""}
      </p>
      <ul
        className={
          "space-y-1 text-sm" + (rolavel ? " max-h-56 overflow-y-auto pr-1" : "")
        }
      >
        {pecas.map((p) => {
          const preco = Number(p.preco);
          const desc = tipo === "percentual" ? (preco * valor) / 100 : valor;
          const novo = Math.max(0, preco - desc);
          return (
            <li key={p.id} className="flex items-center justify-between gap-3">
              <span className="min-w-0 truncate text-texto" title={p.nome}>{p.nome}</span>
              <span className="shrink-0">
                <Preco valor={preco} className="text-texto-suave line-through" />{" "}
                <Preco valor={novo} className="font-semibold text-acento-escuro" />
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
