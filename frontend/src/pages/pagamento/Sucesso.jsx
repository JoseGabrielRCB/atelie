import { useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import { useCarrinho } from "../../context/CarrinhoContext";
import { codigoPedido } from "../../lib/pedido";
import { useSeo } from "../../seo/useSeo";

// Página de retorno do Mercado Pago após pagamento aprovado (auto_return).
// A confirmação REAL é feita por webhook no backend; aqui é só a UX amigável.
export default function Sucesso() {
  useSeo({ title: "Pagamento aprovado | Ateliê da Sete" });
  const [params] = useSearchParams();
  const { limpar } = useCarrinho();
  const pedidoId = params.get("external_reference");

  // Pagamento aprovado: esvazia o carrinho (uma vez).
  useEffect(() => {
    limpar();
  }, [limpar]);

  return (
    <section className="mx-auto max-w-xl py-10 text-center">
      <CheckCircle2
        className="mx-auto mb-4 text-sucesso"
        size={56}
        aria-hidden="true"
      />
      <h1 className="font-display text-3xl font-semibold text-texto">
        Pedido recebido!
      </h1>
      <p className="mt-3 text-texto-suave">
        Estamos confirmando o seu pagamento. Assim que ele for confirmado,
        entraremos em contato para combinar a entrega.
      </p>
      {pedidoId && (
        <p className="mt-2 text-sm text-texto-suave">
          Código da compra:{" "}
          <span className="font-mono font-medium text-texto">{codigoPedido(pedidoId)}</span>
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
