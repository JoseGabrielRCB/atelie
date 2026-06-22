import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { HexColorPicker } from "react-colorful";
import { Plus, Check } from "lucide-react";
import { criarCor } from "../../lib/api";
import { useCores } from "../../hooks/useCores";
import { hexValido, normalizarHex, corDeTextoSobre } from "../../lib/cores";
import { BotaoPrimario, BotaoSecundario, inputClasse } from "./ui";

// Quadradinho de cor reutilizável.
function Swatch({ hex, tamanho = 18 }) {
  return (
    <span
      aria-hidden="true"
      className="inline-block shrink-0 rounded border border-borda"
      style={{ width: tamanho, height: tamanho, backgroundColor: hexValido(hex) ? hex : "transparent" }}
    />
  );
}

// Seletor de cor com paleta salva + criação de nova cor.
// - Clique numa cor salva define `cor` (nome) e `corHex` (hex) na variação.
// - "Nova cor" abre um picker (react-colorful) + nome → POST /api/cores/,
//   invalida ["cores"] e já seleciona a cor recém-criada.
// Props:
//   cor, corHex   — valores atuais da variação
//   aoSelecionar  — (nome, hex) => void
//   id            — base para ids/labels acessíveis
export default function SeletorCor({ cor, corHex, aoSelecionar, id = "cor" }) {
  const qc = useQueryClient();
  const { data: cores = [], isLoading } = useCores();
  const [criando, setCriando] = useState(false);
  const [novoNome, setNovoNome] = useState("");
  const [novoHex, setNovoHex] = useState("#B07A56");
  const [erro, setErro] = useState("");

  const criarMut = useMutation({
    mutationFn: criarCor,
    onSuccess: (criada) => {
      qc.invalidateQueries({ queryKey: ["cores"] });
      aoSelecionar(criada.nome, criada.hex);
      setCriando(false);
      setNovoNome("");
      setErro("");
    },
    onError: (e) => setErro(e.message),
  });

  // Cor atualmente selecionada (casa por nome, ignorando caixa).
  const selecionada = cores.find(
    (c) => c.nome.trim().toLowerCase() === String(cor ?? "").trim().toLowerCase()
  );

  function salvarNova(e) {
    e.preventDefault();
    setErro("");
    const nome = novoNome.trim();
    if (!nome) {
      setErro("Informe um nome para a cor.");
      return;
    }
    if (!hexValido(novoHex)) {
      setErro("Use uma cor no formato #RRGGBB.");
      return;
    }
    criarMut.mutate({ nome, hex: normalizarHex(novoHex) });
  }

  return (
    <div className="space-y-2">
      {/* Paleta de cores salvas */}
      {isLoading ? (
        <p className="text-xs text-texto-suave">Carregando cores...</p>
      ) : cores.length === 0 ? (
        <p className="text-xs text-texto-suave">
          Nenhuma cor salva ainda. Crie a primeira em “Nova cor”.
        </p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {cores.map((c) => {
            const ativa = selecionada?.id === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => aoSelecionar(c.nome, c.hex)}
                title={`${c.nome} (${c.hex})`}
                aria-label={`Selecionar cor ${c.nome}`}
                aria-pressed={ativa}
                className={
                  "relative inline-flex h-7 w-7 items-center justify-center rounded border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acento-escuro " +
                  (ativa ? "border-acento-escuro ring-2 ring-acento-escuro/40" : "border-borda")
                }
                style={{ backgroundColor: hexValido(c.hex) ? c.hex : "transparent" }}
              >
                {ativa && (
                  <Check size={14} aria-hidden="true" style={{ color: corDeTextoSobre(c.hex) }} />
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Resumo da cor selecionada */}
      <div className="flex items-center gap-2 text-sm text-texto">
        {cor ? (
          <>
            <Swatch hex={corHex} />
            <span className="truncate">
              {cor}
              {corHex ? <span className="text-texto-suave"> · {corHex}</span> : null}
            </span>
          </>
        ) : (
          <span className="text-texto-suave">Nenhuma cor selecionada</span>
        )}
      </div>

      {/* Criar nova cor */}
      {criando ? (
        <div className="space-y-3 rounded-lg border border-borda bg-fundo p-3">
          <HexColorPicker
            color={hexValido(novoHex) ? novoHex : "#B07A56"}
            onChange={(h) => {
              setErro("");
              setNovoHex(h.toUpperCase());
            }}
            style={{ width: "100%", height: 120 }}
          />
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <label htmlFor={`${id}-novo-nome`} className="mb-1 block text-xs text-texto">
                Nome da cor
              </label>
              <input
                id={`${id}-novo-nome`}
                value={novoNome}
                onChange={(e) => setNovoNome(e.target.value)}
                maxLength={30}
                placeholder="Ex.: Terracota"
                className={inputClasse}
              />
            </div>
            <div>
              <label htmlFor={`${id}-novo-hex`} className="mb-1 block text-xs text-texto">
                Código (hex)
              </label>
              <div className="flex items-center gap-2">
                <Swatch hex={novoHex} tamanho={36} />
                <input
                  id={`${id}-novo-hex`}
                  value={novoHex}
                  onChange={(e) => {
                    setErro("");
                    setNovoHex(e.target.value.toUpperCase());
                  }}
                  maxLength={7}
                  placeholder="#RRGGBB"
                  className={inputClasse}
                />
              </div>
            </div>
          </div>

          {erro && (
            <p className="text-xs text-erro" role="alert">
              {erro}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <BotaoPrimario
              type="button"
              onClick={salvarNova}
              disabled={criarMut.isPending}
              className="px-3 py-1.5 text-sm"
            >
              {criarMut.isPending ? "Salvando..." : "Salvar cor"}
            </BotaoPrimario>
            <BotaoSecundario
              type="button"
              onClick={() => {
                setCriando(false);
                setErro("");
              }}
              className="px-3 py-1.5 text-sm"
            >
              Cancelar
            </BotaoSecundario>
          </div>
        </div>
      ) : (
        <BotaoSecundario
          type="button"
          onClick={() => {
            setCriando(true);
            setErro("");
          }}
          className="px-3 py-1.5 text-sm"
        >
          <Plus size={16} aria-hidden="true" />
          Nova cor
        </BotaoSecundario>
      )}
    </div>
  );
}
