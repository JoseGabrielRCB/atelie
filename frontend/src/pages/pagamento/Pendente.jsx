import { Link, useSearchParams } from "react-router-dom";
import { Clock } from "lucide-react";
import { useSeo } from "../../seo/useSeo";

// Retorno do Mercado Pago quando o pagamento ainda está em processamento
// (ex.: Pix aguardando compensação). NÃO esvazia o carrinho.
export default function Pendente() {
  useSeo({ title: "Pagamento em processamento | Ateliê da Sete" });
  const [params] = useSearchParams();
  const pedidoId = params.get("external_reference");

  return (
    <section className="mx-auto max-w-xl py-10 text-center">
      <Clock className="mx-auto mb-4 text-acento" size={56} aria-hidden="true" />
      <h1 className="font-display text-3xl font-semibold text-texto">
        Pagamento em processamento
      </h1>
      <p className="mt-3 text-texto-suave">
        Estamos aguardando a confirmação do seu pagamento. Assim que for
        aprovado, seu pedido é confirmado e entraremos em contato. Se pagou com
        Pix, a compensação pode levar alguns minutos.
      </p>
      {pedidoId && (
        <p className="mt-2 text-sm text-texto-suave">
          Número do pedido: <span className="font-medium">#{pedidoId}</span>
        </p>
      )}
      <Link
        to="/vitrine"
        className="mt-6 inline-block rounded-lg bg-acento-escuro px-6 py-3 font-medium text-white transition hover:bg-acento-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acento-escuro focus-visible:ring-offset-2 focus-visible:ring-offset-fundo"
      >
        Voltar à vitrine
      </Link>
    </section>
  );
}
