import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Copy, Check, Truck, AlertCircle } from "lucide-react";
import { contaPedidos } from "../../lib/api";
import { linkWhatsappTexto, whatsappConfigurado } from "../../lib/whatsapp";
import Preco from "../../components/Preco";
import { Carregando, Erro, Vazio } from "../../components/Estado";

// Página oficial de rastreamento dos Correios (não há URL pública estável que
// já abra com o código preenchido — o cliente copia daqui e cola lá).
const CORREIOS_URL = "https://rastreamento.correios.com.br/app/index.php";

// Rótulo + cor do selo por status do pagamento (mesma semântica do painel).
const STATUS = {
  pago: { rotulo: "Pago", classe: "bg-sucesso/15 text-sucesso" },
  aguardando_pagamento: { rotulo: "Aguardando pagamento", classe: "bg-acento/15 text-acento-escuro" },
  em_revisao: { rotulo: "Em revisão", classe: "bg-erro/15 text-erro" },
  expirado: { rotulo: "Expirado", classe: "bg-esgotado/20 text-texto-suave" },
  cancelado: { rotulo: "Cancelado", classe: "bg-erro/15 text-erro" },
};

// Mensagens amigáveis (sem jargão) quando o pedido NÃO foi concluído. O detalhe
// técnico fica no log do servidor; aqui o cliente vê só o que importa pra ele.
const MENSAGEM_REVISAO = {
  pago_apos_expiracao:
    "O tempo de reserva deste pedido expirou e não conseguimos concluí-lo. Se você foi cobrado, o valor será estornado.",
  divergencia_valor:
    "Tivemos um problema ao confirmar este pedido. Se você foi cobrado, o valor será estornado.",
  sem_estoque_apos_pago:
    "Infelizmente este item esgotou bem na hora da compra. Se você foi cobrado, o valor será estornado.",
};
const MENSAGEM_REVISAO_PADRAO =
  "Não conseguimos concluir este pedido. Se você foi cobrado, o valor será estornado.";

function dataCurta(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// Aviso amigável quando o pedido entrou "em revisão" (pago no MP mas não
// concluído). Orienta a falar no WhatsApp, sem termos técnicos.
function AvisoRevisao({ pedido }) {
  if (pedido.status !== "em_revisao") return null;
  const texto = MENSAGEM_REVISAO[pedido.motivo_revisao] || MENSAGEM_REVISAO_PADRAO;
  return (
    <div className="mt-3 flex gap-2 rounded-lg border border-erro/40 bg-erro/5 px-3 py-3">
      <AlertCircle size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-erro" />
      <div className="text-sm text-texto">
        <p>{texto}</p>
        {whatsappConfigurado ? (
          <a
            href={linkWhatsappTexto(`Olá! Sobre o meu pedido ${pedido.codigo}.`)}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-block font-medium text-acento-escuro hover:underline"
          >
            Falar com a gente no WhatsApp →
          </a>
        ) : (
          <p className="mt-1 text-texto-suave">Fale com a gente pelo WhatsApp.</p>
        )}
      </div>
    </div>
  );
}

// Rastreio dos Correios: mostra o código com botão copiar + link para o site
// oficial (discreto, mobile-first). O cliente cola o código no site dos Correios.
function Rastreio({ codigo }) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(codigo);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      /* área de transferência indisponível: o cliente ainda pode selecionar o texto */
    }
  }

  return (
    <div className="mt-3 rounded-lg border border-borda bg-fundo px-3 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-texto-suave">
        Rastreio dos Correios
      </p>
      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        <code className="rounded bg-superficie px-2 py-1 font-mono text-sm text-texto">
          {codigo}
        </code>
        <button
          type="button"
          onClick={copiar}
          className="inline-flex items-center gap-1 rounded-lg border border-borda px-2 py-1 text-xs text-texto-suave transition hover:border-acento-escuro hover:text-acento-escuro focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acento-escuro"
        >
          {copiado ? (
            <>
              <Check size={14} aria-hidden="true" /> Copiado
            </>
          ) : (
            <>
              <Copy size={14} aria-hidden="true" /> Copiar
            </>
          )}
        </button>
        <a
          href={CORREIOS_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 rounded-lg bg-acento-escuro px-3 py-1 text-xs font-medium text-white transition hover:bg-acento-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acento-escuro focus-visible:ring-offset-2 focus-visible:ring-offset-fundo"
        >
          <Truck size={14} aria-hidden="true" /> Acompanhar nos Correios
        </a>
      </div>
      <p className="mt-1.5 text-xs text-texto-suave">
        Cole o código no site dos Correios para ver a situação da entrega.
      </p>
    </div>
  );
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
                    <p className="font-mono font-medium text-texto">{p.codigo}</p>
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
                  <Preco valor={p.total} className="font-sans text-xl font-semibold text-texto" />
                </div>

                <AvisoRevisao pedido={p} />
                {p.codigo_rastreio && <Rastreio codigo={p.codigo_rastreio} />}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
