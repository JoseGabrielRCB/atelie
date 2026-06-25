import { Link } from "react-router-dom";
import { XCircle } from "lucide-react";
import { useSeo } from "../../seo/useSeo";

// Retorno do Mercado Pago quando o pagamento falhou ou foi cancelado.
// NÃO esvazia o carrinho — o cliente pode tentar de novo.
export default function Falha() {
  useSeo({ title: "Pagamento não concluído | Ateliê da Sete" });

  return (
    <section className="mx-auto max-w-xl py-10 text-center">
      <XCircle className="mx-auto mb-4 text-erro" size={56} aria-hidden="true" />
      <h1 className="font-display text-3xl font-semibold text-texto">
        Pagamento não concluído
      </h1>
      <p className="mt-3 text-texto-suave">
        O pagamento não foi aprovado ou foi cancelado. Seus itens continuam no
        pedido — você pode tentar novamente.
      </p>
      <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
        <Link
          to="/carrinho"
          className="inline-block rounded-lg bg-acento-escuro px-6 py-3 font-medium text-white transition hover:bg-acento-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acento-escuro focus-visible:ring-offset-2 focus-visible:ring-offset-fundo"
        >
          Voltar ao carrinho
        </Link>
        <Link
          to="/vitrine"
          className="inline-block rounded-lg border border-borda px-6 py-3 text-texto transition hover:bg-superficie"
        >
          Continuar na vitrine
        </Link>
      </div>
    </section>
  );
}
