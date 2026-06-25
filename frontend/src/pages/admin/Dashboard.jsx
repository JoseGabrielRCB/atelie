import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
  Label,
  LabelList,
} from "recharts";
import {
  Shirt,
  Eye,
  EyeOff,
  Layers,
  PackageX,
  Tag,
  Star,
  Inbox,
  BadgeDollarSign,
  Clock,
} from "lucide-react";
import { listarCategorias } from "../../lib/api";
import { useAdminPecas } from "../../hooks/useAdminPecas";
import { useAdminEncomendas } from "../../hooks/useAdminEncomendas";
import { useAdminPedidos } from "../../hooks/useAdminPedidos";
import { responderPergunta } from "../../lib/perguntas";
import { useAuth } from "../../context/AuthContext";
import { Carregando, Erro } from "../../components/Estado";
import Preco from "../../components/Preco";
import Modal from "../../components/admin/Modal";
import { Selo, inputClasse } from "../../components/admin/ui";

// Paleta dos gráficos (tokens do STYLE.md).
const COR_ACENTO = "#7e4e2e";
const COR_ACENTO_CLARO = "#b07a56";
const COR_SUCESSO = "#2e6b49";
const COR_ESGOTADO = "#8c887f";
const COR_TEXTO = "#1a1816";
const COR_TEXTO_SUAVE = "#57534e";
const COR_BORDA = "#d6cfc4";

const ROTULO_STATUS = {
  recebido: "Recebidas",
  em_andamento: "Em andamento",
  concluida: "Concluídas",
  cancelada: "Canceladas",
};

const STATUS_PEDIDO = {
  pago: { rotulo: "Pago", cor: "verde" },
  aguardando_pagamento: { rotulo: "Aguardando", cor: "acento" },
  expirado: { rotulo: "Expirado", cor: "cinza" },
  cancelado: { rotulo: "Cancelado", cor: "vermelho" },
};

function dataCurta(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function Dashboard() {
  const { podeFinanceiro } = useAuth();
  const pecasQ = useAdminPecas();
  const catQ = useQuery({ queryKey: ["categorias"], queryFn: listarCategorias });
  const encomendasQ = useAdminEncomendas();
  // Vendas/financeiro só é buscado para quem tem acesso (evita 403 do funcionário).
  const pedidosQ = useAdminPedidos({}, { enabled: podeFinanceiro });

  // Métrica aberta em detalhe (modal). null = fechado.
  const [metrica, setMetrica] = useState(null);

  const pecas = useMemo(() => pecasQ.data ?? [], [pecasQ.data]);
  const categoriasLista = useMemo(
    () => (Array.isArray(catQ.data) ? catQ.data : catQ.data?.results ?? []),
    [catQ.data]
  );
  const encomendas = useMemo(() => encomendasQ.data ?? [], [encomendasQ.data]);
  const pedidos = useMemo(() => pedidosQ.data ?? [], [pedidosQ.data]);

  // Variações com o nome da peça (para os detalhes de estoque).
  const variacoes = useMemo(
    () => pecas.flatMap((p) => (p.variacoes ?? []).map((v) => ({ ...v, pecaNome: p.nome }))),
    [pecas]
  );

  // ---- Métricas ----
  const ativas = pecas.filter((p) => p.ativo);
  const ocultas = pecas.filter((p) => !p.ativo);
  const destaques = pecas.filter((p) => p.destaque);
  const esgotadas = variacoes.filter((v) => v.esgotado);
  const disponiveis = variacoes.length - esgotadas.length;
  const totalCategorias = catQ.data?.count ?? categoriasLista.length ?? 0;
  const encomendasRecebidas = encomendas.filter((e) => e.status === "recebido");

  const agora = new Date();
  const vendasPagasMes = pedidos.filter((p) => {
    if (p.status !== "pago") return false;
    const d = new Date(p.criado_em);
    return (
      !Number.isNaN(d.getTime()) &&
      d.getFullYear() === agora.getFullYear() &&
      d.getMonth() === agora.getMonth()
    );
  });
  const pedidosAguardando = pedidos.filter((p) => p.status === "aguardando_pagamento");

  // Categorias com a contagem de peças.
  const categoriasComContagem = useMemo(
    () =>
      categoriasLista.map((c) => ({
        ...c,
        qtd: pecas.filter((p) => p.categoria === c.id).length,
      })),
    [categoriasLista, pecas]
  );

  // ---- Cartões (clicáveis → detalhe em modal) ----
  const cartoes = [
    { id: "total", titulo: "Total de peças", valor: pecas.length, Icone: Shirt, pagina: "/admin/pecas" },
    { id: "ativas", titulo: "Ativas na vitrine", valor: ativas.length, Icone: Eye, pagina: "/admin/categorias" },
    { id: "ocultas", titulo: "Ocultas", valor: ocultas.length, Icone: EyeOff, pagina: "/admin/categorias" },
    { id: "variacoes", titulo: "Variações", valor: variacoes.length, Icone: Layers, pagina: "/admin/estoque" },
    { id: "esgotadas", titulo: "Esgotadas", valor: esgotadas.length, destaque: esgotadas.length > 0, Icone: PackageX, pagina: "/admin/estoque" },
    { id: "categorias", titulo: "Categorias", valor: totalCategorias, Icone: Tag, pagina: "/admin/categorias" },
    { id: "destaques", titulo: "Peças em destaque", valor: destaques.length, Icone: Star, pagina: "/admin/destaques" },
    { id: "encomendas", titulo: "Encomendas novas", valor: encomendasRecebidas.length, destaque: encomendasRecebidas.length > 0, Icone: Inbox, pagina: "/admin/encomendas" },
    ...(podeFinanceiro
      ? [
          { id: "vendas", titulo: "Vendas pagas (mês)", valor: vendasPagasMes.length, Icone: BadgeDollarSign, pagina: "/admin/vendas" },
          { id: "aguardando", titulo: "Aguardando pagamento", valor: pedidosAguardando.length, destaque: pedidosAguardando.length > 0, Icone: Clock, pagina: "/admin/vendas" },
        ]
      : []),
  ];

  // ---- Dados dos gráficos ----
  const dadosCategorias = useMemo(() => {
    const contagem = new Map();
    categoriasLista.forEach((c) => contagem.set(c.nome, 0));
    pecas.forEach((p) => {
      const nome = p.categoria_nome ?? "(sem categoria)";
      contagem.set(nome, (contagem.get(nome) ?? 0) + 1);
    });
    return [...contagem.entries()].map(([nome, total]) => ({ nome, total }));
  }, [categoriasLista, pecas]);

  const dadosEstoque = useMemo(
    () => [
      { nome: "Disponíveis", valor: disponiveis, cor: COR_SUCESSO },
      { nome: "Esgotadas", valor: esgotadas.length, cor: COR_ESGOTADO },
    ],
    [disponiveis, esgotadas.length]
  );

  const dadosEncomendas = useMemo(() => {
    const contagem = { recebido: 0, em_andamento: 0, concluida: 0, cancelada: 0 };
    encomendas.forEach((e) => {
      if (contagem[e.status] != null) contagem[e.status] += 1;
    });
    return Object.entries(contagem).map(([status, total]) => ({
      nome: ROTULO_STATUS[status] ?? status,
      total,
    }));
  }, [encomendas]);

  if (pecasQ.isLoading) return <Carregando texto="Carregando resumo..." />;
  if (pecasQ.isError)
    return <Erro mensagem={pecasQ.error.message} aoTentarNovamente={pecasQ.refetch} />;

  // Conteúdo do modal de detalhe da métrica ativa.
  function detalhe(id) {
    switch (id) {
      case "total":
        return <ListaPecas itens={pecas} />;
      case "ativas":
        return <ListaPecas itens={ativas} />;
      case "ocultas":
        return <ListaPecas itens={ocultas} />;
      case "destaques":
        return <ListaPecas itens={destaques} vazio="Nenhuma peça em destaque." />;
      case "variacoes":
        return <ListaVariacoesPorPeca pecas={pecas} />;
      case "esgotadas":
        return <ListaVariacoesEsgotadas itens={esgotadas} />;
      case "categorias":
        return <ListaCategorias itens={categoriasComContagem} />;
      case "encomendas":
        return <ListaEncomendas itens={encomendasRecebidas} />;
      case "vendas":
        return <ListaPedidos itens={vendasPagasMes} />;
      case "aguardando":
        return <ListaPedidos itens={pedidosAguardando} />;
      default:
        return null;
    }
  }

  return (
    <section>
      <h1 className="mb-4 font-display text-3xl font-semibold">Resumo</h1>

      {/* 1) Pergunte ao painel — primeira coisa, em destaque. */}
      <CaixaPerguntas pecas={pecas} variacoes={variacoes} encomendas={encomendas} />

      {/* 5) Cartões de métrica (clicáveis → detalhe em modal). */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
        {cartoes.map((c) => (
          <CartaoMetrica key={c.id} cartao={c} onClick={() => setMetrica(c)} />
        ))}
      </div>

      {/* ---- Gráficos ---- */}
      <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-texto-suave">
        Visão geral
      </h2>
      <div className="grid gap-4 lg:grid-cols-2">
        <PainelGrafico titulo="Peças por categoria" vazio={pecas.length === 0}>
          <BarChart data={dadosCategorias} margin={{ top: 18, right: 8, bottom: 4, left: -18 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={COR_BORDA} vertical={false} />
            <XAxis dataKey="nome" tick={{ fontSize: 11, fill: COR_TEXTO_SUAVE }} interval={0} angle={-20} textAnchor="end" height={54} />
            <YAxis allowDecimals={false} width={28} tick={{ fontSize: 11, fill: COR_TEXTO_SUAVE }} />
            <Tooltip />
            <Bar dataKey="total" name="Peças" fill={COR_ACENTO} radius={[4, 4, 0, 0]}>
              <LabelList dataKey="total" position="top" fontSize={12} fill={COR_TEXTO} />
            </Bar>
          </BarChart>
        </PainelGrafico>

        <PainelGrafico titulo="Estoque: disponíveis × esgotadas" vazio={variacoes.length === 0}>
          <PieChart margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
            <Pie
              data={dadosEstoque}
              dataKey="valor"
              nameKey="nome"
              innerRadius="55%"
              outerRadius="80%"
              paddingAngle={2}
            >
              {dadosEstoque.map((d) => (
                <Cell key={d.nome} fill={d.cor} />
              ))}
              <Label
                content={(props) => <RotuloCentroRosca {...props} total={variacoes.length} />}
              />
            </Pie>
            <Tooltip />
            <Legend
              verticalAlign="bottom"
              formatter={(value, entry) => `${value}: ${entry?.payload?.valor ?? 0}`}
            />
          </PieChart>
        </PainelGrafico>

        <PainelGrafico titulo="Encomendas por status" vazio={encomendas.length === 0}>
          <BarChart data={dadosEncomendas} margin={{ top: 18, right: 8, bottom: 4, left: -18 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={COR_BORDA} vertical={false} />
            <XAxis dataKey="nome" tick={{ fontSize: 11, fill: COR_TEXTO_SUAVE }} interval={0} />
            <YAxis allowDecimals={false} width={28} tick={{ fontSize: 11, fill: COR_TEXTO_SUAVE }} />
            <Tooltip />
            <Bar dataKey="total" name="Encomendas" fill={COR_ACENTO_CLARO} radius={[4, 4, 0, 0]}>
              <LabelList dataKey="total" position="top" fontSize={12} fill={COR_TEXTO} />
            </Bar>
          </BarChart>
        </PainelGrafico>
      </div>

      {/* 3) Detalhe da métrica em modal. */}
      <Modal
        aberto={Boolean(metrica)}
        aoFechar={() => setMetrica(null)}
        titulo={metrica?.titulo}
        tamanho="lg"
      >
        {metrica && (
          <div className="space-y-4">
            <div className="max-h-[60vh] overflow-y-auto">{detalhe(metrica.id)}</div>
            <div className="flex justify-end border-t border-borda pt-4">
              <Link
                to={metrica.pagina}
                onClick={() => setMetrica(null)}
                className="text-sm font-medium text-acento-escuro hover:underline"
              >
                Abrir a página completa →
              </Link>
            </div>
          </div>
        )}
      </Modal>
    </section>
  );
}

// --------------------------------------------------------------------------
// Cartão de métrica (ícone + número + rótulo; clicável → modal de detalhe).
// --------------------------------------------------------------------------
function CartaoMetrica({ cartao, onClick }) {
  const { titulo, valor, Icone, destaque } = cartao;
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-start gap-2 rounded-lg border border-borda bg-superficie p-4 text-left transition hover:border-acento-escuro hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acento-escuro"
    >
      <span
        className={
          "inline-flex h-9 w-9 items-center justify-center rounded-lg " +
          (destaque ? "bg-erro/10 text-erro" : "bg-acento/10 text-acento-escuro")
        }
      >
        <Icone size={18} aria-hidden="true" />
      </span>
      <span className="text-sm text-texto-suave">{titulo}</span>
      <span
        className={
          "font-display text-2xl font-semibold sm:text-3xl " +
          (destaque ? "text-erro" : "text-texto")
        }
      >
        {valor}
      </span>
    </button>
  );
}

// Painel do gráfico com altura responsiva (não estoura o cartão).
function PainelGrafico({ titulo, children, vazio }) {
  return (
    <div className="rounded-lg border border-borda bg-superficie p-4 sm:p-5">
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-texto-suave">
        {titulo}
      </h3>
      {vazio ? (
        <p className="py-8 text-center text-sm text-texto-suave">Sem dados ainda.</p>
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

// Total no centro da rosca (sem depender de hover).
function RotuloCentroRosca({ viewBox, total }) {
  const { cx, cy } = viewBox || {};
  if (cx == null || cy == null) return null;
  return (
    <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central">
      <tspan x={cx} dy="-0.2em" fontSize="22" fontWeight="600" fill={COR_TEXTO}>
        {total}
      </tspan>
      <tspan x={cx} dy="1.5em" fontSize="11" fill={COR_TEXTO_SUAVE}>
        variações
      </tspan>
    </text>
  );
}

// --------------------------------------------------------------------------
// Listas de detalhe (reusam selos/cores; texto longo truncado).
// --------------------------------------------------------------------------
function Lista({ children }) {
  return <ul className="divide-y divide-borda">{children}</ul>;
}

function VazioDetalhe({ texto = "Nada por aqui." }) {
  return <p className="py-6 text-center text-sm text-texto-suave">{texto}</p>;
}

function ListaPecas({ itens, vazio = "Nenhuma peça." }) {
  if (!itens.length) return <VazioDetalhe texto={vazio} />;
  return (
    <Lista>
      {itens.map((p) => (
        <li key={p.id} className="flex items-center justify-between gap-3 py-2">
          <div className="min-w-0">
            <p className="truncate font-medium text-texto" title={p.nome}>
              {p.nome}
            </p>
            <p className="truncate text-xs text-texto-suave">{p.categoria_nome}</p>
          </div>
          {p.ativo ? <Selo cor="verde">Ativa</Selo> : <Selo cor="cinza">Oculta</Selo>}
        </li>
      ))}
    </Lista>
  );
}

function ListaVariacoesPorPeca({ pecas }) {
  const comVar = pecas.filter((p) => (p.variacoes ?? []).length > 0);
  if (!comVar.length) return <VazioDetalhe texto="Nenhuma variação cadastrada." />;
  return (
    <Lista>
      {comVar.map((p) => (
        <li key={p.id} className="flex items-center justify-between gap-3 py-2">
          <span className="min-w-0 truncate font-medium text-texto" title={p.nome}>
            {p.nome}
          </span>
          <span className="shrink-0 text-sm text-texto-suave">
            {p.variacoes.length} {p.variacoes.length === 1 ? "variação" : "variações"}
          </span>
        </li>
      ))}
    </Lista>
  );
}

function ListaVariacoesEsgotadas({ itens }) {
  if (!itens.length) return <VazioDetalhe texto="Nenhuma variação esgotada. 🎉" />;
  return (
    <Lista>
      {itens.map((v) => (
        <li key={v.id} className="flex items-center justify-between gap-3 py-2">
          <span className="min-w-0 truncate text-texto" title={v.pecaNome}>
            <span className="font-medium">{v.pecaNome}</span>
            <span className="text-texto-suave"> — {v.tamanho || "—"} / {v.cor || "—"}</span>
          </span>
          <Selo cor="vermelho">Esgotado</Selo>
        </li>
      ))}
    </Lista>
  );
}

function ListaCategorias({ itens }) {
  if (!itens.length) return <VazioDetalhe texto="Nenhuma categoria." />;
  return (
    <Lista>
      {itens.map((c) => (
        <li key={c.id} className="flex items-center justify-between gap-3 py-2">
          <span className="min-w-0 truncate font-medium text-texto" title={c.nome}>
            {c.nome}
          </span>
          <span className="shrink-0 text-sm text-texto-suave">
            {c.qtd} {c.qtd === 1 ? "peça" : "peças"}
          </span>
        </li>
      ))}
    </Lista>
  );
}

function ListaEncomendas({ itens }) {
  if (!itens.length) return <VazioDetalhe texto="Nenhuma encomenda nova." />;
  return (
    <Lista>
      {itens.map((e) => (
        <li key={e.id} className="flex items-center justify-between gap-3 py-2">
          <div className="min-w-0">
            <p className="truncate font-medium text-texto" title={e.nome}>
              {e.nome}
            </p>
            <p className="truncate text-xs text-texto-suave" title={e.descricao}>
              {e.descricao}
            </p>
          </div>
          <span className="shrink-0 text-xs text-texto-suave">{dataCurta(e.criado_em)}</span>
        </li>
      ))}
    </Lista>
  );
}

function ListaPedidos({ itens }) {
  if (!itens.length) return <VazioDetalhe texto="Nenhum pedido." />;
  return (
    <Lista>
      {itens.map((p) => {
        const info = STATUS_PEDIDO[p.status] ?? { rotulo: p.status, cor: "neutro" };
        return (
          <li key={p.id} className="flex items-center justify-between gap-3 py-2">
            <div className="min-w-0">
              <p className="truncate font-medium text-texto" title={p.nome}>
                {p.nome}
              </p>
              <p className="text-xs text-texto-suave">{dataCurta(p.criado_em)}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Preco valor={p.total} className="text-texto" />
              <Selo cor={info.cor}>{info.rotulo}</Selo>
            </div>
          </li>
        );
      })}
    </Lista>
  );
}

// --------------------------------------------------------------------------
// Caixa "Pergunte ao painel" — busca semântica (sem API paga), em destaque.
// --------------------------------------------------------------------------
function CaixaPerguntas({ pecas, variacoes, encomendas }) {
  const [pergunta, setPergunta] = useState("");
  const [resposta, setResposta] = useState("");

  function responder(e) {
    e.preventDefault();
    setResposta(responderPergunta(pergunta, { pecas, variacoes, encomendas }));
  }

  return (
    <div className="rounded-lg border border-acento/40 bg-acento/5 p-4 sm:p-5">
      <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-acento-escuro">
        Pergunte ao painel
      </h2>
      <p className="mb-3 text-xs text-texto-suave">
        Ex.: “quantas peças esgotadas?”, “quais peças sem foto?”, “encomendas
        recebidas este mês?”
      </p>
      <form onSubmit={responder} className="flex flex-col gap-2 sm:flex-row">
        <input
          type="text"
          value={pergunta}
          onChange={(e) => setPergunta(e.target.value)}
          placeholder="Digite sua pergunta…"
          aria-label="Pergunta sobre o catálogo"
          className={inputClasse + " sm:flex-1"}
        />
        <button
          type="submit"
          className="inline-flex items-center justify-center rounded-lg bg-acento-escuro px-4 py-2 font-medium text-white transition hover:bg-acento-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acento-escuro focus-visible:ring-offset-2 focus-visible:ring-offset-fundo"
        >
          Responder
        </button>
      </form>
      {resposta && (
        <p className="mt-3 rounded-lg border border-borda bg-superficie px-4 py-3 text-sm text-texto" role="status">
          {resposta}
        </p>
      )}
    </div>
  );
}
