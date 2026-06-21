import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { usePecas } from "../hooks/usePecas";
import Filtro from "../components/Filtro";
import PecaCard from "../components/PecaCard";
import { Erro, Vazio, GradeSkeleton } from "../components/Estado";
import { SITE } from "../config/site";
import { useSeo } from "../seo/useSeo";
import { getMeta } from "../seo/meta";

export default function Vitrine() {
  useSeo(getMeta("/vitrine"));
  const [busca, setBusca] = useState("");
  const [buscaDebounced, setBuscaDebounced] = useState("");
  const [categoria, setCategoria] = useState("");

  // Espera o usuário parar de digitar antes de consultar a API.
  useEffect(() => {
    const t = setTimeout(() => setBuscaDebounced(busca), 350);
    return () => clearTimeout(t);
  }, [busca]);

  const {
    data: pecas,
    isLoading, // só true no primeiro carregamento (sem dados anteriores)
    isError,
    error,
    refetch,
    isFetching,
    isPlaceholderData, // true enquanto mostra resultados antigos durante a troca de filtro
  } = usePecas({
    search: buscaDebounced,
    categoria,
    ordering: "-criado_em",
  });

  // Feedback sutil: enquanto busca a nova consulta, mantém o conteúdo com leve opacidade.
  const atualizando = isPlaceholderData || (isFetching && !isLoading);

  return (
    <section>
      <div className="mb-6">
        <h1 className="font-display text-3xl font-semibold text-texto sm:text-4xl">
          Vitrine
        </h1>
        <p className="mt-1 text-texto-suave">
          Conheça as peças disponíveis no {SITE.nome} em {SITE.cidade}.
        </p>
      </div>

      <Filtro
        busca={busca}
        onBusca={setBusca}
        categoria={categoria}
        onCategoria={setCategoria}
      />

      {/* Altura mínima reservada para evitar salto de layout ao filtrar. */}
      <div className="min-h-[60vh]">
        {isLoading && <GradeSkeleton />}

        {isError && <Erro mensagem={error.message} aoTentarNovamente={refetch} />}

        {!isLoading && !isError && pecas.length === 0 && (
          <Vazio texto="Nenhuma peça encontrada." />
        )}

        {!isLoading && !isError && pecas.length > 0 && (
          <div
            aria-busy={atualizando}
            className={
              "grid grid-cols-2 gap-4 transition-opacity duration-200 sm:grid-cols-3 lg:grid-cols-4 " +
              (atualizando ? "opacity-60" : "opacity-100")
            }
          >
            {pecas.map((peca) => (
              <PecaCard key={peca.id} peca={peca} />
            ))}
          </div>
        )}
      </div>

      {/* CTA: encomenda sob medida (para quem não achou o que procurava) */}
      <div className="mt-10 flex flex-col items-center gap-3 rounded-lg border border-borda bg-superficie px-6 py-8 text-center sm:flex-row sm:justify-between sm:text-left">
        <div>
          <h2 className="font-display text-2xl font-semibold text-texto">
            Não encontrou o que procurava?
          </h2>
          <p className="mt-1 text-texto-suave">
            Faça uma encomenda sob medida: descreva a peça e anexe fotos de
            referência.
          </p>
        </div>
        <Link
          to="/encomenda"
          className="inline-flex flex-shrink-0 items-center justify-center rounded-lg bg-acento-escuro px-6 py-3 font-medium text-white transition hover:bg-acento-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acento-escuro focus-visible:ring-offset-2 focus-visible:ring-offset-fundo"
        >
          Fazer encomenda sob medida
        </Link>
      </div>
    </section>
  );
}
