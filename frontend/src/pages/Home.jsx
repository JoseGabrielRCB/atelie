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

// Mensagem padrão pré-preenchida no WhatsApp (microcopy da marca).
const MSG_WHATS =
  "Saravá! Vim pelo site do Ateliê da Sete e quero acertar a minha roupa de trabalho.";

// Link de WhatsApp quando configurado; senão, cai na página de encomenda.
function AcaoWhats({ children, className }) {
  if (whatsappConfigurado) {
    return (
      <a
        href={linkWhatsappTexto(MSG_WHATS)}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
      >
        {children}
      </a>
    );
  }
  return (
    <Link to="/encomenda" className={className}>
      {children}
    </Link>
  );
}

export default function Home() {
  useSeo(getMeta("/"));
  return (
    <div className="space-y-16 sm:space-y-20">
      <Hero />
      <PecasDestaque />
      <Sobre />
      <OQueCosturamos />
      <Diferenciais />
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
      <p className="text-sm font-medium uppercase tracking-wide text-acento">
        Ateliê da Sete · Roupas e paramentos · de Campo Grande/MS para todo o Brasil
      </p>
      <h1 className="mx-auto mt-3 max-w-3xl font-display text-4xl font-semibold leading-tight text-texto sm:text-5xl">
        Sua roupa de trabalho, no fundamento da sua casa.
      </h1>
      <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-texto-suave">
        Cada terreiro tem seu axé, e cada axé pede seu modelo, sua cor, seu corte.
        Aqui a gente não vende tamanho de prateleira — confecciona a sua peça
        conforme a sua casa firma. Da roupa branca da corrente ao paramento do seu
        guia.
      </p>
      <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <AcaoWhats className={btnPrimario}>
          Me conta o fundamento da sua casa
        </AcaoWhats>
        <Link to="/vitrine" className={btnSecundario}>
          Ver os trabalhos
        </Link>
      </div>
      <p className="mt-4 text-sm text-texto-suave">
        Conforme o fundamento da sua casa · Sob medida · De Campo Grande para todo o Brasil
      </p>
    </section>
  );
}

/* 2. Trabalhos em destaque — curadoria do admin, com fallback aos mais recentes */
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
          Alguns trabalhos
        </h2>
        <p className="mx-auto mt-2 max-w-2xl text-texto-suave">
          Uma amostra do que sai do ateliê. Não achou o seu? É porque o seu é sob
          medida — me diz o guia e o fundamento da casa.
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
          Em breve, novos trabalhos por aqui.
        </p>
      )}

      <div className="mt-8 text-center">
        <Link to="/vitrine" className={btnPrimario}>
          Ver todos os trabalhos
        </Link>
      </div>
    </section>
  );
}

/* 3. Sobre / manifesto */
function Sobre() {
  return (
    <section className="overflow-hidden rounded-lg border border-borda bg-superficie">
      <div className="grid gap-0 md:grid-cols-2">
        <img
          src="/apresentacao-atelie.jpg"
          alt="Marca do Ateliê da Sete — estrela de sete pontas e agulha"
          loading="lazy"
          className="aspect-[4/3] w-full object-cover md:aspect-auto md:h-full"
        />
        <div className="flex flex-col justify-center gap-4 p-6 sm:p-8">
          <h2 className="font-display text-3xl font-semibold text-texto">
            Tem nome de fundamento. Costura como fundamento.
          </h2>
          <p className="leading-relaxed text-texto-suave">
            São sete as linhas que sustentam a Umbanda — e é com esse respeito que
            a <strong className="font-medium text-texto">{SITE.dona}</strong> corta
            cada peça. Aqui não se pergunta só o seu tamanho. Pergunta-se a sua
            casa: a cor que o seu dirigente firma, o modelo que a sua corrente usa,
            o paramento que o seu guia pede na gira.
          </p>
          <p className="leading-relaxed text-texto-suave">
            Porque a bata do Preto-Velho não é a roupa do Boiadeiro. Porque saia de
            Oxum não é a de Iansã. Porque o branco que protege na corrente não pode
            ficar transparente depois de três horas de trabalho. Esses detalhes não
            se aprendem no manequim — se aprendem na fé.
          </p>
          <p className="leading-relaxed text-texto-suave">
            De Campo Grande para todo o Brasil, vestindo médium, filho de santo e
            terreiro com a roupa certa para o trabalho certo. Umbanda e Candomblé,
            no fundamento de cada casa.
          </p>
          <p className="font-display text-lg italic text-acento-escuro">
            Saravá as Sete Linhas. Axé. 🤍
          </p>
        </div>
      </div>
    </section>
  );
}

/* 4. O que costuramos — catálogo com vocabulário */
const COSTURAMOS = [
  {
    titulo: "Roupa branca de trabalho",
    texto:
      "Para a corrente: balandrau, bata, calça e saia em branco que reflete e não entrega no suor da gira.",
  },
  {
    titulo: "Pretos-Velhos",
    texto:
      "Bata, saia rodada das Vós, lenço e toalha. A humildade da linha de Yorimá no capricho que ela merece.",
  },
  {
    titulo: "Boiadeiros",
    texto:
      "Couro, gibão, chapéu e lenço. A lida e a força para o seu guia chegar firme.",
  },
  {
    titulo: "Baianos",
    texto:
      "Roupa rodada, bata e chapéu de palha. O gingado do Nordeste na sua gira.",
  },
  {
    titulo: "Ciganos",
    texto:
      "Saia rodada, cor, brilho e moeda. Aqui o fundamento é a cor, não o branco.",
  },
  {
    titulo: "Exus & Pombagiras",
    texto:
      "Capa, cartola, renda e brilho no preto e vermelho da linha. Presença que se vê chegar.",
  },
  {
    titulo: "Crianças",
    texto: "Roupinha, laço e alegria para a linha de Yori.",
  },
  {
    titulo: "Candomblé — axós e paramentos",
    texto:
      "Axó, bata, saia e anágua, ojá e pano da costa, no fundamento do seu Orixá e da sua casa.",
  },
  {
    titulo: "Paramentos & acessórios",
    texto:
      "Torço, ojá, pano da costa, guias/fios de contas e o detalhe que firma a peça.",
  },
];

function OQueCosturamos() {
  return (
    <section>
      <h2 className="mb-6 text-center font-display text-3xl font-semibold text-texto">
        Cada guia tem sua roupa. A gente conhece todas.
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {COSTURAMOS.map((item) => (
          <div
            key={item.titulo}
            className="flex flex-col gap-2 rounded-lg border border-borda bg-superficie p-6"
          >
            <h3 className="font-display text-xl font-semibold text-texto">
              {item.titulo}
            </h3>
            <p className="text-texto-suave">{item.texto}</p>
          </div>
        ))}
      </div>
      <div className="mt-8 flex flex-col items-center gap-3 text-center">
        <p className="max-w-2xl text-texto-suave">
          Não achou o seu? É porque a sua é sob medida. Me diz o guia e o
          fundamento da casa.
        </p>
        <AcaoWhats className={btnPrimario}>Chamar no WhatsApp</AcaoWhats>
      </div>
    </section>
  );
}

/* 5. Diferenciais */
const DIFERENCIAIS = [
  {
    titulo: "Confeccionado conforme a sua casa.",
    texto:
      "Você diz a cor que o dirigente firma e o modelo da sua corrente; eu confecciono no fundamento — não no meu palpite.",
  },
  {
    titulo: "A medida é sua.",
    texto:
      "Roupa de trabalho apertada atrapalha a gira. Corto no seu corpo, para você trabalhar sem incômodo.",
  },
  {
    titulo: "Branco que não te entrega.",
    texto:
      "Tecido e forro pensados para horas de pé, suando, sem transparência.",
  },
  {
    titulo: "Costura que aguenta o trabalho.",
    texto: "Você roda, levanta o braço, dá o passe — e a barra não abre.",
  },
  {
    titulo: "Quem fala a sua língua.",
    texto:
      "Não vou te pedir para explicar o que é ojá, pano da costa ou bata. Já é de casa.",
  },
];

function Diferenciais() {
  return (
    <section>
      <h2 className="mb-6 text-center font-display text-3xl font-semibold text-texto">
        O que muda quando quem costura respeita o axé
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {DIFERENCIAIS.map((item) => (
          <div
            key={item.titulo}
            className="rounded-lg border border-borda bg-superficie p-6"
          >
            <h3 className="font-medium text-texto">{item.titulo}</h3>
            <p className="mt-1 text-texto-suave">{item.texto}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* 6. Depoimentos */
function Depoimentos() {
  return (
    <section>
      <h2 className="mb-6 text-center font-display text-3xl font-semibold text-texto">
        Quem já vestiu o trabalho
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
  return (
    <section className="rounded-lg border border-borda bg-superficie px-6 py-10 text-center">
      <h2 className="font-display text-3xl font-semibold text-texto">
        Saravá! Bora acertar sua roupa?
      </h2>
      <p className="mx-auto mt-2 max-w-xl text-texto-suave">
        Me conta o guia e o fundamento da sua casa. A peça certa para o trabalho
        certo.
      </p>
      <div className="mt-6">
        <AcaoWhats className={btnPrimario}>Falar no WhatsApp</AcaoWhats>
      </div>
      <p className="mt-6 text-sm text-texto-suave">
        Conforme o fundamento da sua casa · Sob medida · de Campo Grande para o Brasil
      </p>
    </section>
  );
}
