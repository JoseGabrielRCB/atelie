import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  LabelList,
} from "recharts";
import {
  Download,
  CalendarRange,
  Trophy,
  CalendarDays,
  Wallet,
  TrendingUp,
  TrendingDown,
  Minus,
  Users,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import {
  relatorioFinanceiro,
  relatorioVendasPeriodo,
  relatorioProdutosVendidos,
  relatorioResumoMes,
  baixarRelatorio,
} from "../../lib/api";
import { useOrdenacao, ordenarPor } from "../../hooks/useOrdenacao";
import { usePaginacao } from "../../hooks/usePaginacao";
import { CabecalhoOrdenavel, OrdenarMobile } from "../../components/admin/CabecalhoOrdenavel";
import { Paginacao } from "../../components/admin/Paginacao";
import Preco from "../../components/Preco";
import { Carregando, Erro, Vazio } from "../../components/Estado";
import { BotaoSecundario, inputClasse, Feedback } from "../../components/admin/ui";

// Paleta dos gráficos (tokens do STYLE.md), igual ao Resumo.
const COR_ACENTO = "#7e4e2e";
const COR_ACENTO_CLARO = "#b07a56";
const COR_TEXTO = "#1a1816";
const COR_TEXTO_SUAVE = "#57534e";
const COR_BORDA = "#d6cfc4";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

// ---- Helpers de data (admin é só CSR; new Date() é seguro aqui) ----
function isoLocal(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dia}`;
}
const HOJE_ISO = isoLocal(new Date());
function inicioMesISO() {
  const d = new Date();
  return isoLocal(new Date(d.getFullYear(), d.getMonth(), 1));
}
function mesAtualISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
// "AAAA-MM-DD" → "dd/mm/aaaa" (rótulo do comparativo, sem criar Date e mexer no fuso).
function periodoBr(iso) {
  if (!iso) return "-";
  const [a, m, dia] = iso.split("-");
  return `${dia}/${m}/${a}`;
}

// Atalhos de período (Bloco A): devolvem { de, ate } no formato ISO local.
function atalhoPeriodo(id) {
  const hoje = new Date();
  const ate = isoLocal(hoje);
  if (id === "mes") return { de: inicioMesISO(), ate };
  if (id === "mes_passado") {
    const ini = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
    const fim = new Date(hoje.getFullYear(), hoje.getMonth(), 0); // último dia do mês anterior
    return { de: isoLocal(ini), ate: isoLocal(fim) };
  }
  if (id === "30") {
    const ini = new Date(hoje);
    ini.setDate(ini.getDate() - 29);
    return { de: isoLocal(ini), ate };
  }
  if (id === "90") {
    const ini = new Date(hoje);
    ini.setDate(ini.getDate() - 89);
    return { de: isoLocal(ini), ate };
  }
  if (id === "ano") return { de: isoLocal(new Date(hoje.getFullYear(), 0, 1)), ate };
  return { de: inicioMesISO(), ate };
}

const ATALHOS = [
  { id: "mes", rotulo: "Este mês" },
  { id: "mes_passado", rotulo: "Mês passado" },
  { id: "30", rotulo: "Últimos 30 dias" },
  { id: "90", rotulo: "Últimos 90 dias" },
  { id: "ano", rotulo: "Este ano" },
];

const ABAS = [
  { id: "financeiro", rotulo: "Visão financeira", Icone: Wallet },
  { id: "vendas", rotulo: "Vendas por período", Icone: CalendarRange },
  { id: "produtos", rotulo: "Produtos mais vendidos", Icone: Trophy },
  { id: "resumo", rotulo: "Resumo do mês", Icone: CalendarDays },
];

export default function Relatorios() {
  const [aba, setAba] = useState("financeiro");

  return (
    <section>
      <h1 className="mb-1 font-display text-3xl font-semibold">Relatórios</h1>
      <p className="mb-5 text-sm text-texto-suave">
        Números calculados a partir das vendas <strong className="font-medium text-texto">pagas</strong>.
        Exporte cada relatório em CSV (Excel) ou PDF.
      </p>

      {/* Abas dos 3 relatórios */}
      <div role="tablist" aria-label="Relatórios" className="mb-6 flex flex-wrap gap-2">
        {ABAS.map(({ id, rotulo, Icone }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={aba === id}
            onClick={() => setAba(id)}
            className={
              "inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acento-escuro " +
              (aba === id
                ? "border-acento-escuro bg-acento-escuro text-white"
                : "border-borda bg-superficie text-texto-suave hover:border-acento-escuro hover:text-texto")
            }
          >
            <Icone size={16} aria-hidden="true" />
            {rotulo}
          </button>
        ))}
      </div>

      {aba === "financeiro" && <VisaoFinanceira />}
      {aba === "vendas" && <VendasPeriodo />}
      {aba === "produtos" && <ProdutosVendidos />}
      {aba === "resumo" && <ResumoMes />}
    </section>
  );
}

// --------------------------------------------------------------------------
// Componentes compartilhados
// --------------------------------------------------------------------------
function Cartao({ rotulo, children }) {
  return (
    <div className="min-w-0 rounded-lg border border-borda bg-superficie p-4">
      <p className="text-sm text-texto-suave">{rotulo}</p>
      <p className="mt-1 break-words font-sans text-lg font-semibold leading-tight text-texto sm:text-xl lg:text-2xl">
        {children}
      </p>
    </div>
  );
}

function PainelGrafico({ titulo, children, vazio }) {
  return (
    <div className="rounded-lg border border-borda bg-superficie p-4 sm:p-5">
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-texto-suave">
        {titulo}
      </h3>
      {vazio ? (
        <p className="py-8 text-center text-sm text-texto-suave">Sem dados no período.</p>
      ) : (
        <div className="h-56 w-full sm:h-64 lg:h-72">
          <ResponsiveContainer width="100%" height="100%">
            {children}
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

// Caixa de exportação: seleção de formato (CSV/PDF) + botão Exportar.
function useExportador(slug) {
  const [baixando, setBaixando] = useState(false);
  const [erro, setErro] = useState("");
  async function exportar(params) {
    setErro("");
    setBaixando(true);
    try {
      await baixarRelatorio(slug, params);
    } catch (e) {
      setErro(e.message || "Não foi possível exportar o relatório.");
    } finally {
      setBaixando(false);
    }
  }
  return { baixando, erro, exportar };
}

function ExportarBox({ baixando, aoExportar }) {
  const [formato, setFormato] = useState("csv");
  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="w-40">
        <label htmlFor="formato-exportar" className="mb-1 block text-sm font-medium text-texto">
          Formato
        </label>
        <select
          id="formato-exportar"
          value={formato}
          onChange={(e) => setFormato(e.target.value)}
          className={inputClasse}
        >
          <option value="csv">CSV (Excel)</option>
          <option value="pdf">PDF</option>
        </select>
      </div>
      <BotaoSecundario type="button" onClick={() => aoExportar(formato)} disabled={baixando}>
        <Download size={16} aria-hidden="true" />
        {baixando ? "Gerando…" : "Exportar"}
      </BotaoSecundario>
    </div>
  );
}

function CampoData({ id, label, value, onChange, min, max }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-texto">
        {label}
      </label>
      <input
        id={id}
        type="date"
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(e.target.value)}
        className={inputClasse}
      />
    </div>
  );
}

// Selo de variação % vs. período anterior (↑/↓). `sentido` decide a cor: em
// "positivo" subir é bom (verde); em "neutro" (ex.: descontos) fica âmbar/cinza.
function Variacao({ pct, sentido = "positivo" }) {
  if (pct === null || pct === undefined) {
    return <span className="text-xs text-texto-suave">sem base de comparação</span>;
  }
  const subiu = pct > 0;
  const igual = pct === 0;
  const Icone = igual ? Minus : subiu ? TrendingUp : TrendingDown;
  let cor = "text-texto-suave";
  if (!igual) {
    if (sentido === "positivo") cor = subiu ? "text-emerald-700" : "text-red-700";
    else cor = "text-amber-700";
  }
  const abs = Math.abs(pct).toLocaleString("pt-BR", { maximumFractionDigits: 1 });
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${cor}`}>
      <Icone size={13} aria-hidden="true" />
      {igual ? "estável" : `${subiu ? "+" : "−"}${abs}%`}
    </span>
  );
}

function CartaoKpi({ rotulo, children, variacao, sentido }) {
  return (
    <div className="min-w-0 rounded-lg border border-borda bg-superficie p-4">
      <p className="text-sm text-texto-suave">{rotulo}</p>
      <p className="mt-1 break-words font-sans text-lg font-semibold leading-tight text-texto sm:text-xl lg:text-2xl">
        {children}
      </p>
      {variacao !== undefined && (
        <div className="mt-1">
          <Variacao pct={variacao} sentido={sentido} />
        </div>
      )}
    </div>
  );
}

// Botão "Ver detalhes / Ocultar detalhes" (acessível) usado nos blocos do
// financeiro. Mostra/esconde um painel inline (bom no mobile, sem trocar de tela).
function BotaoDetalhes({ aberto, onClick, controlsId, children = "Ver detalhes" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={aberto}
      aria-controls={controlsId}
      className="inline-flex items-center gap-1 rounded-md text-sm font-medium text-acento-escuro hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acento-escuro"
    >
      {aberto ? (
        <ChevronDown size={15} aria-hidden="true" />
      ) : (
        <ChevronRight size={15} aria-hidden="true" />
      )}
      {aberto ? "Ocultar detalhes" : children}
    </button>
  );
}

// Detalhe do bloco de KPIs: faturamento/pedidos por período (mesmo recorte do
// filtro). Busca o detalhamento só quando o painel está aberto (componente
// montado). Tabela vira cartões no mobile (classe `tabela-cartoes`).
function DetalheVendas({ de, ate, granularidade }) {
  const q = useQuery({
    queryKey: ["rel", "fin-detalhe-vendas", de, ate, granularidade],
    queryFn: () => relatorioVendasPeriodo({ de, ate, granularidade }),
  });
  if (q.isLoading) return <Carregando texto="Carregando detalhes…" />;
  if (q.isError) return <Erro mensagem={q.error.message} aoTentarNovamente={q.refetch} />;
  const series = q.data?.series ?? [];
  if (series.length === 0) return <Vazio texto="Nenhuma venda paga nesse período." />;
  return (
    <div className="sm:max-h-72 sm:overflow-auto sm:rounded-lg sm:border sm:border-borda">
      <table className="tabela-cartoes w-full text-left text-sm">
        <thead className="border-b border-borda text-texto-suave">
          <tr>
            <th className="px-4 py-2 font-medium">Período</th>
            <th className="px-4 py-2 font-medium">Faturamento</th>
            <th className="px-4 py-2 font-medium">Pedidos</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-borda">
          {series.map((s) => (
            <tr key={s.data ?? s.periodo}>
              <td className="cel-principal px-4 py-2 font-medium text-texto" data-rotulo="Período">
                {s.periodo}
              </td>
              <td className="px-4 py-2 text-texto" data-rotulo="Faturamento">
                <Preco valor={s.faturamento} />
              </td>
              <td className="px-4 py-2 text-texto-suave" data-rotulo="Pedidos">
                {s.pedidos}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// --------------------------------------------------------------------------
// 0) Visão financeira consolidada (KPIs com comparativo + DRE): Fase 1
// --------------------------------------------------------------------------
function VisaoFinanceira() {
  const [{ de, ate }, setPeriodo] = useState(() => atalhoPeriodo("30"));
  const [granularidade, setGranularidade] = useState("dia");
  // Qual bloco está com os detalhes abertos: "kpis" | "dre" | "clientes" | null.
  const [detalhe, setDetalhe] = useState(null);
  const alternar = (id) => setDetalhe((cur) => (cur === id ? null : id));
  const exp = useExportador("financeiro");

  const q = useQuery({
    queryKey: ["rel", "financeiro", de, ate, granularidade],
    queryFn: () => relatorioFinanceiro({ de, ate, granularidade }),
  });

  const d = q.data;
  const r = d?.resumo;

  return (
    <div className="space-y-5">
      {/* Bloco A: filtros + atalhos + exportar */}
      <div className="space-y-3 rounded-lg border border-borda bg-fundo p-4">
        <div className="flex flex-wrap gap-2">
          {ATALHOS.map((a) => {
            const alvo = atalhoPeriodo(a.id);
            const ativo = alvo.de === de && alvo.ate === ate;
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => setPeriodo(alvo)}
                aria-pressed={ativo}
                className={
                  "rounded-lg border px-3 py-1.5 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acento-escuro " +
                  (ativo
                    ? "border-acento-escuro bg-acento-escuro text-white"
                    : "border-borda bg-superficie text-texto-suave hover:border-acento-escuro hover:text-texto")
                }
              >
                {a.rotulo}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-wrap items-end gap-3">
            <CampoData id="fin-de" label="De" value={de} onChange={(v) => setPeriodo({ de: v, ate })} max={ate || HOJE_ISO} />
            <CampoData id="fin-ate" label="Até" value={ate} onChange={(v) => setPeriodo({ de, ate: v })} min={de} max={HOJE_ISO} />
            <div className="w-40">
              <label htmlFor="fin-gran" className="mb-1 block text-sm font-medium text-texto">
                Agrupar por
              </label>
              <select
                id="fin-gran"
                value={granularidade}
                onChange={(e) => setGranularidade(e.target.value)}
                className={inputClasse}
              >
                <option value="dia">Dia</option>
                <option value="semana">Semana</option>
                <option value="mes">Mês</option>
              </select>
            </div>
          </div>
          <ExportarBox
            baixando={exp.baixando}
            aoExportar={(formato) => exp.exportar({ de, ate, granularidade, formato })}
          />
        </div>
      </div>
      <Feedback tipo="erro">{exp.erro}</Feedback>

      {q.isLoading && <Carregando texto="Carregando relatório…" />}
      {q.isError && <Erro mensagem={q.error.message} aoTentarNovamente={q.refetch} />}

      {d && (
        <>
          <p className="text-xs text-texto-suave">
            Comparado ao período anterior de mesma duração ({periodoBr(d.comparativo.de)} a{" "}
            {periodoBr(d.comparativo.ate)}).
          </p>

          {/* Bloco B: KPIs com variação vs. período anterior */}
          <div className="rounded-lg border border-borda bg-fundo p-4">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
              <CartaoKpi rotulo="Faturamento" variacao={r.faturamento.variacao_pct}>
                <Preco valor={r.faturamento.valor} className="font-sans" />
              </CartaoKpi>
              <CartaoKpi rotulo="Nº de vendas" variacao={r.num_vendas.variacao_pct}>
                {r.num_vendas.valor}
              </CartaoKpi>
              <CartaoKpi rotulo="Ticket médio" variacao={r.ticket_medio.variacao_pct}>
                <Preco valor={r.ticket_medio.valor} className="font-sans" />
              </CartaoKpi>
              <CartaoKpi rotulo="Descontos" variacao={r.descontos.variacao_pct} sentido="neutro">
                <Preco valor={r.descontos.valor} className="font-sans" />
              </CartaoKpi>
              <CartaoKpi rotulo="Taxa de recompra" variacao={r.taxa_recompra.variacao_pct}>
                {r.taxa_recompra.valor}%
              </CartaoKpi>
            </div>
            <div className="mt-3">
              <BotaoDetalhes
                aberto={detalhe === "kpis"}
                onClick={() => alternar("kpis")}
                controlsId="fin-detalhe-kpis"
              >
                Ver faturamento por período
              </BotaoDetalhes>
            </div>
            {detalhe === "kpis" && (
              <div id="fin-detalhe-kpis" className="mt-3">
                <DetalheVendas de={de} ate={ate} granularidade={granularidade} />
              </div>
            )}
          </div>

          {/* Bloco C: DRE simplificada */}
          <div className="rounded-lg border border-borda bg-superficie p-4 sm:p-5">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-texto-suave">
              Demonstrativo do resultado (DRE)
            </h3>
            <table className="w-full text-sm">
              <tbody className="divide-y divide-borda">
                {d.dre.map((linha) => (
                  <tr
                    key={linha.linha}
                    className={linha.informativo ? "text-texto-suave" : ""}
                  >
                    <td
                      className={
                        "py-2 pr-4 " + (linha.destaque ? "font-semibold text-texto" : "text-texto-suave")
                      }
                    >
                      {linha.linha}
                    </td>
                    <td
                      className={
                        "py-2 text-right font-sans tabular-nums " +
                        (linha.destaque ? "font-semibold text-texto" : "text-texto")
                      }
                    >
                      {!linha.disponivel ? (
                        <span className="text-xs italic text-texto-suave">Em breve</span>
                      ) : (
                        <Preco valor={linha.valor} />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-3">
              <BotaoDetalhes
                aberto={detalhe === "dre"}
                onClick={() => alternar("dre")}
                controlsId="fin-detalhe-dre"
              >
                Ver como é calculado
              </BotaoDetalhes>
            </div>
            {detalhe === "dre" && (
              <div
                id="fin-detalhe-dre"
                className="mt-3 space-y-2 border-t border-borda pt-3 text-sm text-texto-suave"
              >
                <p>
                  <strong className="font-medium text-texto">Receita bruta</strong>: soma do total
                  de {r.num_vendas.valor}{" "}
                  {r.num_vendas.valor === 1 ? "pedido pago" : "pedidos pagos"} no período.
                </p>
                <p>
                  <strong className="font-medium text-texto">Descontos concedidos</strong>:
                  promoções automáticas e cupons aplicados nesses pedidos.
                </p>
                <p>
                  <strong className="font-medium text-texto">Receita líquida</strong>: a receita
                  bruta menos os descontos.
                </p>
                <p>
                  <strong className="font-medium text-texto">Pedidos em revisão</strong>:{" "}
                  {d.em_revisao.num}{" "}
                  {d.em_revisao.num === 1 ? "pedido somando" : "pedidos somando"}{" "}
                  <Preco valor={d.em_revisao.total} /> a estornar (pagos no Mercado Pago, mas não
                  atendidos). São informativos: não entram como dedução da receita.
                </p>
                <p className="text-xs">
                  CMV, lucro bruto, margem e despesas chegam nas próximas fases (cadastro de custo
                  das peças e de despesas).
                </p>
              </div>
            )}
          </div>

          {/* Bloco D: clientes / recompra (agregado, sem dados pessoais) */}
          <div className="rounded-lg border border-borda bg-superficie p-4 sm:p-5">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-texto-suave">
              <Users size={16} aria-hidden="true" /> Clientes e recompra
            </h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Cartao rotulo="Clientes que já compraram">{d.clientes.total}</Cartao>
              <Cartao rotulo="Clientes recorrentes (2+ compras)">{d.clientes.recorrentes}</Cartao>
              <Cartao rotulo="Taxa de recompra">{d.clientes.taxa_recompra}%</Cartao>
            </div>
            <div className="mt-3">
              <BotaoDetalhes
                aberto={detalhe === "clientes"}
                onClick={() => alternar("clientes")}
                controlsId="fin-detalhe-clientes"
              >
                Ver detalhes
              </BotaoDetalhes>
            </div>
            {detalhe === "clientes" && (
              <div
                id="fin-detalhe-clientes"
                className="mt-3 space-y-2 border-t border-borda pt-3 text-sm text-texto-suave"
              >
                <p>
                  A recompra considera toda a vida da loja (não o período do filtro): a fração dos
                  clientes com pelo menos uma compra paga que já compraram 2 ou mais vezes.
                </p>
                <p>
                  Hoje {d.clientes.recorrentes} de {d.clientes.total}{" "}
                  {d.clientes.total === 1 ? "cliente" : "clientes"} que já compraram voltaram a
                  comprar, o que dá {d.clientes.taxa_recompra}% de recompra.
                </p>
                <p className="text-xs">
                  Para preservar a privacidade (LGPD), este bloco é agregado: não mostra nome,
                  contato nem CPF.
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// --------------------------------------------------------------------------
// 1) Vendas por período
// --------------------------------------------------------------------------
function VendasPeriodo() {
  const [de, setDe] = useState(inicioMesISO);
  const [ate, setAte] = useState(HOJE_ISO);
  const [granularidade, setGranularidade] = useState("dia");
  const exp = useExportador("vendas-por-periodo");
  const ord = useOrdenacao("rel-vendas", { coluna: "data", direcao: "asc" });

  const q = useQuery({
    queryKey: ["rel", "vendas", de, ate, granularidade],
    queryFn: () => relatorioVendasPeriodo({ de, ate, granularidade }),
  });

  const series = q.data?.series ?? [];
  const totais = q.data?.totais;
  const dadosGrafico = series.map((s) => ({ ...s, valor: Number(s.faturamento) }));

  const lista = ordenarPor(series, ord.ordenacao.coluna, ord.ordenacao.direcao, {
    data: (s) => s.data ?? "",
    faturamento: (s) => Number(s.faturamento) || 0,
    pedidos: (s) => s.pedidos,
  });
  const pag = usePaginacao(lista, {
    resetKey: `${de}|${ate}|${granularidade}|${ord.ordenacao.coluna}|${ord.ordenacao.direcao}`,
  });

  return (
    <div className="space-y-5">
      {/* Filtros + exportar */}
      <div className="flex flex-wrap items-end justify-between gap-3 rounded-lg border border-borda bg-fundo p-4">
        <div className="flex flex-wrap items-end gap-3">
          <CampoData id="vp-de" label="De" value={de} onChange={setDe} max={ate || HOJE_ISO} />
          <CampoData id="vp-ate" label="Até" value={ate} onChange={setAte} min={de} max={HOJE_ISO} />
          <div className="w-40">
            <label htmlFor="vp-gran" className="mb-1 block text-sm font-medium text-texto">
              Agrupar por
            </label>
            <select
              id="vp-gran"
              value={granularidade}
              onChange={(e) => setGranularidade(e.target.value)}
              className={inputClasse}
            >
              <option value="dia">Dia</option>
              <option value="semana">Semana</option>
              <option value="mes">Mês</option>
            </select>
          </div>
        </div>
        <ExportarBox baixando={exp.baixando} aoExportar={(formato) => exp.exportar({ de, ate, granularidade, formato })} />
      </div>
      <Feedback tipo="erro">{exp.erro}</Feedback>

      {q.isLoading && <Carregando texto="Carregando relatório…" />}
      {q.isError && <Erro mensagem={q.error.message} aoTentarNovamente={q.refetch} />}

      {q.data && (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Cartao rotulo="Faturamento">
              <Preco valor={totais.faturamento} className="font-sans" />
            </Cartao>
            <Cartao rotulo="Pedidos pagos">{totais.pedidos}</Cartao>
            <Cartao rotulo="Ticket médio">
              <Preco valor={totais.ticket_medio} className="font-sans" />
            </Cartao>
          </div>

          <PainelGrafico titulo="Faturamento no período" vazio={series.length === 0}>
            <BarChart data={dadosGrafico} margin={{ top: 18, right: 8, bottom: 4, left: -6 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={COR_BORDA} vertical={false} />
              <XAxis dataKey="periodo" tick={{ fontSize: 11, fill: COR_TEXTO_SUAVE }} interval="preserveStartEnd" angle={-15} textAnchor="end" height={48} />
              <YAxis width={44} tick={{ fontSize: 11, fill: COR_TEXTO_SUAVE }} tickFormatter={(v) => brl.format(v)} />
              <Tooltip formatter={(v) => brl.format(v)} labelStyle={{ color: COR_TEXTO }} />
              <Bar dataKey="valor" name="Faturamento" fill={COR_ACENTO} radius={[4, 4, 0, 0]}>
                <LabelList dataKey="valor" position="top" fontSize={10} fill={COR_TEXTO} formatter={(v) => brl.format(v)} />
              </Bar>
            </BarChart>
          </PainelGrafico>

          {series.length === 0 ? (
            <Vazio texto="Nenhuma venda paga nesse período." />
          ) : (
            <>
              <OrdenarMobile
                className="mb-3"
                ordenacao={ord.ordenacao}
                aoOrdenar={ord.alternar}
                colunas={[
                  { coluna: "data", rotulo: "Período" },
                  { coluna: "faturamento", rotulo: "Faturamento" },
                  { coluna: "pedidos", rotulo: "Pedidos" },
                ]}
              />
              <div className="sm:overflow-x-auto sm:rounded-lg sm:border sm:border-borda">
                <table className="tabela-cartoes w-full text-left text-sm">
                  <thead className="border-b border-borda text-texto-suave">
                    <tr>
                      <CabecalhoOrdenavel coluna="data" rotulo="Período" ordenacao={ord.ordenacao} aoOrdenar={ord.alternar} />
                      <CabecalhoOrdenavel coluna="faturamento" rotulo="Faturamento" ordenacao={ord.ordenacao} aoOrdenar={ord.alternar} />
                      <CabecalhoOrdenavel coluna="pedidos" rotulo="Pedidos" ordenacao={ord.ordenacao} aoOrdenar={ord.alternar} />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-borda">
                    {pag.itensPagina.map((s) => (
                      <tr key={s.data ?? s.periodo}>
                        <td className="cel-principal px-4 py-3 font-medium text-texto" data-rotulo="Período">
                          {s.periodo}
                        </td>
                        <td className="px-4 py-3 text-texto" data-rotulo="Faturamento">
                          <Preco valor={s.faturamento} />
                        </td>
                        <td className="px-4 py-3 text-texto-suave" data-rotulo="Pedidos">
                          {s.pedidos}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Paginacao
                pagina={pag.pagina}
                totalPaginas={pag.totalPaginas}
                total={pag.total}
                porPagina={pag.porPagina}
                aoMudar={pag.setPagina}
                rotuloItens="períodos"
              />
            </>
          )}
        </>
      )}
    </div>
  );
}

// --------------------------------------------------------------------------
// 2) Produtos mais vendidos
// --------------------------------------------------------------------------
function ProdutosVendidos() {
  const [de, setDe] = useState(inicioMesISO);
  const [ate, setAte] = useState(HOJE_ISO);
  const [top, setTop] = useState("20");
  const exp = useExportador("produtos-mais-vendidos");
  const ord = useOrdenacao("rel-produtos", { coluna: "quantidade", direcao: "desc" });

  const q = useQuery({
    queryKey: ["rel", "produtos", de, ate, top],
    queryFn: () => relatorioProdutosVendidos({ de, ate, top }),
  });

  const itens = q.data?.itens ?? [];
  const dadosGrafico = itens
    .slice(0, 10)
    .map((i) => ({ nome: `${i.peca_nome} ${i.variacao_descricao}`.trim(), quantidade: i.quantidade }));

  const lista = ordenarPor(itens, ord.ordenacao.coluna, ord.ordenacao.direcao, {
    peca: (i) => i.peca_nome,
    quantidade: (i) => i.quantidade,
    receita: (i) => Number(i.receita) || 0,
  });
  const pag = usePaginacao(lista, {
    resetKey: `${de}|${ate}|${top}|${ord.ordenacao.coluna}|${ord.ordenacao.direcao}`,
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3 rounded-lg border border-borda bg-fundo p-4">
        <div className="flex flex-wrap items-end gap-3">
          <CampoData id="pr-de" label="De" value={de} onChange={setDe} max={ate || HOJE_ISO} />
          <CampoData id="pr-ate" label="Até" value={ate} onChange={setAte} min={de} max={HOJE_ISO} />
          <div className="w-40">
            <label htmlFor="pr-top" className="mb-1 block text-sm font-medium text-texto">
              Mostrar
            </label>
            <select id="pr-top" value={top} onChange={(e) => setTop(e.target.value)} className={inputClasse}>
              <option value="10">Top 10</option>
              <option value="20">Top 20</option>
              <option value="50">Top 50</option>
            </select>
          </div>
        </div>
        <ExportarBox baixando={exp.baixando} aoExportar={(formato) => exp.exportar({ de, ate, top, formato })} />
      </div>
      <Feedback tipo="erro">{exp.erro}</Feedback>

      {q.isLoading && <Carregando texto="Carregando relatório…" />}
      {q.isError && <Erro mensagem={q.error.message} aoTentarNovamente={q.refetch} />}

      {q.data && (
        itens.length === 0 ? (
          <Vazio texto="Nenhum produto vendido nesse período." />
        ) : (
          <>
            <PainelGrafico titulo="Top vendidos (quantidade)" vazio={dadosGrafico.length === 0}>
              <BarChart data={dadosGrafico} layout="vertical" margin={{ top: 4, right: 24, bottom: 4, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={COR_BORDA} horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: COR_TEXTO_SUAVE }} />
                <YAxis type="category" dataKey="nome" width={120} tick={{ fontSize: 10, fill: COR_TEXTO_SUAVE }} />
                <Tooltip />
                <Bar dataKey="quantidade" name="Quantidade" fill={COR_ACENTO_CLARO} radius={[0, 4, 4, 0]}>
                  <LabelList dataKey="quantidade" position="right" fontSize={11} fill={COR_TEXTO} />
                </Bar>
              </BarChart>
            </PainelGrafico>

            <OrdenarMobile
              className="mb-3"
              ordenacao={ord.ordenacao}
              aoOrdenar={ord.alternar}
              colunas={[
                { coluna: "peca", rotulo: "Peça" },
                { coluna: "quantidade", rotulo: "Quantidade" },
                { coluna: "receita", rotulo: "Receita" },
              ]}
            />
            <div className="sm:overflow-x-auto sm:rounded-lg sm:border sm:border-borda">
              <table className="tabela-cartoes w-full text-left text-sm">
                <thead className="border-b border-borda text-texto-suave">
                  <tr>
                    <CabecalhoOrdenavel coluna="peca" rotulo="Peça" ordenacao={ord.ordenacao} aoOrdenar={ord.alternar} />
                    <th className="px-4 py-3 font-medium">Variação</th>
                    <CabecalhoOrdenavel coluna="quantidade" rotulo="Quantidade" ordenacao={ord.ordenacao} aoOrdenar={ord.alternar} />
                    <CabecalhoOrdenavel coluna="receita" rotulo="Receita" ordenacao={ord.ordenacao} aoOrdenar={ord.alternar} />
                  </tr>
                </thead>
                <tbody className="divide-y divide-borda">
                  {pag.itensPagina.map((i) => (
                    <tr key={i.variacao_id}>
                      <td className="cel-principal px-4 py-3 font-medium text-texto" data-rotulo="Peça">
                        <span className="block max-w-[16rem] truncate" title={i.peca_nome}>
                          {i.peca_nome}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-texto-suave" data-rotulo="Variação">
                        {i.variacao_descricao}
                      </td>
                      <td className="px-4 py-3 text-texto" data-rotulo="Quantidade">
                        {i.quantidade}
                      </td>
                      <td className="px-4 py-3 text-texto" data-rotulo="Receita">
                        <Preco valor={i.receita} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Paginacao
              pagina={pag.pagina}
              totalPaginas={pag.totalPaginas}
              total={pag.total}
              porPagina={pag.porPagina}
              aoMudar={pag.setPagina}
              rotuloItens="produtos"
            />
          </>
        )
      )}
    </div>
  );
}

// --------------------------------------------------------------------------
// 3) Resumo do mês (com análise de cupons)
// --------------------------------------------------------------------------
function ResumoMes() {
  const [mes, setMes] = useState(mesAtualISO);
  const exp = useExportador("resumo-do-mes");
  const ord = useOrdenacao("rel-resumo-cupons", { coluna: "valor", direcao: "desc" });

  const q = useQuery({
    queryKey: ["rel", "resumo", mes],
    queryFn: () => relatorioResumoMes({ mes }),
  });

  const d = q.data;
  const cupons = d?.cupons ?? [];
  const lista = ordenarPor(cupons, ord.ordenacao.coluna, ord.ordenacao.direcao, {
    nome: (c) => c.nome,
    usos: (c) => c.usos,
    valor: (c) => Number(c.valor_descontado) || 0,
  });
  const pag = usePaginacao(lista, {
    resetKey: `${mes}|${ord.ordenacao.coluna}|${ord.ordenacao.direcao}`,
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3 rounded-lg border border-borda bg-fundo p-4">
        <div className="w-48">
          <label htmlFor="rm-mes" className="mb-1 block text-sm font-medium text-texto">
            Mês de referência
          </label>
          <input
            id="rm-mes"
            type="month"
            value={mes}
            max={mesAtualISO()}
            onChange={(e) => setMes(e.target.value)}
            className={inputClasse}
          />
        </div>
        <ExportarBox baixando={exp.baixando} aoExportar={(formato) => exp.exportar({ mes, formato })} />
      </div>
      <Feedback tipo="erro">{exp.erro}</Feedback>

      {q.isLoading && <Carregando texto="Carregando relatório…" />}
      {q.isError && <Erro mensagem={q.error.message} aoTentarNovamente={q.refetch} />}

      {d && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Cartao rotulo="Faturamento">
              <Preco valor={d.faturamento} className="font-sans" />
            </Cartao>
            <Cartao rotulo="Vendas pagas">{d.num_vendas}</Cartao>
            <Cartao rotulo="Ticket médio">
              <Preco valor={d.ticket_medio} className="font-sans" />
            </Cartao>
            <Cartao rotulo="Desconto concedido">
              <Preco valor={d.desconto_concedido} className="font-sans" />
            </Cartao>
          </div>

          <div>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-texto-suave">
              Cupons usados em {d.mes_rotulo}
            </h2>
            {cupons.length === 0 ? (
              <Vazio texto="Nenhum cupom foi usado neste mês." />
            ) : (
              <>
                <OrdenarMobile
                  className="mb-3"
                  ordenacao={ord.ordenacao}
                  aoOrdenar={ord.alternar}
                  colunas={[
                    { coluna: "nome", rotulo: "Cupom" },
                    { coluna: "usos", rotulo: "Usos" },
                    { coluna: "valor", rotulo: "Valor descontado" },
                  ]}
                />
                <div className="sm:overflow-x-auto sm:rounded-lg sm:border sm:border-borda">
                  <table className="tabela-cartoes w-full text-left text-sm">
                    <thead className="border-b border-borda text-texto-suave">
                      <tr>
                        <CabecalhoOrdenavel coluna="nome" rotulo="Cupom" ordenacao={ord.ordenacao} aoOrdenar={ord.alternar} />
                        <th className="px-4 py-3 font-medium">Código</th>
                        <CabecalhoOrdenavel coluna="usos" rotulo="Usos" ordenacao={ord.ordenacao} aoOrdenar={ord.alternar} />
                        <CabecalhoOrdenavel coluna="valor" rotulo="Valor descontado" ordenacao={ord.ordenacao} aoOrdenar={ord.alternar} />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-borda">
                      {pag.itensPagina.map((c) => (
                        <tr key={c.codigo || c.nome}>
                          <td className="cel-principal px-4 py-3 font-medium text-texto" data-rotulo="Cupom">
                            {c.nome}
                          </td>
                          <td className="px-4 py-3 font-mono text-texto-suave" data-rotulo="Código">
                            {c.codigo || "sem código"}
                          </td>
                          <td className="px-4 py-3 text-texto" data-rotulo="Usos">
                            {c.usos}
                          </td>
                          <td className="px-4 py-3 text-texto" data-rotulo="Valor descontado">
                            <Preco valor={c.valor_descontado} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Paginacao
                  pagina={pag.pagina}
                  totalPaginas={pag.totalPaginas}
                  total={pag.total}
                  porPagina={pag.porPagina}
                  aoMudar={pag.setPagina}
                  rotuloItens="cupons"
                />
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
