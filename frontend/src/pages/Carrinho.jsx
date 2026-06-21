import { useState } from "react";
import { Link } from "react-router-dom";
import { useCarrinho } from "../context/CarrinhoContext";
import ItemCarrinho from "../components/ItemCarrinho";
import Preco from "../components/Preco";
import { Vazio } from "../components/Estado";
import { linkWhatsapp, whatsappConfigurado } from "../lib/whatsapp";

export default function Carrinho() {
  const { itens, totalItens, totalPreco, ajustarQuantidade, remover, limpar } =
    useCarrinho();
  const [observacao, setObservacao] = useState("");

  if (itens.length === 0) {
    return (
      <Vazio texto="Seu pedido está vazio.">
        <Link
          to="/"
          className="rounded-lg bg-acento-escuro px-6 py-3 font-medium text-white transition hover:bg-acento-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acento-escuro focus-visible:ring-offset-2 focus-visible:ring-offset-fundo"
        >
          Ver a vitrine
        </Link>
      </Vazio>
    );
  }

  function enviar() {
    const url = linkWhatsapp(itens, observacao);
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <section className="mx-auto max-w-2xl">
      <h1 className="mb-6 font-display text-3xl font-semibold text-texto">
        Meu pedido
      </h1>

      <div>
        {itens.map((item) => (
          <ItemCarrinho
            key={item.chave}
            item={item}
            onAjustar={ajustarQuantidade}
            onRemover={remover}
          />
        ))}
      </div>

      {/* Total dinâmico do pedido (preço × quantidade somado). */}
      <div className="mt-6 flex items-baseline justify-between border-t border-borda pt-4">
        <span className="text-base font-medium text-texto">
          Total ({totalItens} {totalItens === 1 ? "item" : "itens"})
        </span>
        <Preco
          valor={totalPreco}
          className="font-display text-2xl font-semibold text-texto"
        />
      </div>

      <div className="mt-6">
        <label
          htmlFor="observacao"
          className="mb-2 block text-sm font-medium text-texto"
        >
          Observação (opcional)
        </label>
        <textarea
          id="observacao"
          value={observacao}
          onChange={(e) => setObservacao(e.target.value)}
          rows={3}
          placeholder="Ex.: pode entregar até sexta?"
          className="w-full rounded-lg border border-borda bg-superficie px-4 py-3 text-texto placeholder:text-texto-suave focus:border-acento-escuro focus:outline-none focus:ring-2 focus:ring-acento-escuro/30"
        />
      </div>

      {!whatsappConfigurado && (
        <p className="mt-4 rounded-lg bg-erro/10 px-4 py-3 text-sm text-erro">
          O número do WhatsApp não está configurado. Defina VITE_WHATSAPP no
          arquivo .env.
        </p>
      )}

      <div className="mt-6 flex flex-col gap-3 sm:flex-row-reverse">
        <button
          type="button"
          onClick={enviar}
          disabled={!whatsappConfigurado}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-sucesso px-6 py-3 font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M.057 24l1.687-6.163a11.867 11.867 0 0 1-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 0 1 8.413 3.488 11.824 11.824 0 0 1 3.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 0 1-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 0 0 1.51 5.26l-.999 3.648 3.737-.979zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
          </svg>
          Enviar pedido pelo WhatsApp
        </button>
        <button
          type="button"
          onClick={limpar}
          className="rounded-lg border border-borda px-6 py-3 text-texto transition hover:bg-superficie"
        >
          Limpar pedido
        </button>
      </div>
    </section>
  );
}
