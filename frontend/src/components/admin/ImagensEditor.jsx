import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { enviarImagem, atualizarImagem, excluirImagem } from "../../lib/api";
import ConfirmarExclusao from "./ConfirmarExclusao";
import { BotaoPrimario, Feedback, Selo } from "./ui";

// Gestão de imagens da peça: upload (multipart), marcar principal e remover.
export default function ImagensEditor({ peca }) {
  const qc = useQueryClient();
  const inputRef = useRef(null);
  const [arquivo, setArquivo] = useState(null);
  const [principal, setPrincipal] = useState(false);
  const [erro, setErro] = useState("");
  const [exclusao, setExclusao] = useState(null); // imagem a remover

  const invalidar = () => {
    qc.invalidateQueries({ queryKey: ["admin", "peca", String(peca.id)] });
    qc.invalidateQueries({ queryKey: ["admin", "pecas"] });
  };

  const enviarMut = useMutation({
    mutationFn: enviarImagem,
    onSuccess: () => {
      setArquivo(null);
      setPrincipal(false);
      if (inputRef.current) inputRef.current.value = "";
      invalidar();
    },
    onError: (e) => setErro(e.message),
  });

  const principalMut = useMutation({
    mutationFn: async (imagem) => {
      // Marca a escolhida como principal e desmarca as demais.
      await atualizarImagem(imagem.id, { principal: true });
      const outras = (peca.imagens ?? []).filter(
        (i) => i.id !== imagem.id && i.principal
      );
      await Promise.all(
        outras.map((i) => atualizarImagem(i.id, { principal: false }))
      );
    },
    onSuccess: invalidar,
    onError: (e) => setErro(e.message),
  });

  function aoConcluirExclusao({ falhas }) {
    invalidar();
    if (falhas.length) setErro("Não foi possível remover a imagem. Tente novamente.");
  }

  function aoEnviar() {
    setErro("");
    if (!arquivo) {
      setErro("Escolha um arquivo de imagem.");
      return;
    }
    enviarMut.mutate({ peca: peca.id, arquivo, principal });
  }

  const imagens = peca.imagens ?? [];

  return (
    <div className="rounded-lg border border-borda bg-superficie p-5">
      <h2 className="mb-1 font-display text-xl font-semibold">Imagens</h2>
      <p className="mb-4 text-sm text-texto-suave">
        A imagem principal aparece na vitrine.
      </p>

      {erro && (
        <div className="mb-3">
          <Feedback tipo="erro">{erro}</Feedback>
        </div>
      )}

      {imagens.length > 0 ? (
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {imagens.map((img) => (
            <div
              key={img.id}
              className="overflow-hidden rounded-lg border border-borda"
            >
              <div className="aspect-square w-full bg-fundo">
                <img
                  src={img.arquivo}
                  alt="Imagem da peça"
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="space-y-2 p-2">
                {img.principal ? (
                  <Selo cor="verde">Principal</Selo>
                ) : (
                  <button
                    type="button"
                    onClick={() => principalMut.mutate(img)}
                    disabled={principalMut.isPending}
                    className="text-xs font-medium text-acento-escuro hover:underline disabled:opacity-50"
                  >
                    Tornar principal
                  </button>
                )}
                <div>
                  <button
                    type="button"
                    onClick={() => {
                      setErro("");
                      setExclusao(img);
                    }}
                    className="text-xs text-erro hover:underline"
                  >
                    Remover
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="mb-4 text-sm text-texto-suave">Nenhuma imagem ainda.</p>
      )}

      <div className="border-t border-borda pt-4">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          aria-label="Arquivo de imagem"
          onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
          className="block w-full text-sm text-texto-suave file:mr-3 file:rounded-lg file:border-0 file:bg-acento-escuro file:px-4 file:py-2 file:text-white hover:file:bg-acento-hover"
        />
        <label className="mt-3 flex items-center gap-2 text-sm text-texto">
          <input
            type="checkbox"
            checked={principal}
            onChange={(e) => setPrincipal(e.target.checked)}
            className="h-4 w-4 accent-[var(--color-acento-escuro)]"
          />
          Definir como principal
        </label>
        <BotaoPrimario
          type="button"
          onClick={aoEnviar}
          disabled={enviarMut.isPending}
          className="mt-3"
        >
          {enviarMut.isPending ? "Enviando..." : "Enviar imagem"}
        </BotaoPrimario>
      </div>

      <ConfirmarExclusao
        aberto={Boolean(exclusao)}
        aoFechar={() => setExclusao(null)}
        titulo="Excluir imagem"
        itens={
          exclusao
            ? [{ chave: `img-${exclusao.id}`, titulo: exclusao.principal ? "Imagem principal da peça" : "Imagem da peça" }]
            : []
        }
        alvos={exclusao ? [{ id: exclusao.id, rotulo: "Imagem da peça" }] : []}
        excluir={excluirImagem}
        aoConcluir={aoConcluirExclusao}
      />
    </div>
  );
}
