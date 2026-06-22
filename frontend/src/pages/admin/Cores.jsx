import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { HexColorPicker } from "react-colorful";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { criarCor, atualizarCor, excluirCor } from "../../lib/api";
import { useCores } from "../../hooks/useCores";
import { useOrdenacao, ordenarPor } from "../../hooks/useOrdenacao";
import { hexValido, normalizarHex } from "../../lib/cores";
import { CabecalhoOrdenavel } from "../../components/admin/CabecalhoOrdenavel";
import Modal from "../../components/admin/Modal";
import ConfirmarExclusao from "../../components/admin/ConfirmarExclusao";
import { Carregando, Erro, Vazio } from "../../components/Estado";
import {
  BotaoPrimario,
  BotaoSecundario,
  Campo,
  Feedback,
  inputClasse,
} from "../../components/admin/ui";

// Modal para criar/editar uma cor (picker react-colorful + nome + hex).
function FormCor({ aberto, aoFechar, cor }) {
  const qc = useQueryClient();
  const editando = Boolean(cor);
  const [nome, setNome] = useState(cor?.nome ?? "");
  const [hex, setHex] = useState(cor?.hex ?? "#B07A56");
  const [erro, setErro] = useState("");

  // Reseta os campos ao (re)abrir, sem efeito (padrão do projeto).
  const [abertoAntes, setAbertoAntes] = useState(aberto);
  if (aberto !== abertoAntes) {
    setAbertoAntes(aberto);
    if (aberto) {
      setNome(cor?.nome ?? "");
      setHex(cor?.hex ?? "#B07A56");
      setErro("");
    }
  }

  const salvarMut = useMutation({
    mutationFn: (dados) =>
      editando ? atualizarCor(cor.id, dados) : criarCor(dados),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cores"] });
      aoFechar();
    },
    onError: (e) => setErro(e.message),
  });

  function enviar(e) {
    e.preventDefault();
    setErro("");
    const limpo = nome.trim();
    if (!limpo) {
      setErro("Informe um nome para a cor.");
      return;
    }
    if (!hexValido(hex)) {
      setErro("Use uma cor no formato #RRGGBB.");
      return;
    }
    salvarMut.mutate({ nome: limpo, hex: normalizarHex(hex) });
  }

  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo={editando ? "Editar cor" : "Nova cor"}
      tamanho="sm"
    >
      <form onSubmit={enviar} className="space-y-4">
        <HexColorPicker
          color={hexValido(hex) ? hex : "#B07A56"}
          onChange={(h) => {
            setErro("");
            setHex(h.toUpperCase());
          }}
          style={{ width: "100%", height: 140 }}
        />

        <Campo label="Nome da cor" htmlFor="cor-nome">
          <input
            id="cor-nome"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            maxLength={30}
            placeholder="Ex.: Terracota"
            className={inputClasse}
          />
          <div className="mt-1 text-right text-xs text-texto-suave">
            {nome.length}/30
          </div>
        </Campo>

        <Campo label="Código (hex)" htmlFor="cor-hex">
          <div className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="inline-block h-9 w-9 shrink-0 rounded border border-borda"
              style={{ backgroundColor: hexValido(hex) ? hex : "transparent" }}
            />
            <input
              id="cor-hex"
              value={hex}
              onChange={(e) => {
                setErro("");
                setHex(e.target.value.toUpperCase());
              }}
              maxLength={7}
              placeholder="#RRGGBB"
              className={inputClasse}
            />
          </div>
        </Campo>

        {erro && <Feedback tipo="erro">{erro}</Feedback>}

        <div className="flex justify-end gap-2">
          <BotaoSecundario type="button" onClick={aoFechar}>
            Cancelar
          </BotaoSecundario>
          <BotaoPrimario type="submit" disabled={salvarMut.isPending}>
            {salvarMut.isPending ? "Salvando..." : editando ? "Salvar" : "Criar"}
          </BotaoPrimario>
        </div>
      </form>
    </Modal>
  );
}

export default function Cores() {
  const qc = useQueryClient();
  const coresQ = useCores();
  const [erro, setErro] = useState("");
  const [ok, setOk] = useState("");
  const [formAberto, setFormAberto] = useState(false);
  const [emEdicao, setEmEdicao] = useState(null); // cor sendo editada (ou null = nova)
  const [exclusao, setExclusao] = useState(null);

  const { ordenacao, alternar } = useOrdenacao("admin-cores", {
    coluna: "nome",
    direcao: "asc",
  });

  const cores = ordenarPor(coresQ.data ?? [], ordenacao.coluna, ordenacao.direcao, {
    nome: (c) => c.nome,
    hex: (c) => c.hex,
  });

  function abrirNova() {
    setErro("");
    setOk("");
    setEmEdicao(null);
    setFormAberto(true);
  }

  function abrirEdicao(cor) {
    setErro("");
    setOk("");
    setEmEdicao(cor);
    setFormAberto(true);
  }

  function pedirExclusao(cor) {
    setErro("");
    setOk("");
    setExclusao({
      titulo: "Excluir cor",
      itens: [{ chave: `cor-${cor.id}`, titulo: `Cor "${cor.nome}" (${cor.hex})` }],
      resumo: "Total: 1 cor.",
      // Cor não tem dependentes em cascata → confirmação simples.
      cascata: false,
      confirmacaoTexto: null,
      alvos: [{ id: cor.id, rotulo: `Cor "${cor.nome}"` }],
      excluir: excluirCor,
    });
  }

  function aoConcluirExclusao({ sucesso, falhas }) {
    qc.invalidateQueries({ queryKey: ["cores"] });
    if (falhas.length === 0) setOk(`${sucesso} cor(es) excluída(s).`);
    else setErro(`${falhas.length} cor(es) não puderam ser excluídas.`);
  }

  return (
    <section>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-semibold">Cores</h1>
        <BotaoPrimario type="button" onClick={abrirNova}>
          <Plus size={18} aria-hidden="true" />
          Nova cor
        </BotaoPrimario>
      </div>

      <p className="mb-4 text-sm text-texto-suave">
        Paleta de cores salvas, usada ao cadastrar variações das peças.
      </p>

      {erro && (
        <div className="mb-4">
          <Feedback tipo="erro">{erro}</Feedback>
        </div>
      )}
      {ok && (
        <div className="mb-4">
          <Feedback tipo="sucesso">{ok}</Feedback>
        </div>
      )}

      {coresQ.isLoading && <Carregando texto="Carregando cores..." />}
      {coresQ.isError && (
        <Erro mensagem={coresQ.error.message} aoTentarNovamente={coresQ.refetch} />
      )}

      {!coresQ.isLoading && !coresQ.isError && cores.length === 0 && (
        <Vazio texto="Nenhuma cor cadastrada." />
      )}

      {cores.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-borda">
          <table className="w-full min-w-[420px] text-left text-sm">
            <thead className="border-b border-borda bg-superficie text-texto-suave">
              <tr>
                <th className="w-16 px-4 py-3 font-medium">Cor</th>
                <CabecalhoOrdenavel
                  coluna="nome"
                  rotulo="Nome"
                  ordenacao={ordenacao}
                  aoOrdenar={alternar}
                />
                <CabecalhoOrdenavel
                  coluna="hex"
                  rotulo="Hex"
                  ordenacao={ordenacao}
                  aoOrdenar={alternar}
                />
                <th className="px-4 py-3 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-borda">
              {cores.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-3">
                    <span
                      aria-hidden="true"
                      className="inline-block h-7 w-7 rounded border border-borda"
                      style={{ backgroundColor: hexValido(c.hex) ? c.hex : "transparent" }}
                    />
                  </td>
                  <td className="px-4 py-3 font-medium text-texto">{c.nome}</td>
                  <td className="px-4 py-3 tabular-nums text-texto-suave">{c.hex}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => abrirEdicao(c)}
                        aria-label={`Editar cor ${c.nome}`}
                        className="inline-flex items-center justify-center rounded-lg border border-borda p-1.5 text-texto-suave transition hover:border-acento-escuro hover:text-acento-escuro focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acento-escuro"
                      >
                        <Pencil size={16} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => pedirExclusao(c)}
                        aria-label={`Excluir cor ${c.nome}`}
                        className="inline-flex items-center justify-center rounded-lg border border-erro/40 p-1.5 text-erro transition hover:bg-erro/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-erro"
                      >
                        <Trash2 size={16} aria-hidden="true" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <FormCor
        aberto={formAberto}
        aoFechar={() => setFormAberto(false)}
        cor={emEdicao}
      />

      <ConfirmarExclusao
        aberto={Boolean(exclusao)}
        aoFechar={() => setExclusao(null)}
        titulo={exclusao?.titulo}
        itens={exclusao?.itens ?? []}
        resumo={exclusao?.resumo ?? ""}
        cascata={exclusao?.cascata ?? false}
        confirmacaoTexto={exclusao?.confirmacaoTexto ?? null}
        alvos={exclusao?.alvos ?? []}
        excluir={exclusao?.excluir}
        aoConcluir={aoConcluirExclusao}
      />
    </section>
  );
}
