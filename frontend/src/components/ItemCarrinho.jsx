import Preco from "./Preco";

export default function ItemCarrinho({ item, onAjustar, onRemover }) {
  const detalhes = [item.tamanho, item.cor].filter(Boolean).join(" · ");
  // Estoque pode ser nulo (sob medida / itens antigos sem o dado) = sem limite.
  const temLimite = typeof item.estoque === "number";
  const noLimite = temLimite && item.quantidade >= item.estoque;

  return (
    <div className="flex gap-4 border-b border-borda py-4">
      <div className="h-24 w-20 flex-shrink-0 overflow-hidden rounded-lg bg-superficie">
        {item.imagem ? (
          <img
            src={item.imagem}
            alt={item.nome}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-texto-suave">
            Sem foto
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-display text-lg font-medium leading-tight text-texto">
              {item.nome}
            </h3>
            {detalhes && (
              <p className="mt-0.5 text-sm text-texto-suave">{detalhes}</p>
            )}
          </div>
          <button
            type="button"
            onClick={() => onRemover(item.chave)}
            className="text-sm text-texto-suave transition hover:text-erro"
            aria-label={`Remover ${item.nome}`}
          >
            Remover
          </button>
        </div>

        <div className="mt-auto flex items-center justify-between pt-2">
          <div className="flex items-center rounded-lg border border-borda">
            <button
              type="button"
              onClick={() => onAjustar(item.chave, item.quantidade - 1)}
              disabled={item.quantidade <= 1}
              className="px-3 py-1.5 text-texto disabled:opacity-40"
              aria-label="Diminuir quantidade"
            >
              −
            </button>
            <span className="min-w-8 text-center text-sm">{item.quantidade}</span>
            <button
              type="button"
              onClick={() => onAjustar(item.chave, item.quantidade + 1)}
              disabled={noLimite}
              className="px-3 py-1.5 text-texto disabled:opacity-40"
              aria-label="Aumentar quantidade"
            >
              +
            </button>
          </div>
          <div className="text-right">
            {/* Subtotal da linha: preço × quantidade. */}
            <Preco
              valor={(Number(item.preco) || 0) * item.quantidade}
              className="block text-sm font-semibold text-texto"
            />
            {item.quantidade > 1 && (
              <span className="text-xs text-texto-suave">
                <Preco valor={item.preco} /> cada
              </span>
            )}
            {noLimite && (
              <span className="block text-xs text-texto-suave">
                Máx. em estoque
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
