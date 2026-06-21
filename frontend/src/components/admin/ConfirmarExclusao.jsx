import { useState } from "react";
import { AlertTriangle, Trash2 } from "lucide-react";
import Modal from "./Modal";
import { BotaoSecundario, inputClasse } from "./ui";

// Confirmação de exclusão reutilizável (um ou vários itens). Lista TUDO o que
// será removido, agrupado por item-pai (com dependentes em cascata aninhados) e
// um total ao final. A exclusão é executada item a item (DELETE por id), com
// indicador de progresso e tratamento de falha parcial.
//
// Props:
// - itens: [{ chave, titulo, linhas?: string[], vazio?: bool }] — o que será removido.
// - resumo: string (ex.: "Total: 2 categorias, 2 peças, 4 variações, 3 imagens").
// - cascata: bool — exige confirmação reforçada (categorias/peças).
// - confirmacaoTexto: string|null — palavra exata a digitar (ex.: nome da categoria
//   ou "EXCLUIR"); se ausente e cascata=true, usa um checkbox "entendo".
// - alvos: [{ id, rotulo }] — itens a excluir (1 ou vários).
// - excluir: async (id) => void — remove UM alvo.
// - aoConcluir: ({ sucesso, falhas }) => void — invalida queries / dá feedback.
export default function ConfirmarExclusao({
  aberto,
  aoFechar,
  titulo = "Confirmar exclusão",
  itens = [],
  resumo = "",
  cascata = false,
  confirmacaoTexto = null,
  alvos = [],
  excluir,
  aoConcluir,
}) {
  const [palavra, setPalavra] = useState("");
  const [marcado, setMarcado] = useState(false);
  const [fase, setFase] = useState("confirmar"); // confirmar | executando | resultado
  const [progresso, setProgresso] = useState({ feito: 0, total: 0 });
  const [falhas, setFalhas] = useState([]);

  // Reseta o estado sempre que o modal abre (padrão "ajustar estado na
  // renderização" — sem efeito, conforme recomendação do React).
  const [abertoAntes, setAbertoAntes] = useState(aberto);
  if (aberto !== abertoAntes) {
    setAbertoAntes(aberto);
    if (aberto) {
      setPalavra("");
      setMarcado(false);
      setFase("confirmar");
      setProgresso({ feito: 0, total: 0 });
      setFalhas([]);
    }
  }

  const precisaPalavra = cascata && Boolean(confirmacaoTexto);
  const precisaCheck = cascata && !confirmacaoTexto;
  const liberado =
    (!precisaPalavra || palavra.trim() === String(confirmacaoTexto).trim()) &&
    (!precisaCheck || marcado);

  async function executar() {
    setFase("executando");
    setProgresso({ feito: 0, total: alvos.length });
    const erros = [];
    for (let i = 0; i < alvos.length; i += 1) {
      const alvo = alvos[i];
      try {
        await excluir(alvo.id);
      } catch (e) {
        erros.push({ rotulo: alvo.rotulo, mensagem: e.message });
      }
      setProgresso({ feito: i + 1, total: alvos.length });
    }
    setFalhas(erros);
    aoConcluir?.({ sucesso: alvos.length - erros.length, falhas: erros });
    if (erros.length === 0) {
      aoFechar();
    } else {
      setFase("resultado");
    }
  }

  const executando = fase === "executando";

  return (
    <Modal
      aberto={aberto}
      // Bloqueia fechar enquanto exclui (evita interromper o loop).
      aoFechar={executando ? () => {} : aoFechar}
      titulo={titulo}
      tamanho="lg"
    >
      {fase === "resultado" ? (
        <ResultadoParcial
          progresso={progresso}
          falhas={falhas}
          aoFechar={aoFechar}
        />
      ) : (
        <div className="space-y-4">
          <div className="flex items-start gap-2 rounded-lg border border-erro/30 bg-erro/5 px-4 py-3 text-sm text-texto">
            <AlertTriangle size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-erro" />
            <span>
              Você vai excluir os itens abaixo. Esta ação é{" "}
              <strong>irreversível</strong>.
            </span>
          </div>

          <ul className="space-y-3">
            {itens.map((it) => (
              <li key={it.chave}>
                <p className="font-medium text-texto">▸ {it.titulo}</p>
                {it.vazio ? (
                  <p className="ml-4 text-sm text-texto-suave">(nenhuma peça)</p>
                ) : (
                  (it.linhas ?? []).length > 0 && (
                    <ul className="ml-4 mt-1 list-disc space-y-0.5 pl-4 text-sm text-texto-suave">
                      {it.linhas.map((linha, i) => (
                        <li key={i}>{linha}</li>
                      ))}
                    </ul>
                  )
                )}
              </li>
            ))}
          </ul>

          {resumo && (
            <p className="border-t border-borda pt-3 text-sm font-semibold text-texto">
              {resumo}
            </p>
          )}

          {precisaPalavra && (
            <div>
              <label htmlFor="conf-palavra" className="mb-1 block text-sm text-texto">
                Para confirmar, digite{" "}
                <strong>{confirmacaoTexto}</strong>:
              </label>
              <input
                id="conf-palavra"
                value={palavra}
                onChange={(e) => setPalavra(e.target.value)}
                autoComplete="off"
                className={inputClasse + " sm:max-w-xs"}
              />
            </div>
          )}

          {precisaCheck && (
            <label className="flex items-center gap-2 text-sm text-texto">
              <input
                type="checkbox"
                checked={marcado}
                onChange={(e) => setMarcado(e.target.checked)}
                className="h-4 w-4 accent-[var(--color-erro)]"
              />
              Entendo que esta ação é irreversível.
            </label>
          )}

          {executando && (
            <p className="text-sm text-texto-suave" role="status">
              Excluindo {progresso.feito} de {progresso.total}...
            </p>
          )}

          <div className="flex flex-col gap-3 border-t border-borda pt-4 sm:flex-row sm:justify-end">
            <BotaoSecundario type="button" onClick={aoFechar} disabled={executando}>
              Cancelar
            </BotaoSecundario>
            <button
              type="button"
              onClick={executar}
              disabled={!liberado || executando || alvos.length === 0}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-erro px-4 py-2 font-medium text-white transition hover:bg-erro/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-erro focus-visible:ring-offset-2 focus-visible:ring-offset-fundo disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Trash2 size={18} aria-hidden="true" />
              {executando ? "Excluindo..." : "Excluir definitivamente"}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

// Tela mostrada quando alguma exclusão falhou (falha parcial).
function ResultadoParcial({ progresso, falhas, aoFechar }) {
  const sucesso = progresso.total - falhas.length;
  return (
    <div className="space-y-4">
      <p className="text-sm text-texto">
        <strong className="text-sucesso">{sucesso}</strong> de {progresso.total}{" "}
        excluído(s) com sucesso.
      </p>
      <div>
        <p className="mb-1 flex items-center gap-1 text-sm font-medium text-erro">
          <AlertTriangle size={15} aria-hidden="true" />
          {falhas.length} não pôde(puderam) ser excluído(s):
        </p>
        <ul className="ml-4 list-disc space-y-0.5 pl-4 text-sm text-texto-suave">
          {falhas.map((f, i) => (
            <li key={i}>
              {f.rotulo} — {f.mensagem}
            </li>
          ))}
        </ul>
      </div>
      <div className="flex justify-end border-t border-borda pt-4">
        <BotaoSecundario type="button" onClick={aoFechar}>
          Fechar
        </BotaoSecundario>
      </div>
    </div>
  );
}
