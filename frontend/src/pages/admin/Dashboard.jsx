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
} from "recharts";
import { listarCategorias } from "../../lib/api";
import { useAdminPecas } from "../../hooks/useAdminPecas";
import { useAdminEncomendas } from "../../hooks/useAdminEncomendas";
import { responderPergunta } from "../../lib/perguntas";
import { Carregando, Erro } from "../../components/Estado";
import { inputClasse } from "../../components/admin/ui";

// Paleta dos gráficos (tokens do STYLE.md).
const COR_ACENTO = "#7e4e2e";
const COR_ACENTO_CLARO = "#b07a56";
const COR_SUCESSO = "#2e6b49";
const COR_ESGOTADO = "#8c887f";

const ROTULO_STATUS = {
  recebido: "Recebidas",
  em_andamento: "Em andamento",
  concluida: "Concluídas",
  cancelada: "Canceladas",
};

function Cartao({ titulo, valor, destaque }) {
  return (
    <div className="rounded-lg border border-borda bg-superficie p-5">
      <p className="text-sm text-texto-suave">{titulo}</p>
      <p
        className={
          "mt-1 font-display text-3xl font-semibold " +
          (destaque ? "text-erro" : "text-texto")
        }
      >
        {valor}
      </p>
    </div>
  );
}

function PainelGrafico({ titulo, children, vazio }) {
  return (
    <div className="rounded-lg border border-borda bg-superficie p-5">
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-texto-suave">
        {titulo}
      </h3>
      {vazio ? (
        <p className="py-8 text-center text-sm text-texto-suave">Sem dados ainda.</p>
      ) : (
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            {children}
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  const pecasQ = useAdminPecas();
  const catQ = useQuery({ queryKey: ["categorias"], queryFn: listarCategorias });
  const encomendasQ = useAdminEncomendas();

  const pecas = useMemo(() => pecasQ.data ?? [], [pecasQ.data]);
  const categoriasLista = useMemo(
    () => (Array.isArray(catQ.data) ? catQ.data : catQ.data?.results ?? []),
    [catQ.data]
  );
  const encomendas = useMemo(() => encomendasQ.data ?? [], [encomendasQ.data]);

  // ---- Métricas dos cartões ----
  const ativas = pecas.filter((p) => p.ativo).length;
  const ocultas = pecas.length - ativas;
  const destaques = pecas.filter((p) => p.destaque).length;
  const variacoes = pecas.flatMap((p) => p.variacoes ?? []);
  const esgotadas = variacoes.filter((v) => v.esgotado).length;
  const disponiveis = variacoes.length - esgotadas;
  const totalCategorias =
    catQ.data?.count ?? categoriasLista.length ?? 0;
  const encomendasNovas = encomendas.filter((e) => e.status === "recebido").length;

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
      { nome: "Esgotadas", valor: esgotadas, cor: COR_ESGOTADO },
    ],
    [disponiveis, esgotadas]
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

  return (
    <section>
      <h1 className="mb-6 font-display text-3xl font-semibold">Resumo</h1>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <Cartao titulo="Total de peças" valor={pecas.length} />
        <Cartao titulo="Ativas na vitrine" valor={ativas} />
        <Cartao titulo="Ocultas" valor={ocultas} />
        <Cartao titulo="Variações" valor={variacoes.length} />
        <Cartao titulo="Esgotadas" valor={esgotadas} destaque={esgotadas > 0} />
        <Cartao titulo="Categorias" valor={totalCategorias} />
        <Link
          to="/admin/destaques"
          className="rounded-lg border border-borda bg-superficie p-5 transition hover:border-acento-escuro focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acento-escuro"
        >
          <p className="text-sm text-texto-suave">Peças em destaque</p>
          <p className="mt-1 font-display text-3xl font-semibold text-texto">
            {destaques}
          </p>
        </Link>
        <Cartao
          titulo="Encomendas novas"
          valor={encomendasNovas}
          destaque={encomendasNovas > 0}
        />
      </div>

      {/* ---- Gráficos ---- */}
      <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-texto-suave">
        Visão geral
      </h2>
      <div className="grid gap-4 lg:grid-cols-2">
        <PainelGrafico titulo="Peças por categoria" vazio={pecas.length === 0}>
          <BarChart data={dadosCategorias} margin={{ top: 8, right: 8, bottom: 8, left: -16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#d6cfc4" vertical={false} />
            <XAxis dataKey="nome" tick={{ fontSize: 12, fill: "#57534e" }} interval={0} angle={-15} textAnchor="end" height={50} />
            <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "#57534e" }} />
            <Tooltip />
            <Bar dataKey="total" name="Peças" fill={COR_ACENTO} radius={[4, 4, 0, 0]} />
          </BarChart>
        </PainelGrafico>

        <PainelGrafico titulo="Estoque: disponíveis × esgotadas" vazio={variacoes.length === 0}>
          <PieChart>
            <Pie
              data={dadosEstoque}
              dataKey="valor"
              nameKey="nome"
              innerRadius={55}
              outerRadius={85}
              paddingAngle={2}
            >
              {dadosEstoque.map((d) => (
                <Cell key={d.nome} fill={d.cor} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </PainelGrafico>

        <PainelGrafico titulo="Encomendas por status" vazio={encomendas.length === 0}>
          <BarChart data={dadosEncomendas} margin={{ top: 8, right: 8, bottom: 8, left: -16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#d6cfc4" vertical={false} />
            <XAxis dataKey="nome" tick={{ fontSize: 12, fill: "#57534e" }} interval={0} />
            <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "#57534e" }} />
            <Tooltip />
            <Bar dataKey="total" name="Encomendas" fill={COR_ACENTO_CLARO} radius={[4, 4, 0, 0]} />
          </BarChart>
        </PainelGrafico>

        <CaixaPerguntas pecas={pecas} variacoes={variacoes} encomendas={encomendas} />
      </div>
    </section>
  );
}

// Caixinha de perguntas em linguagem natural (mapeia a pergunta a intenções por
// palavras-chave, sem API paga — números já calculados das queries existentes).
function CaixaPerguntas({ pecas, variacoes, encomendas }) {
  const [pergunta, setPergunta] = useState("");
  const [resposta, setResposta] = useState("");

  function responder(e) {
    e.preventDefault();
    setResposta(responderPergunta(pergunta, { pecas, variacoes, encomendas }));
  }

  return (
    <div className="rounded-lg border border-borda bg-superficie p-5">
      <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-texto-suave">
        Pergunte ao painel
      </h3>
      <p className="mb-3 text-xs text-texto-suave">
        Ex.: “quantas peças esgotadas?”, “quais peças sem foto?”, “encomendas
        recebidas este mês?”
      </p>
      <form onSubmit={responder} className="flex flex-col gap-2 sm:flex-row">
        <input
          type="text"
          value={pergunta}
          onChange={(e) => setPergunta(e.target.value)}
          placeholder="Digite sua pergunta..."
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
        <p className="mt-3 rounded-lg border border-borda bg-fundo px-4 py-3 text-sm text-texto" role="status">
          {resposta}
        </p>
      )}
    </div>
  );
}
