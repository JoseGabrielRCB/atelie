import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { useCarrinho } from "../context/CarrinhoContext";
import ItemCarrinho from "../components/ItemCarrinho";
import Preco from "../components/Preco";
import { Vazio } from "../components/Estado";
import { criarCheckout } from "../lib/api";

export default function Carrinho() {
  const { itens, totalItens, totalPreco, ajustarQuantidade, remover, limpar } =
    useCarrinho();
  const [nome, setNome] = useState("");
  const [contato, setContato] = useState("");
  // Erros por campo (validação no cliente) + erro geral (resposta do servidor).
  const [erros, setErros] = useState({});
  const [erroGeral, setErroGeral] = useState("");

  // Itens que podem ser pagos online (têm variação). Sob medida fica de fora.
  const itensPagaveis = itens.filter((i) => i.variacaoId != null);
  const itensSobMedida = itens.filter((i) => i.variacaoId == null);

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

  function validar() {
    const novos = {};
    if (!nome.trim()) novos.nome = "Informe seu nome.";
    if (!contato.trim())
      novos.contato = "Informe um telefone ou e-mail para contato.";
    if (itensPagaveis.length === 0)
      novos.itens =
        "Nenhum item do pedido pode ser pago online. Peças sob medida vão pela Encomenda.";
    setErros(novos);
    return Object.keys(novos).length === 0;
  }

  function finalizar(e) {
    e.preventDefault();
    setErroGeral("");
    if (!validar()) return;
    checkout.mutate({
      nome: nome.trim(),
      contato: contato.trim(),
      itens: itensPagaveis.map((i) => ({
        variacao_id: i.variacaoId,
        quantidade: i.quantidade,
      })),
    });
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

      <form onSubmit={finalizar} noValidate className="mt-6">
        <h2 className="mb-3 font-display text-xl font-semibold text-texto">
          Finalizar compra
        </h2>

        {erroGeral && (
          <p className="mb-4 rounded-lg bg-erro/10 px-4 py-3 text-sm text-erro">
            {erroGeral}
          </p>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="nome"
              className="mb-1 block text-sm font-medium text-texto"
            >
              Nome
            </label>
            <input
              id="nome"
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              maxLength={80}
              autoComplete="name"
              className="w-full rounded-lg border border-borda bg-superficie px-4 py-3 text-texto placeholder:text-texto-suave focus:border-acento-escuro focus:outline-none focus:ring-2 focus:ring-acento-escuro/30"
            />
            {erros.nome && (
              <p className="mt-1 text-sm text-erro">{erros.nome}</p>
            )}
          </div>

          <div>
            <label
              htmlFor="contato"
              className="mb-1 block text-sm font-medium text-texto"
            >
              Contato (telefone ou e-mail)
            </label>
            <input
              id="contato"
              type="text"
              value={contato}
              onChange={(e) => setContato(e.target.value)}
              maxLength={100}
              autoComplete="tel"
              className="w-full rounded-lg border border-borda bg-superficie px-4 py-3 text-texto placeholder:text-texto-suave focus:border-acento-escuro focus:outline-none focus:ring-2 focus:ring-acento-escuro/30"
            />
            {erros.contato && (
              <p className="mt-1 text-sm text-erro">{erros.contato}</p>
            )}
          </div>
        </div>

        {erros.itens && (
          <p className="mt-3 text-sm text-erro">{erros.itens}</p>
        )}

        <div className="mt-6 flex flex-col gap-3 sm:flex-row-reverse">
          <button
            type="submit"
            disabled={checkout.isPending || itensPagaveis.length === 0}
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
      </form>
    </section>
  );
}
