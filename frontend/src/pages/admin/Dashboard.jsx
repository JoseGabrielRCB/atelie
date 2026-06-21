import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { listarCategorias } from "../../lib/api";
import { useAdminPecas } from "../../hooks/useAdminPecas";
import { useAdminEncomendas } from "../../hooks/useAdminEncomendas";
import { Carregando, Erro } from "../../components/Estado";

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

function Atalho({ para, children }) {
  return (
    <Link
      to={para}
      className="rounded-lg border border-borda bg-superficie px-4 py-3 text-sm font-medium text-texto transition hover:border-acento-escuro hover:text-acento-escuro focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acento-escuro"
    >
      {children}
    </Link>
  );
}

export default function Dashboard() {
  const pecasQ = useAdminPecas();
  const catQ = useQuery({ queryKey: ["categorias"], queryFn: listarCategorias });
  const encomendasQ = useAdminEncomendas();

  if (pecasQ.isLoading) return <Carregando texto="Carregando resumo..." />;
  if (pecasQ.isError)
    return <Erro mensagem={pecasQ.error.message} aoTentarNovamente={pecasQ.refetch} />;

  const pecas = pecasQ.data ?? [];
  const ativas = pecas.filter((p) => p.ativo).length;
  const ocultas = pecas.length - ativas;
  const variacoes = pecas.flatMap((p) => p.variacoes ?? []);
  const esgotadas = variacoes.filter((v) => v.esgotado).length;
  const totalCategorias = catQ.data?.count ?? catQ.data?.results?.length ?? 0;
  const encomendasNovas =
    (encomendasQ.data ?? []).filter((e) => e.status === "recebido").length;

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
        <Cartao
          titulo="Encomendas novas"
          valor={encomendasNovas}
          destaque={encomendasNovas > 0}
        />
      </div>

      <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-texto-suave">
        Atalhos
      </h2>
      <div className="flex flex-wrap gap-3">
        <Atalho para="/admin/pecas?nova=1">+ Nova peça</Atalho>
        <Atalho para="/admin/pecas">Gerenciar peças</Atalho>
        <Atalho para="/admin/estoque">Controle de estoque</Atalho>
        <Atalho para="/admin/categorias">Categorias e vitrine</Atalho>
        <Atalho para="/admin/encomendas">Ver encomendas</Atalho>
      </div>
    </section>
  );
}
