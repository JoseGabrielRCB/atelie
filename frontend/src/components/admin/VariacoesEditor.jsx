import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  criarVariacao,
  atualizarVariacao,
  excluirVariacao,
} from "../../lib/api";
import SeletorCor from "./SeletorCor";
import { BotaoPrimario, BotaoPerigo, Campo, Feedback, inputClasse } from "./ui";

const TAMANHOS = ["P", "M", "G", "GG", "Único"];

// Editor de variações (tamanho/cor/estoque) de uma peça pronta.
// A cor usa a paleta salva (SeletorCor) e persiste `cor` + `cor_hex`.
export default function VariacoesEditor({ peca }) {
  const qc = useQueryClient();
  const [erro, setErro] = useState("");
  const [nova, setNova] = useState({ tamanho: "", cor: "", corHex: "", estoque: 0 });

  const invalidar = () => {
    qc.invalidateQueries({ queryKey: ["admin", "peca", String(peca.id)] });
    qc.invalidateQueries({ queryKey: ["admin", "pecas"] });
  };

  const criarMut = useMutation({
    mutationFn: criarVariacao,
    onSuccess: () => {
      setNova({ tamanho: "", cor: "", corHex: "", estoque: 0 });
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
    if (estoque < 0 || Number.isNaN(estoque) || !Number.isInteger(estoque)) {
      setErro("O estoque deve ser um número inteiro maior ou igual a 0.");
      return;
    }
    criarMut.mutate({
      peca: peca.id,
      tamanho: nova.tamanho,
      cor: nova.cor,
      cor_hex: nova.corHex ?? "",
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

      <div className="space-y-3">
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
        <p className="mb-2 text-sm font-medium text-texto">Adicionar variação</p>
        <div className="grid grid-cols-1 gap-3 rounded-lg border border-borda bg-fundo p-3 sm:grid-cols-[1fr_1fr_7rem_auto] sm:items-start">
          <Campo label="Tamanho" htmlFor="nova-var-tam">
            <input
              id="nova-var-tam"
              list="tamanhos-sugeridos"
              value={nova.tamanho}
              onChange={(e) => setNova((n) => ({ ...n, tamanho: e.target.value }))}
              placeholder="Tamanho"
              className={inputClasse}
            />
            <datalist id="tamanhos-sugeridos">
              {TAMANHOS.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </Campo>
          <Campo label="Cor" htmlFor="nova-var-cor">
            <SeletorCor
              id="nova-var-cor"
              cor={nova.cor}
              corHex={nova.corHex}
              aoSelecionar={(nome, hex) =>
                setNova((n) => ({ ...n, cor: nome, corHex: hex }))
              }
            />
          </Campo>
          <Campo label="Estoque" htmlFor="nova-var-est">
            <input
              id="nova-var-est"
              type="number"
              min="0"
              step="1"
              value={nova.estoque}
              onChange={(e) => setNova((n) => ({ ...n, estoque: e.target.value }))}
              placeholder="Estoque"
              className={inputClasse}
            />
          </Campo>
          <div className="sm:pt-6">
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
    </div>
  );
}

function LinhaVariacao({ variacao, onSalvar, onRemover, salvando }) {
  const [tamanho, setTamanho] = useState(variacao.tamanho);
  const [cor, setCor] = useState(variacao.cor);
  const [corHex, setCorHex] = useState(variacao.cor_hex ?? "");
  const [estoque, setEstoque] = useState(variacao.estoque);

  const mudou =
    tamanho !== variacao.tamanho ||
    cor !== variacao.cor ||
    (corHex ?? "") !== (variacao.cor_hex ?? "") ||
    Number(estoque) !== variacao.estoque;

  return (
    <div className="grid grid-cols-1 gap-3 rounded-lg border border-borda bg-fundo p-3 sm:grid-cols-[1fr_1fr_7rem_auto_auto] sm:items-start">
      <Campo label="Tamanho" htmlFor={`var-tam-${variacao.id}`}>
        <input
          id={`var-tam-${variacao.id}`}
          value={tamanho}
          onChange={(e) => setTamanho(e.target.value)}
          className={inputClasse}
        />
      </Campo>
      <Campo label="Cor" htmlFor={`var-cor-${variacao.id}`}>
        <SeletorCor
          id={`var-cor-${variacao.id}`}
          cor={cor}
          corHex={corHex}
          aoSelecionar={(nome, hex) => {
            setCor(nome);
            setCorHex(hex);
          }}
        />
      </Campo>
      <Campo label="Estoque" htmlFor={`var-est-${variacao.id}`}>
        <input
          id={`var-est-${variacao.id}`}
          type="number"
          min="0"
          value={estoque}
          onChange={(e) => setEstoque(e.target.value)}
          className={
            inputClasse + (variacao.esgotado ? " border-erro/60 text-erro" : "")
          }
        />
      </Campo>
      <div className="sm:pt-6">
        <button
          type="button"
          disabled={!mudou || salvando}
          onClick={() =>
            onSalvar({ tamanho, cor, cor_hex: corHex ?? "", estoque: Number(estoque) })
          }
          className="w-full rounded-lg border border-borda px-3 py-2 text-sm text-texto transition hover:border-acento-escuro disabled:opacity-40"
        >
          Salvar
        </button>
      </div>
      <div className="sm:pt-6">
        <BotaoPerigo type="button" onClick={onRemover}>
          Remover
        </BotaoPerigo>
      </div>
    </div>
  );
}
