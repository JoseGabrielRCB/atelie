import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { usePecasPaginadas } from "../hooks/usePecas";
import Filtro from "../components/Filtro";
import PecaCard from "../components/PecaCard";
import { Paginacao } from "../components/admin/Paginacao";
import { Erro, Vazio, GradeSkeleton } from "../components/Estado";
import { SITE } from "../config/site";
import { useSeo } from "../seo/useSeo";
import { getMeta } from "../seo/meta";

// Tamanho de página do backend (PageNumberPagination, PAGE_SIZE=20).
const PECAS_POR_PAGINA = 20;

// Estado da vitrine guardado por sessão (some ao fechar a aba): busca, categoria,
// página e rolagem. Serve para retomar a vitrine no mesmo ponto ao voltar de uma
// peça — sem precisar rolar tudo de novo.
const CHAVE_ESTADO = "vitrine:estado";

function lerEstadoSalvo() {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.sessionStorage.getItem(CHAVE_ESTADO)) || {};
  } catch {
    return {};
  }
}

function salvarEstado(parcial) {
  if (typeof window === "undefined") return;
  try {
    const atual = lerEstadoSalvo();
    window.sessionStorage.setItem(
      CHAVE_ESTADO,
      JSON.stringify({ ...atual, ...parcial })
    );
  } catch {
    /* sessionStorage indisponível (modo privado/cota): ignora. */
  }
}

export default function Vitrine() {
  useSeo(getMeta("/vitrine"));

  // Lê o estado salvo uma única vez por montagem (volta da peça → retoma aqui).
  const salvo = useMemo(() => lerEstadoSalvo(), []);

  const [busca, setBusca] = useState(salvo.busca || "");
  const [buscaDebounced, setBuscaDebounced] = useState(salvo.busca || "");
  const [categoria, setCategoria] = useState(salvo.categoria || "");
  const [pagina, setPagina] = useState(salvo.pagina || 1);

  // Espera o usuário parar de digitar antes de consultar a API.
  useEffect(() => {
    const t = setTimeout(() => setBuscaDebounced(busca), 350);
    return () => clearTimeout(t);
  }, [busca]);

  // Volta à página 1 quando busca/categoria mudam: feito nos handlers do Filtro
  // (abaixo), não num efeito — assim a página restaurada não é zerada ao montar.

  // Persiste busca/categoria/página a cada mudança (para retomar ao voltar).
  useEffect(() => {
    salvarEstado({ busca, categoria, pagina });
  }, [busca, categoria, pagina]);

  // Salva a posição de rolagem enquanto o usuário rola (1 gravação por frame).
  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    let agendado = false;
    function aoRolar() {
      if (agendado) return;
      agendado = true;
      window.requestAnimationFrame(() => {
        salvarEstado({ scrollY: window.scrollY });
        agendado = false;
      });
    }
    window.addEventListener("scroll", aoRolar, { passive: true });
    return () => window.removeEventListener("scroll", aoRolar);
  }, []);

  // Muda o filtro e volta para a página 1 (a paginação reflete o filtro novo).
  function aoMudarBusca(valor) {
    setBusca(valor);
    setPagina(1);
  }
  function aoMudarCategoria(valor) {
    setCategoria(valor);
    setPagina(1);
  }

  const {
    data,
    isLoading, // só true no primeiro carregamento (sem dados anteriores)
    isError,
    error,
    refetch,
    isFetching,
    isPlaceholderData, // true enquanto mostra resultados antigos durante a troca de filtro
  } = usePecasPaginadas({
    search: buscaDebounced,
    categoria,
    ordering: "-criado_em",
    page: pagina,
  });

  const pecas = data?.itens ?? [];
  const total = data?.total ?? 0;
  const totalPaginas = Math.max(1, Math.ceil(total / PECAS_POR_PAGINA));

  // Restaura a rolagem salva assim que os dados da página estão prontos (uma vez).
  const rolagemRestaurada = useRef(false);
  useEffect(() => {
    if (rolagemRestaurada.current || isLoading) return;
    rolagemRestaurada.current = true;
    if (salvo.scrollY && typeof window !== "undefined") {
      window.scrollTo(0, salvo.scrollY);
    }
  }, [isLoading, salvo]);

  function irParaPagina(p) {
    setPagina(p);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

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
        onBusca={aoMudarBusca}
        categoria={categoria}
        onCategoria={aoMudarCategoria}
      />

      {/* Altura mínima reservada para evitar salto de layout ao filtrar. */}
      <div className="min-h-[60vh]">
        {isLoading && <GradeSkeleton />}

        {isError && <Erro mensagem={error.message} aoTentarNovamente={refetch} />}

        {!isLoading && !isError && pecas.length === 0 && (
          <Vazio texto="Nenhuma peça encontrada." />
        )}

        {!isLoading && !isError && pecas.length > 0 && (
          <>
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
            <Paginacao
              pagina={pagina}
              totalPaginas={totalPaginas}
              total={total}
              porPagina={PECAS_POR_PAGINA}
              aoMudar={irParaPagina}
              rotuloItens="peças"
            />
          </>
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
