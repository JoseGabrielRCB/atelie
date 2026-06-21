import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  criarVariacao,
  atualizarVariacao,
  excluirVariacao,
} from "../../lib/api";
import { BotaoPrimario, BotaoPerigo, Feedback, inputClasse } from "./ui";

const TAMANHOS = ["P", "M", "G", "GG", "Único"];

// Editor de variações (tamanho/cor/estoque) de uma peça pronta.
export default function VariacoesEditor({ peca }) {
  const qc = useQueryClient();
  const [erro, setErro] = useState("");
  const [nova, setNova] = useState({ tamanho: "", cor: "", estoque: 0 });

  const invalidar = () => {
    qc.invalidateQueries({ queryKey: ["admin", "peca", String(peca.id)] });
    qc.invalidateQueries({ queryKey: ["admin", "pecas"] });
  };

  const criarMut = useMutation({
    mutationFn: criarVariacao,
    onSuccess: () => {
      setNova({ tamanho: "", cor: "", estoque: 0 });
      invalidar();
    },
    onError: (e) => setErro(e.message),
  });

  const atualizarMut = useMutation({
    mutationFn: ({ id, dados }) => atualizarVariacao(id, dados),
    onSuccess: invalidar,
    onError: (e) => setErro(e.message),
  });

  const excluirMut = useMutation({
    mutationFn: excluirVariacao,
    onSuccess: invalidar,
    onError: (e) => setErro(e.message),
  });

  function adicionar() {
    setErro("");
    const estoque = Number(nova.estoque);
    if (estoque < 0 || Number.isNaN(estoque)) {
      setErro("O estoque não pode ser negativo.");
      return;
    }
    criarMut.mutate({
      peca: peca.id,
      tamanho: nova.tamanho,
      cor: nova.cor,
      estoque,
    });
  }

  const variacoes = peca.variacoes ?? [];

  return (
    <div className="rounded-lg border border-borda bg-superficie p-5">
      <h2 className="mb-1 font-display text-xl font-semibold">Variações</h2>
      <p className="mb-4 text-sm text-texto-suave">
        Tamanho, cor e estoque. Peças sob medida podem não ter variações.
      </p>

      {erro && (
        <div className="mb-3">
          <Feedback tipo="erro">{erro}</Feedback>
        </div>
      )}

      <div className="space-y-2">
        {variacoes.map((v) => (
          <LinhaVariacao
            key={v.id}
            variacao={v}
            salvando={atualizarMut.isPending}
            onSalvar={(dados) => {
              setErro("");
              atualizarMut.mutate({ id: v.id, dados });
            }}
            onRemover={() => {
              setErro("");
              if (window.confirm("Remover esta variação?")) excluirMut.mutate(v.id);
            }}
          />
        ))}
        {variacoes.length === 0 && (
          <p className="text-sm text-texto-suave">Nenhuma variação cadastrada.</p>
        )}
      </div>

      {/* Nova variação */}
      <div className="mt-4 border-t border-borda pt-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_1fr_100px_auto]">
          <input
            list="tamanhos-sugeridos"
            value={nova.tamanho}
            onChange={(e) => setNova((n) => ({ ...n, tamanho: e.target.value }))}
            placeholder="Tamanho"
            aria-label="Tamanho da nova variação"
            className={inputClasse}
          />
          <datalist id="tamanhos-sugeridos">
            {TAMANHOS.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
          <input
            value={nova.cor}
            onChange={(e) => setNova((n) => ({ ...n, cor: e.target.value }))}
            placeholder="Cor"
            aria-label="Cor da nova variação"
            className={inputClasse}
          />
          <input
            type="number"
            min="0"
            value={nova.estoque}
            onChange={(e) => setNova((n) => ({ ...n, estoque: e.target.value }))}
            placeholder="Estoque"
            aria-label="Estoque da nova variação"
            className={inputClasse}
          />
          <BotaoPrimario
            type="button"
            onClick={adicionar}
            disabled={criarMut.isPending}
          >
            Adicionar
          </BotaoPrimario>
        </div>
      </div>
    </div>
  );
}

function LinhaVariacao({ variacao, onSalvar, onRemover, salvando }) {
  const [tamanho, setTamanho] = useState(variacao.tamanho);
  const [cor, setCor] = useState(variacao.cor);
  const [estoque, setEstoque] = useState(variacao.estoque);

  const mudou =
    tamanho !== variacao.tamanho ||
    cor !== variacao.cor ||
    Number(estoque) !== variacao.estoque;

  return (
    <div className="grid grid-cols-2 items-center gap-2 sm:grid-cols-[1fr_1fr_100px_auto_auto]">
      <input
        value={tamanho}
        onChange={(e) => setTamanho(e.target.value)}
        aria-label="Tamanho"
        className={inputClasse}
      />
      <input
        value={cor}
        onChange={(e) => setCor(e.target.value)}
        aria-label="Cor"
        className={inputClasse}
      />
      <input
        type="number"
        min="0"
        value={estoque}
        onChange={(e) => setEstoque(e.target.value)}
        aria-label="Estoque"
        className={
          inputClasse + (variacao.esgotado ? " border-erro/60 text-erro" : "")
        }
      />
      <button
        type="button"
        disabled={!mudou || salvando}
        onClick={() => onSalvar({ tamanho, cor, estoque: Number(estoque) })}
        className="rounded-lg border border-borda px-3 py-2 text-sm text-texto transition hover:border-acento-escuro disabled:opacity-40"
      >
        Salvar
      </button>
      <BotaoPerigo type="button" onClick={onRemover}>
        Remover
      </BotaoPerigo>
    </div>
  );
}
