import { Link } from "react-router-dom";
import { usePecas } from "../hooks/usePecas";
import PecaCard from "../components/PecaCard";
import { SITE, DEPOIMENTOS, FAQ } from "../config/site";
import { linkWhatsappTexto, whatsappConfigurado } from "../lib/whatsapp";
import { useSeo } from "../seo/useSeo";
import { getMeta } from "../seo/meta";

// Botões reutilizados na Home (mesma identidade do STYLE.md).
const btnPrimario =
  "inline-flex items-center justify-center rounded-lg bg-acento-escuro px-6 py-3 font-medium text-white transition hover:bg-acento-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acento-escuro focus-visible:ring-offset-2 focus-visible:ring-offset-fundo";
const btnSecundario =
  "inline-flex items-center justify-center rounded-lg border border-borda bg-superficie px-6 py-3 font-medium text-texto transition hover:border-acento-escuro hover:text-acento-escuro focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acento-escuro";

export default function Home() {
  useSeo(getMeta("/"));
  return (
    <div className="space-y-16 sm:space-y-20">
      <Hero />
      <PecasDestaque />
      <Sobre />
      <Oferecemos />
      <ComoFunciona />
      <Depoimentos />
      <Faq />
      <CtaFinal />
    </div>
  );
}

/* 1. Hero — único <h1> da página */
function Hero() {
  return (
    <section className="pt-4 text-center sm:pt-8">
      <h1 className="mx-auto max-w-3xl font-display text-4xl font-semibold leading-tight text-texto sm:text-5xl">
        Costura sob medida em Campo Grande, feita à mão no Ateliê ++
      </h1>
      <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-texto-suave">
        No Ateliê ++ criamos peças exclusivas e ajustamos roupas do seu jeito.
        Escolha uma peça pronta na vitrine ou encomende a sua — com atendimento
        próximo, por WhatsApp, em {SITE.cidade}.
      </p>
      <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <Link to="/vitrine" className={btnPrimario}>
          Ver a vitrine
        </Link>
        <Link to="/encomenda" className={btnSecundario}>
          Fazer uma encomenda
        </Link>
      </div>
      <p className="mt-4 text-sm text-texto-suave">
        Feito à mão · Atendimento por WhatsApp · {SITE.cidade}
      </p>
    </section>
  );
}

/* 2. Peças em destaque — curadoria do admin, com fallback às mais recentes */
function PecasDestaque() {
  const destaqueQ = usePecas({ destaque: true, ordering: "-criado_em" });
  const recentesQ = usePecas({ ordering: "-criado_em" });

  const destaque = destaqueQ.data ?? [];
  const recentes = recentesQ.data ?? [];
  const lista = (destaque.length ? destaque : recentes).slice(0, 8);
  const carregando = destaqueQ.isLoading || recentesQ.isLoading;

  return (
    <section>
      <div className="mb-6 text-center">
        <h2 className="font-display text-3xl font-semibold text-texto">
          Peças em destaque
        </h2>
        <p className="mx-auto mt-2 max-w-2xl text-texto-suave">
          Uma seleção das nossas peças favoritas do momento. Encontrou algo que
          gostou? É só falar com a gente.
        </p>
      </div>

      {carregando ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="aspect-[3/4] w-full rounded-lg bg-borda/60" />
              <div className="mt-3 h-4 w-3/4 rounded bg-borda/60" />
            </div>
          ))}
        </div>
      ) : lista.length > 0 ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {lista.map((peca) => (
            <PecaCard key={peca.id} peca={peca} />
          ))}
        </div>
      ) : (
        <p className="text-center text-texto-suave">
          Em breve, novas peças por aqui.
        </p>
      )}

      <div className="mt-8 text-center">
        <Link to="/vitrine" className={btnPrimario}>
          Ver vitrine completa
        </Link>
      </div>
    </section>
  );
}

/* 3. Sobre o ateliê */
function Sobre() {
  return (
    <section className="overflow-hidden rounded-lg border border-borda bg-superficie">
      <div className="grid gap-0 md:grid-cols-2">
        <img
          src="/apresentacao-atelie.jpg"
          alt="Logo do Ateliê ++ impresso, com linhas e tesoura — ateliê de costura em Campo Grande"
          loading="lazy"
          className="aspect-[4/3] w-full object-cover md:aspect-auto md:h-full"
        />
        <div className="flex flex-col justify-center gap-4 p-6 sm:p-8">
          <h2 className="font-display text-3xl font-semibold text-texto">
            Sobre o Ateliê ++
          </h2>
          <p className="leading-relaxed text-texto-suave">
            O Ateliê ++ nasceu do gosto por roupa bem-feita e do cuidado com
            cada detalhe. Há {SITE.tempoAtuacao} costurando em {SITE.cidade},
            transformamos tecidos em peças que vestem bem e duram — sejam
            modelos prontos ou criações sob medida.
          </p>
          <p className="leading-relaxed text-texto-suave">
            Trabalhamos perto de você: conversamos sobre a ideia, ajustamos as
            medidas e acompanhamos a produção do começo ao fim. Cada encomenda é
            única, feita à mão e pensada para o seu corpo e o seu estilo.
          </p>
          <p className="text-sm text-texto-suave">
            {SITE.numeroPecas} peças entregues · clientes em Campo Grande e
            região
          </p>
        </div>
      </div>
    </section>
  );
}

/* 4. O que oferecemos */
function Oferecemos() {
  return (
    <section>
      <h2 className="mb-6 text-center font-display text-3xl font-semibold text-texto">
        O que oferecemos
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-3 rounded-lg border border-borda bg-superficie p-6">
          <h3 className="font-display text-xl font-semibold text-texto">
            Peças prontas
          </h3>
          <p className="flex-1 text-texto-suave">
            Modelos disponíveis para compra imediata, com tamanho e cor à
            escolha. Veja na vitrine e finalize pelo WhatsApp.
          </p>
          <Link to="/vitrine" className={btnPrimario + " self-start"}>
            Ver a vitrine
          </Link>
        </div>
        <div className="flex flex-col gap-3 rounded-lg border border-borda bg-superficie p-6">
          <h3 className="font-display text-xl font-semibold text-texto">
            Sob medida
          </h3>
          <p className="flex-1 text-texto-suave">
            Tem uma ideia na cabeça? A gente cria para você. Envie referências e
            medidas e fazemos um orçamento sem compromisso.
          </p>
          <Link to="/encomenda" className={btnSecundario + " self-start"}>
            Fazer uma encomenda
          </Link>
        </div>
      </div>
    </section>
  );
}

/* 5. Como funciona */
const PASSOS = [
  {
    titulo: "Escolha ou descreva",
    texto: "Pegue uma peça na vitrine ou conte o que você imagina.",
  },
  {
    titulo: "Fale com o ateliê",
    texto: "Envie pelo WhatsApp ou preencha a encomenda com fotos e medidas.",
  },
  {
    titulo: "Combinamos tudo",
    texto: "Alinhamos detalhes, valor e prazo com você.",
  },
  {
    titulo: "Produção e entrega",
    texto: "Costuramos com carinho e combinamos a entrega.",
  },
];

function ComoFunciona() {
  return (
    <section>
      <h2 className="mb-6 text-center font-display text-3xl font-semibold text-texto">
        Como funciona
      </h2>
      <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {PASSOS.map((passo, i) => (
          <li
            key={passo.titulo}
            className="rounded-lg border border-borda bg-superficie p-5"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-acento-escuro font-display text-lg font-semibold text-white">
              {i + 1}
            </span>
            <h3 className="mt-3 font-medium text-texto">{passo.titulo}</h3>
            <p className="mt-1 text-sm text-texto-suave">{passo.texto}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

/* 6. Depoimentos */
function Depoimentos() {
  return (
    <section>
      <h2 className="mb-6 text-center font-display text-3xl font-semibold text-texto">
        O que dizem nossas clientes
      </h2>
      <div className="grid gap-4 sm:grid-cols-3">
        {DEPOIMENTOS.map((d, i) => (
          <figure
            key={i}
            className="flex flex-col gap-3 rounded-lg border border-borda bg-superficie p-6"
          >
            <blockquote className="flex-1 leading-relaxed text-texto">
              “{d.texto}”
            </blockquote>
            <figcaption className="text-sm font-medium text-texto-suave">
              — {d.autor}
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

/* 7. FAQ */
function Faq() {
  return (
    <section>
      <h2 className="mb-6 text-center font-display text-3xl font-semibold text-texto">
        Perguntas frequentes
      </h2>
      <div className="mx-auto max-w-3xl divide-y divide-borda overflow-hidden rounded-lg border border-borda bg-superficie">
        {FAQ.map((item) => (
          <details key={item.pergunta} className="group p-5">
            <summary className="cursor-pointer list-none font-medium text-texto marker:content-none">
              {item.pergunta}
            </summary>
            <p className="mt-2 leading-relaxed text-texto-suave">
              {item.resposta}
            </p>
          </details>
        ))}
      </div>
    </section>
  );
}

/* 8. CTA final */
function CtaFinal() {
  const texto =
    "Olá! Vim pelo site do Ateliê ++ e gostaria de falar sobre uma peça.";
  return (
    <section className="rounded-lg border border-borda bg-superficie px-6 py-10 text-center">
      <h2 className="font-display text-3xl font-semibold text-texto">
        Vamos criar a sua próxima peça?
      </h2>
      <p className="mx-auto mt-2 max-w-xl text-texto-suave">
        Conte sua ideia ou escolha um modelo pronto. Estamos a uma mensagem de
        distância.
      </p>
      <div className="mt-6">
        {whatsappConfigurado ? (
          <a
            href={linkWhatsappTexto(texto)}
            target="_blank"
            rel="noopener noreferrer"
            className={btnPrimario}
          >
            Falar no WhatsApp
          </a>
        ) : (
          <Link to="/encomenda" className={btnPrimario}>
            Fazer uma encomenda
          </Link>
        )}
      </div>
    </section>
  );
}
