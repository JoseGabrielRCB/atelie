import { Link } from "react-router-dom";
import Preco from "./Preco";
import { imagemPrincipal, pecaEsgotada } from "../lib/pecas";

export default function PecaCard({ peca }) {
  const imagem = imagemPrincipal(peca);
  const esgotada = pecaEsgotada(peca);

  return (
    <Link
      to={`/peca/${peca.id}`}
      className="group block cursor-pointer rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acento-escuro focus-visible:ring-offset-2 focus-visible:ring-offset-fundo"
    >
      {/* Container do card: borda de destaque + leve elevação/scale no hover (desktop). */}
      <div className="rounded-lg border border-borda bg-superficie p-2 transition duration-200 ease-out group-hover:-translate-y-0.5 group-hover:scale-[1.02] group-hover:border-acento group-hover:shadow-[0_6px_20px_rgba(0,0,0,0.10)]">
        <div className="relative aspect-[3/4] w-full overflow-hidden rounded-lg bg-fundo">
          {imagem ? (
            <img
              src={imagem}
              alt={peca.nome}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-200 ease-out group-hover:scale-[1.05]"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-texto-suave">
              Sem foto
            </div>
          )}

          {esgotada && (
            <span className="absolute left-2 top-2 rounded bg-esgotado px-2 py-1 text-xs font-medium text-white">
              Esgotado
            </span>
          )}
          {peca.em_promocao && !esgotada && (
            <span className="absolute right-2 top-2 rounded bg-acento-escuro px-2 py-1 text-xs font-medium text-white">
              Promoção
            </span>
          )}
        </div>

        <div className="mt-3 px-0.5 pb-1">
          {peca.categoria_nome && (
            <p className="text-xs font-medium uppercase tracking-wide text-texto-suave">
              {peca.categoria_nome}
            </p>
          )}
          <h3 className="mt-0.5 font-display text-lg font-medium leading-snug text-texto">
            {peca.nome}
          </h3>
          {peca.em_promocao ? (
            <div className="mt-1 flex items-baseline gap-2">
              <Preco
                valor={peca.preco_promocional}
                className="text-base font-semibold text-acento-escuro"
              />
              <Preco valor={peca.preco} className="text-sm text-texto-suave line-through" />
            </div>
          ) : (
            <Preco
              valor={peca.preco}
              className="mt-1 block text-base font-semibold text-texto"
            />
          )}
        </div>
      </div>
    </Link>
  );
}
