import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { usePeca } from "../hooks/usePeca";
import { useCarrinho } from "../context/CarrinhoContext";
import { imagemPrincipal } from "../lib/pecas";
import SeletorVariacao from "../components/SeletorVariacao";
import Galeria from "../components/Galeria";
import Preco from "../components/Preco";
import { Carregando, Erro } from "../components/Estado";

export default function DetalhePeca() {
  const { id } = useParams();
  const { data: peca, isPending, isError, error, refetch } = usePeca(id);
  const { adicionar } = useCarrinho();

  const [variacao, setVariacao] = useState(null);
  const [quantidade, setQuantidade] = useState(1);
  const [adicionado, setAdicionado] = useState(false);
  const [aviso, setAviso] = useState("");

  if (isPending) return <Carregando texto="Carregando peça..." />;
  if (isError)
    return <Erro mensagem={error.message} aoTentarNovamente={refetch} />;

  const variacoes = peca.variacoes ?? [];
  const temVariacoes = variacoes.length > 0;
  // Variações disponíveis (não esgotadas).
  const disponiveis = variacoes.filter((v) => !v.esgotado);
  // Se houver apenas UMA variação disponível, ela já vem pré-selecionada.
  const variacaoUnica = disponiveis.length === 1 ? disponiveis[0] : null;
  const variacaoEfetiva = variacao ?? variacaoUnica;
  // Com várias variações e nenhuma escolhida, a quantidade fica travada.
  const precisaSelecionar = temVariacoes && !variacaoEfetiva;
  // Estoque disponível da variação efetiva; null = sem limite (sob medida).
  const estoqueDisponivel =
    typeof variacaoEfetiva?.estoque === "number"
      ? variacaoEfetiva.estoque
      : null;
  const noLimiteEstoque =
    estoqueDisponivel !== null && quantidade >= estoqueDisponivel;
  const imagens = peca.imagens ?? [];
  const capa = imagemPrincipal(peca);
  const galeria = imagens.length ? imagens : capa ? [{ id: 0, arquivo: capa }] : [];

  function handleAdicionar() {
    if (temVariacoes && !variacaoEfetiva) {
      setAviso("Escolha o tamanho e a cor.");
      return;
    }
    adicionar({
      pecaId: peca.id,
      nome: peca.nome,
      preco: peca.preco,
      imagem: capa,
      variacaoId: variacaoEfetiva?.id ?? null,
      tamanho: variacaoEfetiva?.tamanho ?? "",
      cor: variacaoEfetiva?.cor ?? "",
      estoque: estoqueDisponivel,
      quantidade,
    });
    setAviso("");
    setAdicionado(true);
    setTimeout(() => setAdicionado(false), 2500);
  }

  return (
    <article className="grid gap-8 md:grid-cols-2">
      {/* Galeria (carretel: principal → última, com setas e miniaturas) */}
      <Galeria key={peca.id} imagens={galeria} alt={peca.nome} />

      {/* Informações */}
      <div>
        <Link
          to="/"
          className="mb-4 inline-block text-sm text-texto-suave transition hover:text-acento-escuro"
        >
          ← Voltar à vitrine
        </Link>

        {peca.categoria_nome && (
          <p className="text-xs uppercase tracking-wide text-texto-suave">
            {peca.categoria_nome}
          </p>
        )}
        <h1 className="mt-1 font-display text-3xl font-semibold text-texto">
          {peca.nome}
        </h1>
        <Preco
          valor={peca.preco}
          className="mt-2 block text-xl font-semibold text-texto"
        />

        {peca.tipo === "sob_medida" && (
          <p className="mt-3 inline-block rounded bg-borda/60 px-2 py-1 text-xs text-texto-suave">
            Peça sob medida
          </p>
        )}

        {peca.descricao && (
          <p className="mt-4 whitespace-pre-line leading-relaxed text-texto-suave">
            {peca.descricao}
          </p>
        )}

        <div className="mt-6 space-y-5">
          {temVariacoes && (
            <SeletorVariacao
              variacoes={variacoes}
              selecionada={variacaoEfetiva}
              onSelecionar={(v) => {
                setVariacao(v);
                setAviso("");
                // Ajusta a quantidade ao estoque da nova variação.
                if (typeof v?.estoque === "number") {
                  setQuantidade((q) => Math.min(Math.max(1, q), Math.max(1, v.estoque)));
                }
              }}
            />
          )}

          {/* Quantidade */}
          <div>
            <div className="mb-2 flex items-baseline gap-2">
              <p className="text-sm font-medium text-texto">Quantidade</p>
              {estoqueDisponivel !== null && (
                <span className="text-xs text-texto-suave">
                  ({estoqueDisponivel} em estoque)
                </span>
              )}
            </div>
            <div
              className={
                "inline-flex items-center rounded-lg border border-borda " +
                (precisaSelecionar ? "opacity-50" : "")
              }
            >
              <button
                type="button"
                onClick={() => setQuantidade((q) => Math.max(1, q - 1))}
                disabled={precisaSelecionar || quantidade <= 1}
                className="px-4 py-2 text-texto disabled:opacity-40"
                aria-label="Diminuir"
              >
                −
              </button>
              <span className="min-w-10 text-center">{quantidade}</span>
              <button
                type="button"
                onClick={() =>
                  setQuantidade((q) =>
                    estoqueDisponivel !== null
                      ? Math.min(q + 1, estoqueDisponivel)
                      : q + 1
                  )
                }
                disabled={precisaSelecionar || noLimiteEstoque}
                className="px-4 py-2 text-texto disabled:opacity-40"
                aria-label="Aumentar"
              >
                +
              </button>
            </div>
            {precisaSelecionar && (
              <p className="mt-1 text-xs text-texto-suave">
                Selecione o tamanho e a cor para escolher a quantidade.
              </p>
            )}
            {!precisaSelecionar && noLimiteEstoque && (
              <p className="mt-1 text-xs text-texto-suave">
                Quantidade máxima disponível atingida.
              </p>
            )}
          </div>

          {/* Subtotal dinâmico: preço × quantidade selecionada. */}
          <div className="flex items-baseline justify-between border-t border-borda pt-4">
            <span className="text-sm text-texto-suave">
              Subtotal ({quantidade} {quantidade === 1 ? "item" : "itens"})
            </span>
            <Preco
              valor={Number(peca.preco) * quantidade}
              className="text-xl font-semibold text-texto"
            />
          </div>

          {aviso && <p className="text-sm text-erro">{aviso}</p>}

          <button
            type="button"
            onClick={handleAdicionar}
            className="w-full rounded-lg bg-acento-escuro px-6 py-3 font-medium text-white transition hover:bg-acento-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acento-escuro focus-visible:ring-offset-2 focus-visible:ring-offset-fundo sm:w-auto"
          >
            Adicionar ao pedido
          </button>

          {adicionado && (
            <p className="text-sm font-medium text-sucesso">
              Adicionado ao pedido!{" "}
              <Link to="/carrinho" className="underline">
                Ver meu pedido
              </Link>
            </p>
          )}
        </div>
      </div>
    </article>
  );
}
