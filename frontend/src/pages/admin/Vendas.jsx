import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Eye } from "lucide-react";
import { useAdminPedidos } from "../../hooks/useAdminPedidos";
import { useOrdenacao, ordenarPor } from "../../hooks/useOrdenacao";
import { CabecalhoOrdenavel } from "../../components/admin/CabecalhoOrdenavel";
import Modal from "../../components/admin/Modal";
import Preco from "../../components/Preco";
import { obterPedido } from "../../lib/api";
import { Carregando, Erro, Vazio } from "../../components/Estado";
import { BotaoPrimario, Selo, inputClasse } from "../../components/admin/ui";

// Metadados de cada status (rótulo PT-BR + cor do selo).
const STATUS = {
  pago: { rotulo: "Pago", cor: "verde" },
  aguardando_pagamento: { rotulo: "Aguardando pagamento", cor: "acento" },
  expirado: { rotulo: "Expirado", cor: "cinza" },
  cancelado: { rotulo: "Cancelado", cor: "vermelho" },
};
const ORDEM_STATUS = ["aguardando_pagamento", "pago", "expirado", "cancelado"];

function dataCurta(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
}

function contarItens(pedido) {
  const itens = pedido.itens ?? [];
  const total = itens.reduce((soma, i) => soma + (Number(i.quantidade) || 0), 0);
  return total;
}

function rotuloStatus(status) {
  return STATUS[status]?.rotulo ?? status;
}

export default function Vendas() {
  const q = useAdminPedidos();
  const [detalheId, setDetalheId] = useState(null);
  const [filtroStatus, setFiltroStatus] = useState("");
  const ord = useOrdenacao("admin-vendas", { coluna: "criado_em", direcao: "desc" });

  const todos = q.data ?? [];
  // Filtro por status no cliente (carga completa), como em Encomendas.
  const filtrados = filtroStatus
    ? todos.filter((p) => p.status === filtroStatus)
    : todos;

  const lista = ordenarPor(filtrados, ord.ordenacao.coluna, ord.ordenacao.direcao, {
    nome: (p) => p.nome,
    itens: (p) => contarItens(p),
    total: (p) => Number(p.total) || 0,
    status: (p) => ORDEM_STATUS.indexOf(p.status),
    criado_em: (p) => p.criado_em,
  });

  const aguardando = todos.filter((p) => p.status === "aguardando_pagamento").length;

  return (
    <section>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-semibold">Vendas</h1>
        {aguardando > 0 && (
          <Selo cor="acento">{aguardando} aguardando pagamento</Selo>
        )}
      </div>

      <p className="mb-4 text-sm text-texto-suave">
        Pedidos do pagamento online (Mercado Pago). Esta tela é{" "}
        <strong className="font-medium text-texto">somente leitura</strong> —
        estornos e cancelamentos são feitos no painel do Mercado Pago.
      </p>

      {q.data && q.data.length > 0 && (
        <div className="mb-4 max-w-xs">
          <label htmlFor="filtro-status" className="mb-1 block text-sm font-medium text-texto">
            Filtrar por status
          </label>
          <select
            id="filtro-status"
            value={filtroStatus}
            onChange={(e) => setFiltroStatus(e.target.value)}
            className={inputClasse}
          >
            <option value="">Todos</option>
            {ORDEM_STATUS.map((s) => (
              <option key={s} value={s}>
                {STATUS[s].rotulo}
              </option>
            ))}
          </select>
        </div>
      )}

      {q.isLoading && <Carregando texto="Carregando vendas..." />}
      {q.isError && <Erro mensagem={q.error.message} aoTentarNovamente={q.refetch} />}
      {!q.isLoading && !q.isError && lista.length === 0 && (
        <Vazio
          texto={
            filtroStatus
              ? "Nenhuma venda com esse status."
              : "Nenhuma venda registrada ainda."
          }
        />
      )}

      {lista.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-borda">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-borda text-texto-suave">
              <tr>
                <CabecalhoOrdenavel coluna="nome" rotulo="Cliente" ordenacao={ord.ordenacao} aoOrdenar={ord.alternar} />
                <CabecalhoOrdenavel coluna="itens" rotulo="Itens" ordenacao={ord.ordenacao} aoOrdenar={ord.alternar} />
                <CabecalhoOrdenavel coluna="total" rotulo="Total" ordenacao={ord.ordenacao} aoOrdenar={ord.alternar} />
                <CabecalhoOrdenavel coluna="status" rotulo="Status" ordenacao={ord.ordenacao} aoOrdenar={ord.alternar} />
                <CabecalhoOrdenavel coluna="criado_em" rotulo="Data" ordenacao={ord.ordenacao} aoOrdenar={ord.alternar} />
                <th className="px-4 py-3 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-borda">
              {lista.map((p) => {
                const n = contarItens(p);
                return (
                  <tr
                    key={p.id}
                    onClick={() => setDetalheId(p.id)}
                    className="cursor-pointer transition hover:bg-borda/30"
                  >
                    <td className="px-4 py-3 font-medium text-texto">{p.nome}</td>
                    <td className="px-4 py-3 text-texto-suave">
                      {n} {n === 1 ? "item" : "itens"}
                    </td>
                    <td className="px-4 py-3 text-texto">
                      <Preco valor={p.total} />
                    </td>
                    <td className="px-4 py-3">
                      <Selo cor={STATUS[p.status]?.cor ?? "neutro"}>
                        {rotuloStatus(p.status)}
                      </Selo>
                    </td>
                    <td className="px-4 py-3 text-texto-suave">{dataCurta(p.criado_em)}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDetalheId(p.id);
                          }}
                          aria-label={`Ver detalhes da venda de ${p.nome}`}
                          className="inline-flex items-center justify-center rounded-lg border border-borda p-1.5 text-texto-suave transition hover:border-acento-escuro hover:text-acento-escuro focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acento-escuro"
                        >
                          <Eye size={18} aria-hidden="true" />
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
        aberto={Boolean(detalheId)}
        aoFechar={() => setDetalheId(null)}
        titulo="Detalhes da venda"
        tamanho="xl"
      >
        {detalheId && (
          <DetalheVenda id={detalheId} aoFechar={() => setDetalheId(null)} />
        )}
      </Modal>
    </section>
  );
}

function DetalheVenda({ id, aoFechar }) {
  const detalheQ = useQuery({
    queryKey: ["admin", "pedido", String(id)],
    queryFn: () => obterPedido(id),
  });

  if (detalheQ.isLoading) return <Carregando texto="Carregando..." />;
  if (detalheQ.isError)
    return <Erro mensagem={detalheQ.error.message} aoTentarNovamente={detalheQ.refetch} />;

  const p = detalheQ.data;
  const itens = p.itens ?? [];

  return (
    <div className="space-y-5">
      <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
        <Linha rotulo="Cliente" valor={p.nome} />
        <Linha rotulo="Contato" valor={p.contato || "—"} />
        <Linha
          rotulo="Status"
          valor={
            <Selo cor={STATUS[p.status]?.cor ?? "neutro"}>
              {rotuloStatus(p.status)}
            </Selo>
          }
        />
        <Linha rotulo="Total" valor={<Preco valor={p.total} className="font-medium text-texto" />} />
        <Linha rotulo="Criado em" valor={dataCurta(p.criado_em)} />
        <Linha rotulo="Expira em" valor={dataCurta(p.expira_em)} />
      </dl>

      <div>
        <p className="mb-2 text-sm font-medium text-texto-suave">
          Itens ({itens.length})
        </p>
        {itens.length === 0 ? (
          <p className="text-sm text-texto-suave">Nenhum item neste pedido.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-borda">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-borda text-texto-suave">
                <tr>
                  <th className="px-3 py-2 font-medium">Peça</th>
                  <th className="px-3 py-2 font-medium">Variação</th>
                  <th className="px-3 py-2 font-medium text-center">Qtd.</th>
                  <th className="px-3 py-2 font-medium text-right">Preço unit.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-borda">
                {itens.map((item) => (
                  <tr key={item.id}>
                    <td className="px-3 py-2 font-medium text-texto">{item.peca_nome}</td>
                    <td className="px-3 py-2 text-texto-suave">{item.variacao_descricao}</td>
                    <td className="px-3 py-2 text-center text-texto">{item.quantidade}</td>
                    <td className="px-3 py-2 text-right text-texto">
                      <Preco valor={item.preco_unit} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="border-t border-borda pt-4">
        <p className="mb-2 text-sm font-medium text-texto-suave">Mercado Pago</p>
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          <Linha rotulo="Preference ID" valor={p.mp_preference_id || "—"} mono />
          <Linha rotulo="Payment ID" valor={p.mp_payment_id || "—"} mono />
        </dl>
      </div>

      <p className="rounded-lg border border-borda bg-fundo px-4 py-3 text-sm text-texto-suave">
        Esta tela é <strong className="font-medium text-texto">somente leitura</strong>.
        Estornos e cancelamentos são feitos diretamente no painel do Mercado
        Pago, não aqui.
      </p>

      <div className="flex justify-end border-t border-borda pt-4">
        <BotaoPrimario type="button" onClick={aoFechar}>
          Fechar
        </BotaoPrimario>
      </div>
    </div>
  );
}

function Linha({ rotulo, valor, mono = false }) {
  return (
    <div>
      <dt className="text-sm font-medium text-texto-suave">{rotulo}</dt>
      <dd className={"text-texto" + (mono ? " break-all font-mono text-sm" : "")}>{valor}</dd>
    </div>
  );
}
