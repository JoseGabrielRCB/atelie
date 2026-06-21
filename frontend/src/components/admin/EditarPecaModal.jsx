import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { obterPeca, atualizarPeca } from "../../lib/api";
import { useCategorias } from "../../hooks/useCategorias";
import { useAdminPecas } from "../../hooks/useAdminPecas";
import { Carregando, Erro } from "../Estado";
import VariacoesEditor from "./VariacoesEditor";
import ImagensEditor from "./ImagensEditor";
import { BotaoPrimario, BotaoSecundario, Campo, Feedback, inputClasse } from "./ui";

// Edição de peça DENTRO de um modal (sem tirar o usuário da lista).
// Reutiliza VariacoesEditor/ImagensEditor, que operam sobre a peça já existente.
export default function EditarPecaModal({ pecaId, aoFechar }) {
  const pecaQ = useQuery({
    queryKey: ["admin", "peca", String(pecaId)],
    queryFn: () => obterPeca(pecaId, { auth: true }),
    enabled: Boolean(pecaId),
  });

  if (pecaQ.isLoading) return <Carregando texto="Carregando peça..." />;
  if (pecaQ.isError)
    return <Erro mensagem={pecaQ.error.message} aoTentarNovamente={pecaQ.refetch} />;
  if (!pecaQ.data) return null;

  // key reinicia o estado do form ao trocar de peça (sem efeito).
  return <FormEdicao key={pecaQ.data.id} peca={pecaQ.data} aoFechar={aoFechar} />;
}

function FormEdicao({ peca, aoFechar }) {
  const qc = useQueryClient();
  const { data: categorias = [] } = useCategorias();
  const { data: pecasExistentes = [] } = useAdminPecas();

  const [form, setForm] = useState({
    nome: peca.nome ?? "",
    descricao: peca.descricao ?? "",
    preco: peca.preco ?? "",
    categoria: peca.categoria ?? "",
    tipo: peca.tipo ?? "pronta",
    ativo: peca.ativo ?? true,
  });
  const [erro, setErro] = useState("");
  const [ok, setOk] = useState("");

  // Nome único: avisa se colidir com OUTRA peça (ignora a própria).
  const nomeDuplicado =
    form.nome.trim() !== "" &&
    pecasExistentes.some(
      (p) =>
        p.id !== peca.id &&
        p.nome.trim().toLowerCase() === form.nome.trim().toLowerCase()
    );

  const salvarMut = useMutation({
    mutationFn: (dados) => atualizarPeca(peca.id, dados),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "pecas"] });
      qc.invalidateQueries({ queryKey: ["admin", "peca", String(peca.id)] });
      setOk("Alterações salvas.");
    },
    onError: (e) => setErro(e.message),
  });

  function aoEnviar(e) {
    e.preventDefault();
    setErro("");
    setOk("");
    if (nomeDuplicado) {
      setErro("Já existe uma peça com esse nome.");
      return;
    }
    salvarMut.mutate({
      nome: form.nome,
      descricao: form.descricao,
      preco: form.preco,
      categoria: form.categoria,
      tipo: form.tipo,
      ativo: form.ativo,
    });
  }

  const atualizarCampo = (campo, valor) =>
    setForm((f) => ({ ...f, [campo]: valor }));

  // Mesmo layout do "Nova peça": básicos → variações → imagens → Salvar no fim.
  return (
    <div className="space-y-8">
      {/* ---- Dados básicos ---- */}
      <form id="editar-peca-basicos" onSubmit={aoEnviar}>
        <fieldset className="space-y-4" disabled={salvarMut.isPending}>
          <legend className="mb-2 text-sm font-semibold uppercase tracking-wide text-texto-suave">
            Dados básicos
          </legend>

          <Campo label="Nome" htmlFor="edit-nome">
            <input
              id="edit-nome"
              value={form.nome}
              onChange={(e) => atualizarCampo("nome", e.target.value)}
              required
              aria-invalid={nomeDuplicado}
              className={
                inputClasse + (nomeDuplicado ? " border-erro focus:ring-erro/30" : "")
              }
            />
            {nomeDuplicado && (
              <p className="mt-1 text-xs text-erro" role="alert">
                Já existe uma peça com esse nome.
              </p>
            )}
          </Campo>

          <Campo label="Descrição" htmlFor="edit-descricao">
            <textarea
              id="edit-descricao"
              value={form.descricao}
              onChange={(e) => atualizarCampo("descricao", e.target.value)}
              rows={3}
              className={inputClasse}
            />
          </Campo>

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo label="Preço (R$)" htmlFor="edit-preco">
              <input
                id="edit-preco"
                type="number"
                step="0.01"
                min="0"
                value={form.preco}
                onChange={(e) => atualizarCampo("preco", e.target.value)}
                required
                className={inputClasse}
              />
            </Campo>

            <Campo label="Categoria" htmlFor="edit-categoria">
              <select
                id="edit-categoria"
                value={form.categoria}
                onChange={(e) => atualizarCampo("categoria", e.target.value)}
                required
                className={inputClasse}
              >
                <option value="">Selecione...</option>
                {categorias.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </Campo>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo label="Tipo" htmlFor="edit-tipo">
              <select
                id="edit-tipo"
                value={form.tipo}
                onChange={(e) => atualizarCampo("tipo", e.target.value)}
                className={inputClasse}
              >
                <option value="pronta">Pronta</option>
                <option value="sob_medida">Sob medida</option>
              </select>
            </Campo>

            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm text-texto">
                <input
                  type="checkbox"
                  checked={form.ativo}
                  onChange={(e) => atualizarCampo("ativo", e.target.checked)}
                  className="h-4 w-4 accent-[var(--color-acento-escuro)]"
                />
                Ativa na vitrine
              </label>
            </div>
          </div>
        </fieldset>
      </form>

      {/* ---- Variações e imagens (peça já existe → editores ao vivo) ---- */}
      {peca.tipo === "pronta" ? (
        <VariacoesEditor peca={peca} />
      ) : (
        <div className="rounded-lg border border-borda bg-superficie p-5 text-sm text-texto-suave">
          Peças sob medida não usam variações de estoque.
        </div>
      )}
      <ImagensEditor peca={peca} />

      {erro && <Feedback tipo="erro">{erro}</Feedback>}
      {ok && <Feedback tipo="sucesso">{ok}</Feedback>}

      {/* ---- Passo final: Salvar no fim (igual ao "Nova peça") ---- */}
      <div className="flex flex-col gap-3 border-t border-borda pt-5 sm:flex-row sm:justify-end">
        <BotaoSecundario
          type="button"
          onClick={aoFechar}
          disabled={salvarMut.isPending}
        >
          Fechar
        </BotaoSecundario>
        <BotaoPrimario
          type="submit"
          form="editar-peca-basicos"
          disabled={salvarMut.isPending || nomeDuplicado}
        >
          {salvarMut.isPending ? "Salvando..." : "Salvar alterações"}
        </BotaoPrimario>
      </div>
    </div>
  );
}
