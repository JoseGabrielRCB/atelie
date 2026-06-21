import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Star, CheckCircle2 } from "lucide-react";
import { criarPeca, criarVariacao, enviarImagem } from "../../lib/api";
import { useCategorias } from "../../hooks/useCategorias";
import { useAdminPecas } from "../../hooks/useAdminPecas";
import {
  BotaoPrimario,
  BotaoSecundario,
  BotaoPerigo,
  Campo,
  Feedback,
  inputClasse,
} from "./ui";

// Estado inicial dos campos básicos da peça.
function formInicial() {
  return {
    nome: "",
    descricao: "",
    preco: "",
    categoria: "",
    tipo: "pronta",
    ativo: true,
  };
}

// Uma linha de variação vazia.
function variacaoVazia() {
  return { tamanho: "", cor: "", estoque: "0" };
}

// Descrição curta da variação para mensagens de erro (ex.: "P/Amarelo").
function descreverVariacao(v) {
  const partes = [v.tamanho, v.cor].map((p) => p?.trim()).filter(Boolean);
  return partes.length ? partes.join("/") : "sem tamanho/cor";
}

// Modal de criação de peça: formulário completo (básicos + variações + imagens)
// numa só tela. Ao salvar cria a peça e, com o id, cria as variações e envia as
// imagens em sequência. Não navega — oferece "Adicionar mais peças" ou "Fechar".
export default function NovaPecaModal({ aoFechar }) {
  const qc = useQueryClient();
  const { data: categorias = [] } = useCategorias();
  const { data: pecasExistentes = [] } = useAdminPecas();

  const [form, setForm] = useState(formInicial);
  const [variacoes, setVariacoes] = useState([]);
  const [imagens, setImagens] = useState([]); // [{ arquivo, principal, id? }]
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [concluido, setConcluido] = useState(false);
  // Id da peça já criada. Em caso de falha parcial (peça criada, mas uma
  // variação/imagem falhou), reaproveitamos este id no retry para NÃO recriar
  // a peça — evitando peças órfãs/duplicadas.
  const [pecaCriadaId, setPecaCriadaId] = useState(null);

  const atualizarCampo = (campo, valor) =>
    setForm((f) => ({ ...f, [campo]: valor }));

  // Nome de peça é único: avisa na hora se já existir um igual.
  const nomeDuplicado =
    form.nome.trim() !== "" &&
    pecasExistentes.some(
      (p) => p.nome.trim().toLowerCase() === form.nome.trim().toLowerCase()
    );

  // ---- Variações (coletor local) ----
  function adicionarVariacao() {
    setVariacoes((vs) => [...vs, variacaoVazia()]);
  }
  function removerVariacao(indice) {
    setVariacoes((vs) => vs.filter((_, i) => i !== indice));
  }
  function atualizarVariacao(indice, campo, valor) {
    setVariacoes((vs) =>
      vs.map((v, i) => (i === indice ? { ...v, [campo]: valor } : v))
    );
  }

  // ---- Imagens (coletor local) ----
  function adicionarImagens(arquivos) {
    const novas = Array.from(arquivos).map((arquivo) => ({
      arquivo,
      principal: false,
    }));
    setImagens((atuais) => {
      const combinadas = [...atuais, ...novas];
      // Garante uma principal se ainda não houver nenhuma marcada.
      if (combinadas.length > 0 && !combinadas.some((i) => i.principal)) {
        combinadas[0] = { ...combinadas[0], principal: true };
      }
      return combinadas;
    });
  }
  function removerImagem(indice) {
    setImagens((atuais) => {
      const restantes = atuais.filter((_, i) => i !== indice);
      // Se removeu a principal, promove a primeira restante.
      if (restantes.length > 0 && !restantes.some((i) => i.principal)) {
        restantes[0] = { ...restantes[0], principal: true };
      }
      return restantes;
    });
  }
  function marcarPrincipal(indice) {
    setImagens((atuais) =>
      atuais.map((img, i) => ({ ...img, principal: i === indice }))
    );
  }

  // ---- Validação ----
  function validar() {
    if (!form.nome.trim()) return "Informe o nome da peça.";
    if (nomeDuplicado) return "Já existe uma peça com esse nome.";
    if (form.preco === "" || Number.isNaN(Number(form.preco)))
      return "Informe um preço válido.";
    if (Number(form.preco) < 0) return "O preço não pode ser negativo.";
    if (!form.categoria) return "Selecione uma categoria.";
    for (let i = 0; i < variacoes.length; i++) {
      const v = variacoes[i];
      const estoque = Number(v.estoque);
      if (v.estoque === "" || !Number.isInteger(estoque) || estoque < 0) {
        return `Estoque inválido na variação ${i + 1}: use um número inteiro ≥ 0.`;
      }
    }
    return "";
  }

  // ---- Salvar (peça → variações → imagens) ----
  // Tolerante a falha parcial: cria a peça uma única vez e marca cada
  // variação/imagem já salva (campo `id`). Num retry, pula o que já foi salvo
  // e tenta apenas o que faltou — sem duplicar nada.
  const salvarMut = useMutation({
    mutationFn: async () => {
      // 1) Peça: cria só se ainda não existe (reaproveita no retry parcial).
      let pecaId = pecaCriadaId;
      if (!pecaId) {
        const peca = await criarPeca({
          nome: form.nome.trim(),
          descricao: form.descricao,
          preco: form.preco,
          categoria: form.categoria,
          tipo: form.tipo,
          ativo: form.ativo,
        });
        pecaId = peca.id;
        setPecaCriadaId(pecaId);
      }

      // 2) Variações só fazem sentido para peça pronta; sob_medida não exige.
      if (form.tipo !== "sob_medida") {
        for (let i = 0; i < variacoes.length; i++) {
          const v = variacoes[i];
          if (v.id) continue; // já salva — não recriar
          try {
            const criada = await criarVariacao({
              peca: pecaId,
              tamanho: v.tamanho,
              cor: v.cor,
              estoque: Number(v.estoque),
            });
            setVariacoes((vs) =>
              vs.map((x, j) => (j === i ? { ...x, id: criada.id } : x))
            );
          } catch (e) {
            throw new Error(
              `Variação ${descreverVariacao(v)}: ${e.message}`,
              { cause: e }
            );
          }
        }
      }

      // 3) Imagens.
      for (let i = 0; i < imagens.length; i++) {
        const img = imagens[i];
        if (img.id) continue; // já enviada — não reenviar
        try {
          const enviada = await enviarImagem({
            peca: pecaId,
            arquivo: img.arquivo,
            principal: img.principal,
          });
          setImagens((arr) =>
            arr.map((x, j) => (j === i ? { ...x, id: enviada.id } : x))
          );
        } catch (e) {
          throw new Error(
            `Imagem "${img.arquivo.name}": ${e.message}`,
            { cause: e }
          );
        }
      }

      return pecaId;
    },
    onMutate: () => {
      setErro("");
      setSalvando(true);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "pecas"] });
      setSalvando(false);
      setConcluido(true);
    },
    onError: (e) => {
      // A lista pode ter mudado (peça criada): atualiza assim mesmo.
      qc.invalidateQueries({ queryKey: ["admin", "pecas"] });
      setSalvando(false);
      setErro(e.message);
    },
  });

  function aoEnviar(e) {
    e.preventDefault();
    const problema = validar();
    if (problema) {
      setErro(problema);
      return;
    }
    salvarMut.mutate();
  }

  // Limpa o formulário para cadastrar outra peça sem fechar o modal.
  function adicionarMais() {
    setForm(formInicial());
    setVariacoes([]);
    setImagens([]);
    setErro("");
    setConcluido(false);
    setPecaCriadaId(null);
  }

  // ---- Tela de confirmação após sucesso ----
  if (concluido) {
    return (
      <div className="space-y-6 text-center">
        <div className="flex flex-col items-center gap-3">
          <CheckCircle2
            size={48}
            aria-hidden="true"
            className="text-sucesso"
          />
          <div>
            <p className="font-display text-xl font-semibold text-texto">
              Peça cadastrada com sucesso!
            </p>
            <p className="mt-1 text-sm text-texto-suave">
              O que você quer fazer agora?
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <BotaoPrimario type="button" onClick={adicionarMais}>
            <Plus size={18} aria-hidden="true" />
            Adicionar mais peças
          </BotaoPrimario>
          <BotaoSecundario type="button" onClick={aoFechar}>
            Fechar
          </BotaoSecundario>
        </div>
      </div>
    );
  }

  const ehSobMedida = form.tipo === "sob_medida";

  return (
    <form onSubmit={aoEnviar} className="space-y-8">
      {/* ---- Dados básicos ---- */}
      <fieldset className="space-y-4" disabled={salvando}>
        <legend className="mb-2 text-sm font-semibold uppercase tracking-wide text-texto-suave">
          Dados básicos
        </legend>

        <Campo label="Nome" htmlFor="np-nome">
          <input
            id="np-nome"
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

        <Campo label="Descrição" htmlFor="np-descricao">
          <textarea
            id="np-descricao"
            value={form.descricao}
            onChange={(e) => atualizarCampo("descricao", e.target.value)}
            rows={3}
            className={inputClasse}
          />
        </Campo>

        <div className="grid gap-4 sm:grid-cols-2">
          <Campo label="Preço (R$)" htmlFor="np-preco">
            <input
              id="np-preco"
              type="number"
              step="0.01"
              min="0"
              value={form.preco}
              onChange={(e) => atualizarCampo("preco", e.target.value)}
              required
              className={inputClasse}
            />
          </Campo>

          <Campo label="Categoria" htmlFor="np-categoria">
            <select
              id="np-categoria"
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
          <Campo label="Tipo" htmlFor="np-tipo">
            <select
              id="np-tipo"
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

      {/* ---- Variações ---- */}
      <fieldset className="space-y-3" disabled={salvando}>
        <legend className="mb-1 text-sm font-semibold uppercase tracking-wide text-texto-suave">
          Variações
        </legend>

        {ehSobMedida ? (
          <p className="rounded-lg border border-borda bg-fundo p-3 text-sm text-texto-suave">
            Peças sob medida não usam variações de estoque.
          </p>
        ) : (
          <>
            {variacoes.length === 0 && (
              <p className="text-sm text-texto-suave">
                Nenhuma variação adicionada. Use o botão abaixo para incluir
                tamanhos/cores e o estoque de cada uma.
              </p>
            )}

            {variacoes.map((v, i) => (
              <div
                key={i}
                className="grid grid-cols-1 gap-3 rounded-lg border border-borda bg-fundo p-3 sm:grid-cols-[1fr_1fr_7rem_auto] sm:items-end"
              >
                <Campo label="Tamanho" htmlFor={`np-var-tam-${i}`}>
                  <input
                    id={`np-var-tam-${i}`}
                    value={v.tamanho}
                    onChange={(e) =>
                      atualizarVariacao(i, "tamanho", e.target.value)
                    }
                    className={inputClasse}
                  />
                </Campo>
                <Campo label="Cor" htmlFor={`np-var-cor-${i}`}>
                  <input
                    id={`np-var-cor-${i}`}
                    value={v.cor}
                    onChange={(e) =>
                      atualizarVariacao(i, "cor", e.target.value)
                    }
                    className={inputClasse}
                  />
                </Campo>
                <Campo label="Estoque" htmlFor={`np-var-est-${i}`}>
                  <input
                    id={`np-var-est-${i}`}
                    type="number"
                    min="0"
                    step="1"
                    value={v.estoque}
                    onChange={(e) =>
                      atualizarVariacao(i, "estoque", e.target.value)
                    }
                    className={inputClasse}
                  />
                </Campo>
                <div className="flex sm:pb-1">
                  <BotaoPerigo
                    type="button"
                    onClick={() => removerVariacao(i)}
                    aria-label={`Remover variação ${i + 1}`}
                  >
                    <Trash2 size={16} aria-hidden="true" />
                    Remover
                  </BotaoPerigo>
                </div>
              </div>
            ))}

            <BotaoSecundario type="button" onClick={adicionarVariacao}>
              <Plus size={18} aria-hidden="true" />
              Adicionar variação
            </BotaoSecundario>
          </>
        )}
      </fieldset>

      {/* ---- Imagens ---- */}
      <fieldset className="space-y-3" disabled={salvando}>
        <legend className="mb-1 text-sm font-semibold uppercase tracking-wide text-texto-suave">
          Imagens
        </legend>

        <Campo
          label="Adicionar imagens"
          htmlFor="np-imagens"
          dica="Você pode selecionar várias. Marque uma como principal."
        >
          <input
            id="np-imagens"
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => {
              if (e.target.files?.length) adicionarImagens(e.target.files);
              e.target.value = "";
            }}
            className={inputClasse + " file:mr-3 file:rounded file:border-0 file:bg-borda/60 file:px-3 file:py-1 file:text-texto"}
          />
        </Campo>

        {imagens.length > 0 && (
          <ul className="space-y-2">
            {imagens.map((img, i) => (
              <li
                key={i}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-borda bg-fundo p-2"
              >
                <span className="min-w-0 flex-1 truncate text-sm text-texto">
                  {img.arquivo.name}
                </span>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 text-sm text-texto">
                    <input
                      type="radio"
                      name="np-imagem-principal"
                      checked={img.principal}
                      onChange={() => marcarPrincipal(i)}
                      className="h-4 w-4 accent-[var(--color-acento-escuro)]"
                    />
                    <Star
                      size={14}
                      aria-hidden="true"
                      className={
                        img.principal ? "text-acento-escuro" : "text-texto-suave/50"
                      }
                    />
                    Principal
                  </label>
                  <BotaoPerigo
                    type="button"
                    onClick={() => removerImagem(i)}
                    aria-label={`Remover imagem ${img.arquivo.name}`}
                  >
                    <Trash2 size={16} aria-hidden="true" />
                  </BotaoPerigo>
                </div>
              </li>
            ))}
          </ul>
        )}
      </fieldset>

      {erro && (
        <Feedback tipo="erro">
          {erro}
          {pecaCriadaId && (
            <span className="mt-1 block text-sm">
              A peça já foi criada — corrija o item indicado e clique em
              “Tentar novamente”. Nada será duplicado.
            </span>
          )}
        </Feedback>
      )}

      {/* ---- Passo final: Salvar ---- */}
      <div className="flex flex-col gap-3 border-t border-borda pt-5 sm:flex-row sm:justify-end">
        <BotaoSecundario type="button" onClick={aoFechar} disabled={salvando}>
          Cancelar
        </BotaoSecundario>
        <BotaoPrimario type="submit" disabled={salvando || nomeDuplicado}>
          {salvando
            ? "Salvando..."
            : pecaCriadaId
              ? "Tentar novamente"
              : "Salvar"}
        </BotaoPrimario>
      </div>
    </form>
  );
}
