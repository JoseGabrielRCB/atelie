import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { useCarrinho } from "../context/CarrinhoContext";
import { useConta } from "../context/ContaContext";
import ItemCarrinho from "../components/ItemCarrinho";
import Preco from "../components/Preco";
import { Vazio } from "../components/Estado";
import { criarCheckout, validarCupom } from "../lib/api";

const inputClasse =
  "w-full rounded-lg border border-borda bg-superficie px-4 py-2.5 text-texto placeholder:italic placeholder:text-texto-suave/70 focus:border-acento-escuro focus:outline-none focus:ring-2 focus:ring-acento-escuro/30";

export default function Carrinho() {
  const { itens, totalItens, totalPreco, ajustarQuantidade, remover, limpar } =
    useCarrinho();
  const { logado, cliente } = useConta();
  const [erroGeral, setErroGeral] = useState("");
  const [cupomInput, setCupomInput] = useState("");
  const [cupom, setCupom] = useState(null); // { codigo, desconto, total }
  const [cupomErro, setCupomErro] = useState("");

  // Itens que podem ser pagos online (têm variação). Sob medida fica de fora.
  const itensPagaveis = itens.filter((i) => i.variacaoId != null);
  const itensSobMedida = itens.filter((i) => i.variacaoId == null);
  const itensPayload = itensPagaveis.map((i) => ({
    variacao_id: i.variacaoId,
    quantidade: i.quantidade,
  }));

  const validarMut = useMutation({
    mutationFn: () => validarCupom(cupomInput.trim(), itensPayload),
    onSuccess: (dados) => {
      if (dados?.valido) {
        setCupom({ codigo: dados.codigo, desconto: dados.desconto, total: dados.total });
        setCupomErro("");
      } else {
        setCupom(null);
        setCupomErro(dados?.mensagem || "Cupom inválido.");
      }
    },
    onError: (e) => {
      setCupom(null);
      setCupomErro(e.message);
    },
  });

  const checkout = useMutation({
    mutationFn: criarCheckout,
    onSuccess: (dados) => {
      if (dados?.init_point) {
        // Redireciona ao checkout hospedado do Mercado Pago.
        window.location.href = dados.init_point;
      } else {
        setErroGeral(
          "Não foi possível iniciar o pagamento agora. Tente novamente."
        );
      }
    },
    onError: (err) => {
      setErroGeral(
        err?.message ||
          "Não foi possível iniciar o pagamento agora. Tente novamente."
      );
    },
  });

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

  function finalizar() {
    setErroGeral("");
    if (itensPagaveis.length === 0) return;
    checkout.mutate({ itens: itensPayload, cupom: cupom?.codigo });
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
          className="font-sans text-2xl font-semibold text-texto"
        />
      </div>

      {/* Aviso: itens sob medida não entram no pagamento online. */}
      {itensSobMedida.length > 0 && (
        <p className="mt-4 rounded-lg bg-acento/10 px-4 py-3 text-sm text-texto-suave">
          Peças sob medida não são pagas online. Para essas, finalize pela{" "}
          <Link
            to="/encomenda"
            className="font-medium text-acento-escuro underline"
          >
            Encomenda
          </Link>
          . O pagamento abaixo cobre os demais itens.
        </p>
      )}

      {/* Cupom de desconto (pré-validado no servidor; o checkout reconfirma). */}
      {itensPagaveis.length > 0 && (
        <div className="mt-4 rounded-lg border border-borda bg-superficie p-4">
          <label htmlFor="cupom" className="mb-1 block text-sm font-medium text-texto">
            Cupom de desconto
          </label>
          <div className="flex gap-2">
            <input
              id="cupom"
              value={cupomInput}
              onChange={(e) => setCupomInput(e.target.value.toUpperCase())}
              placeholder="Ex.: BEMVINDO"
              className={inputClasse}
            />
            <button
              type="button"
              onClick={() => cupomInput.trim() && validarMut.mutate()}
              disabled={validarMut.isPending || !cupomInput.trim()}
              className="shrink-0 rounded-lg border border-borda px-4 py-2.5 text-sm font-medium text-texto transition hover:border-acento-escuro focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acento-escuro disabled:opacity-50"
            >
              {validarMut.isPending ? "Validando…" : "Aplicar"}
            </button>
          </div>
          {cupomErro && <p className="mt-2 text-sm text-erro">{cupomErro}</p>}
          {cupom && (
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="text-sucesso">
                Cupom <strong>{cupom.codigo}</strong> aplicado (−
                <Preco valor={cupom.desconto} />). Total com desconto:{" "}
                <Preco valor={cupom.total} className="font-semibold text-texto" />
              </span>
              <button
                type="button"
                onClick={() => {
                  setCupom(null);
                  setCupomInput("");
                  setCupomErro("");
                }}
                className="text-texto-suave underline underline-offset-2 hover:text-acento-escuro"
              >
                remover
              </button>
            </div>
          )}
        </div>
      )}

      <div className="mt-6">
        <h2 className="mb-3 font-display text-xl font-semibold text-texto">
          Finalizar compra
        </h2>

        {erroGeral && (
          <p className="mb-4 rounded-lg bg-erro/10 px-4 py-3 text-sm text-erro">
            {erroGeral}
          </p>
        )}

        {itensPagaveis.length === 0 ? (
          <p className="rounded-lg bg-acento/10 px-4 py-3 text-sm text-texto-suave">
            Nenhum item do pedido pode ser pago online. Peças sob medida são
            finalizadas pela{" "}
            <Link to="/encomenda" className="font-medium text-acento-escuro underline">
              Encomenda
            </Link>
            .
          </p>
        ) : !logado ? (
          // Checkout exige conta — leva ao login/cadastro e volta ao carrinho.
          <div className="space-y-3 rounded-lg border border-borda bg-superficie p-4">
            <p className="text-sm text-texto">
              Para finalizar a compra, entre na sua conta. É rápido — pedimos só
              os dados necessários para o pagamento.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                to="/conta/login?next=/carrinho"
                className="inline-flex flex-1 items-center justify-center rounded-lg bg-acento-escuro px-6 py-3 font-medium text-white transition hover:bg-acento-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acento-escuro focus-visible:ring-offset-2 focus-visible:ring-offset-fundo"
              >
                Entrar
              </Link>
              <Link
                to="/conta/cadastro?next=/carrinho"
                className="inline-flex flex-1 items-center justify-center rounded-lg border border-borda px-6 py-3 font-medium text-texto transition hover:border-acento-escuro focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acento-escuro"
              >
                Criar conta
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg border border-borda bg-superficie p-4 text-sm text-texto-suave">
              Comprando como{" "}
              <strong className="text-texto">{cliente?.nome}</strong>
              {cliente?.cpf ? <> · CPF {cliente.cpf}</> : null}.{" "}
              <Link to="/conta" className="font-medium text-acento-escuro hover:underline">
                Minha conta
              </Link>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row-reverse">
              <button
                type="button"
                onClick={finalizar}
                disabled={checkout.isPending}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-acento-escuro px-6 py-3 font-medium text-white transition hover:bg-acento-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acento-escuro focus-visible:ring-offset-2 focus-visible:ring-offset-fundo disabled:cursor-not-allowed disabled:opacity-50"
              >
                {checkout.isPending ? "Redirecionando…" : "Finalizar compra"}
              </button>
              <button
                type="button"
                onClick={limpar}
                disabled={checkout.isPending}
                className="rounded-lg border border-borda px-6 py-3 text-texto transition hover:bg-superficie disabled:opacity-50"
              >
                Limpar pedido
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
