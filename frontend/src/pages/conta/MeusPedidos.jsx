import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { contaPedidos } from "../../lib/api";
import Preco from "../../components/Preco";
import { Carregando, Erro, Vazio } from "../../components/Estado";

// Rótulo + cor do selo por status do pagamento (mesma semântica do painel).
const STATUS = {
  pago: { rotulo: "Pago", classe: "bg-sucesso/15 text-sucesso" },
  aguardando_pagamento: { rotulo: "Aguardando pagamento", classe: "bg-acento/15 text-acento-escuro" },
  expirado: { rotulo: "Expirado", classe: "bg-esgotado/20 text-texto-suave" },
  cancelado: { rotulo: "Cancelado", classe: "bg-erro/15 text-erro" },
};

function dataCurta(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function MeusPedidos() {
  const q = useQuery({ queryKey: ["conta", "pedidos"], queryFn: contaPedidos });

  if (q.isLoading) return <Carregando texto="Carregando seus pedidos…" />;
  if (q.isError) return <Erro mensagem={q.error.message} aoTentarNovamente={q.refetch} />;

  const pedidos = q.data ?? [];

  return (
    <section className="mx-auto max-w-2xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-semibold text-texto">Meus pedidos</h1>
        <Link to="/conta" className="text-sm font-medium text-acento-escuro hover:underline">
          ← Minha conta
        </Link>
      </div>

      {pedidos.length === 0 ? (
        <Vazio texto="Você ainda não tem pedidos.">
          <Link
            to="/vitrine"
            className="rounded-lg bg-acento-escuro px-6 py-3 font-medium text-white transition hover:bg-acento-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acento-escuro focus-visible:ring-offset-2 focus-visible:ring-offset-fundo"
          >
            Ver a vitrine
          </Link>
        </Vazio>
      ) : (
        <ul className="space-y-4">
          {pedidos.map((p) => {
            const info = STATUS[p.status] ?? { rotulo: p.status, classe: "bg-borda/60 text-texto-suave" };
            const itens = p.itens ?? [];
            return (
              <li key={p.id} className="rounded-lg border border-borda bg-superficie p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium text-texto">Pedido #{p.id}</p>
                    <p className="text-sm text-texto-suave">{dataCurta(p.criado_em)}</p>
                  </div>
                  <span className={"inline-flex items-center rounded px-2 py-0.5 text-xs font-medium " + info.classe}>
                    {info.rotulo}
                  </span>
                </div>

                <ul className="mt-3 space-y-1 border-t border-borda pt-3 text-sm text-texto-suave">
                  {itens.map((item) => (
                    <li key={item.id} className="flex justify-between gap-3">
                      <span className="min-w-0">
                        {item.quantidade}× {item.peca_nome}
                        {item.variacao_descricao ? ` — ${item.variacao_descricao}` : ""}
                      </span>
                      <Preco valor={item.preco_unit} className="shrink-0 text-texto" />
                    </li>
                  ))}
                </ul>

                <div className="mt-3 flex items-baseline justify-between border-t border-borda pt-3">
                  <span className="text-sm text-texto-suave">Total</span>
                  <Preco valor={p.total} className="font-display text-xl font-semibold text-texto" />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
