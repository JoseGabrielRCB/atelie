import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { ArrowLeft, Minus, Plus } from "lucide-react";
import { criarEncomenda } from "../lib/api";
import { linkWhatsappEncomenda, whatsappConfigurado } from "../lib/whatsapp";
import { mascararTelefone as formatarTelefone, soDigitosTelefone as digitos } from "../lib/telefone";
import { useSeo } from "../seo/useSeo";
import { getMeta } from "../seo/meta";

// Limites espelham a validação do backend (POST público /api/encomendas/).
const MAX_IMAGENS = 5;
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const TIPOS_OK = ["image/jpeg", "image/png", "image/webp"];

// Limites de texto (espelham o backend): nome 80, descrição 600.
const MAX_NOME = 80;
const MAX_DESCRICAO = 600;

// Medidas em cm: faixa sã para o stepper +/−.
const MEDIDA_MIN = 20;
const MEDIDA_MAX = 250;

// Opções de tamanho (chips de seleção única) + opção "Outro" (texto livre).
const TAMANHOS = ["P", "M", "G", "GG", "Único"];

const inputClasse =
  "w-full rounded-lg border border-borda bg-superficie px-4 py-3 text-texto placeholder:italic placeholder:text-texto-suave/70 focus:border-acento-escuro focus:outline-none focus:ring-2 focus:ring-acento-escuro/30";

const formInicial = {
  nome: "",
  contato: "",
  descricao: "",
  prazo_desejado: "",
};

// Blocos de medidas numéricas (opcionais, em cm). Compostos em `tamanho_medidas`
// junto com o tamanho ao enviar (o backend guarda tudo em um só campo).
const CAMPOS_MEDIDAS = [
  { chave: "busto", etiqueta: "Busto" },
  { chave: "cintura", etiqueta: "Cintura" },
  { chave: "quadril", etiqueta: "Quadril" },
  { chave: "comprimento", etiqueta: "Comprimento" },
];
const medidasInicial = Object.fromEntries(CAMPOS_MEDIDAS.map((c) => [c.chave, ""]));

// Capitaliza cada palavra (exibe/armazena o nome com iniciais maiúsculas).
function capitalizarPalavras(texto) {
  return texto
    .toLocaleLowerCase("pt-BR")
    .replace(/(^|\s|['’-])([\p{L}])/gu, (_, sep, letra) => sep + letra.toLocaleUpperCase("pt-BR"));
}

// Compõe o texto único `tamanho_medidas` a partir do tamanho + medidas em cm.
function comporMedidas({ tamanho, tamanhoOutro, medidas }) {
  const partes = [];
  const tam = tamanho === "Outro" ? tamanhoOutro.trim() : tamanho;
  if (tam) partes.push(`Tamanho: ${tam}`);
  for (const campo of CAMPOS_MEDIDAS) {
    const v = medidas[campo.chave].trim();
    if (v) partes.push(`${campo.etiqueta}: ${v} cm`);
  }
  return partes.join("; ");
}

// Data de hoje e teto (~1 ano à frente) em YYYY-MM-DD para o campo de prazo.
const hojeISO = new Date().toLocaleDateString("en-CA");
const umAnoISO = (() => {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return d.toLocaleDateString("en-CA");
})();

export default function Encomenda() {
  useSeo(getMeta("/encomenda"));
  const [form, setForm] = useState(formInicial);
  const [tamanho, setTamanho] = useState(""); // "" | "P".."Único" | "Outro"
  const [tamanhoOutro, setTamanhoOutro] = useState("");
  const [medidas, setMedidas] = useState(medidasInicial);
  const [imagens, setImagens] = useState([]); // [{ arquivo, url }]
  const [erros, setErros] = useState({}); // { campo: "mensagem" }
  const [enviada, setEnviada] = useState(false);

  // Revoga as URLs de pré-visualização ao desmontar (sem revogar as ativas).
  const imagensRef = useRef(imagens);
  useEffect(() => {
    imagensRef.current = imagens;
  }, [imagens]);
  useEffect(
    () => () => imagensRef.current.forEach((i) => URL.revokeObjectURL(i.url)),
    []
  );

  const limparErro = (campo) =>
    setErros((e) => {
      if (!(campo in e)) return e;
      const resto = { ...e };
      delete resto[campo];
      return resto;
    });

  const atualizar = (campo, valor) => {
    setForm((f) => ({ ...f, [campo]: valor }));
    limparErro(campo);
  };

  // Stepper das medidas (clamp em [MIN, MAX]; vazio é permitido = opcional).
  const ajustarMedida = (chave, delta) =>
    setMedidas((m) => {
      const atual = parseInt(m[chave], 10);
      const base = Number.isNaN(atual) ? (delta > 0 ? MEDIDA_MIN - delta : MEDIDA_MIN) : atual;
      const proximo = Math.min(MEDIDA_MAX, Math.max(MEDIDA_MIN, base + delta));
      return { ...m, [chave]: String(proximo) };
    });

  const digitarMedida = (chave, valor) => {
    const so = valor.replace(/\D/g, "").slice(0, 3);
    setMedidas((m) => ({ ...m, [chave]: so }));
  };

  const escolherTamanho = (opcao) => {
    setTamanho((atual) => (atual === opcao ? "" : opcao));
    if (opcao !== "Outro") setTamanhoOutro("");
  };

  function adicionarImagens(lista) {
    limparErro("imagens");
    let problema = "";
    const novos = [];
    for (const arquivo of Array.from(lista)) {
      if (!TIPOS_OK.includes(arquivo.type)) {
        problema = "Use imagens JPG, PNG ou WEBP.";
        continue;
      }
      if (arquivo.size > MAX_BYTES) {
        problema = "Cada imagem deve ter no máximo 5 MB.";
        continue;
      }
      novos.push({ arquivo, url: URL.createObjectURL(arquivo) });
    }
    setImagens((atuais) => {
      const combinado = [...atuais, ...novos];
      if (combinado.length > MAX_IMAGENS) {
        problema = `Envie no máximo ${MAX_IMAGENS} imagens.`;
        combinado.slice(MAX_IMAGENS).forEach((i) => URL.revokeObjectURL(i.url));
        return combinado.slice(0, MAX_IMAGENS);
      }
      return combinado;
    });
    if (problema) setErros((e) => ({ ...e, imagens: problema }));
  }

  function removerImagem(indice) {
    setImagens((atuais) => {
      const alvo = atuais[indice];
      if (alvo) URL.revokeObjectURL(alvo.url);
      return atuais.filter((_, i) => i !== indice);
    });
  }

  const enviarMut = useMutation({
    mutationFn: () =>
      criarEncomenda({
        ...form,
        tamanho_medidas: comporMedidas({ tamanho, tamanhoOutro, medidas }),
        imagens: imagens.map((i) => i.arquivo),
      }),
    onSuccess: () => setEnviada(true),
    // Erro do backend (mapeado por campo quando possível, senão geral).
    onError: (e) => setErros((atual) => ({ ...atual, geral: e.message })),
  });

  function aoEnviar(e) {
    e.preventDefault();
    // Valida TUDO de uma vez (não a conta-gotas) e mostra todos os problemas.
    const novos = {};
    if (!form.nome.trim()) novos.nome = "Informe o seu nome.";
    const tel = digitos(form.contato);
    if (!tel) novos.contato = "Informe um contato (telefone/WhatsApp).";
    else if (tel.length < 10)
      novos.contato = "Informe um telefone completo com DDD.";
    if (!form.descricao.trim())
      novos.descricao = "Descreva a peça que deseja encomendar.";
    if (tamanho === "Outro" && !tamanhoOutro.trim())
      novos.tamanho = "Informe o tamanho ou deixe a opção em branco.";
    if (form.prazo_desejado && form.prazo_desejado < hojeISO)
      novos.prazo_desejado = "O prazo desejado não pode ser uma data passada.";
    if (form.prazo_desejado && form.prazo_desejado > umAnoISO)
      novos.prazo_desejado = "Escolha um prazo de até um ano à frente.";

    if (Object.keys(novos).length) {
      setErros(novos);
      return;
    }
    setErros({});
    enviarMut.mutate();
  }

  function novaEncomenda() {
    imagens.forEach((i) => URL.revokeObjectURL(i.url));
    setImagens([]);
    setForm(formInicial);
    setTamanho("");
    setTamanhoOutro("");
    setMedidas(medidasInicial);
    setErros({});
    setEnviada(false);
  }

  // ---- Tela de confirmação ----
  if (enviada) {
    return (
      <section className="mx-auto max-w-xl text-center">
        <div className="rounded-lg border border-borda bg-superficie p-8">
          <h1 className="font-display text-3xl font-semibold text-sucesso">
            Encomenda enviada!
          </h1>
          <p className="mt-3 text-texto-suave">
            Em breve o ateliê entra em contato pelo seu contato informado.
          </p>

          {whatsappConfigurado && (
            <a
              href={linkWhatsappEncomenda(form.nome, form.descricao)}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 inline-flex items-center justify-center gap-2 rounded-lg bg-sucesso px-6 py-3 font-medium text-white transition hover:opacity-90"
            >
              Avisar o ateliê no WhatsApp
            </a>
          )}

          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            <button
              type="button"
              onClick={novaEncomenda}
              className="rounded-lg border border-borda px-6 py-3 text-texto transition hover:border-acento-escuro focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acento-escuro"
            >
              Enviar outra encomenda
            </button>
            <Link
              to="/vitrine"
              className="rounded-lg bg-acento-escuro px-6 py-3 font-medium text-white transition hover:bg-acento-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acento-escuro focus-visible:ring-offset-2 focus-visible:ring-offset-fundo"
            >
              Voltar à vitrine
            </Link>
          </div>
        </div>
      </section>
    );
  }

  const enviando = enviarMut.isPending;
  const erroDe = (campo) => erros[campo];
  // Resumo no topo: lista todos os campos com problema de uma vez.
  const totalErros = Object.keys(erros).filter((k) => k !== "geral").length;

  return (
    <section className="mx-auto max-w-xl">
      {/* Voltar à vitrine: canto superior esquerdo, destacado (desktop e mobile). */}
      <Link
        to="/vitrine"
        className="mb-5 inline-flex items-center gap-1.5 rounded-lg border border-borda bg-superficie px-3 py-2 text-sm font-medium text-acento-escuro transition hover:border-acento-escuro hover:bg-acento/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acento-escuro focus-visible:ring-offset-2 focus-visible:ring-offset-fundo"
      >
        <ArrowLeft size={16} aria-hidden="true" />
        Voltar à vitrine
      </Link>

      <h1 className="font-display text-3xl font-semibold text-texto sm:text-4xl">
        Encomenda sob medida
      </h1>
      <p className="mt-2 text-texto-suave">
        Não achou o que procurava? Conte o que você quer e anexe fotos de
        referência. O ateliê analisa e entra em contato.
      </p>

      <form onSubmit={aoEnviar} noValidate className="mt-6 space-y-5">
        {(totalErros > 0 || erros.geral) && (
          <div role="alert" className="rounded-lg bg-erro/10 px-4 py-3 text-sm text-erro">
            {erros.geral ? (
              erros.geral
            ) : (
              <>
                Há {totalErros}{" "}
                {totalErros === 1 ? "campo com problema" : "campos com problemas"}.
                Confira as mensagens abaixo.
              </>
            )}
          </div>
        )}

        <fieldset className="space-y-5" disabled={enviando}>
          <div>
            <label htmlFor="enc-nome" className="mb-1 block text-sm font-medium text-texto">
              Nome
            </label>
            <input
              id="enc-nome"
              value={form.nome}
              onChange={(e) => atualizar("nome", capitalizarPalavras(e.target.value))}
              maxLength={MAX_NOME}
              placeholder="Ex.: Maria Silva"
              aria-invalid={Boolean(erroDe("nome"))}
              className={inputClasse}
            />
            {erroDe("nome") && (
              <p className="mt-1 text-sm text-erro">{erroDe("nome")}</p>
            )}
          </div>

          <div>
            <label htmlFor="enc-contato" className="mb-1 block text-sm font-medium text-texto">
              Contato (telefone/WhatsApp)
            </label>
            <input
              id="enc-contato"
              type="tel"
              inputMode="tel"
              value={form.contato}
              onChange={(e) => atualizar("contato", formatarTelefone(e.target.value))}
              placeholder="(67) 99999-9999"
              aria-invalid={Boolean(erroDe("contato"))}
              className={inputClasse}
            />
            {erroDe("contato") && (
              <p className="mt-1 text-sm text-erro">{erroDe("contato")}</p>
            )}
          </div>

          <div>
            <div className="mb-1 flex items-baseline justify-between">
              <label htmlFor="enc-descricao" className="block text-sm font-medium text-texto">
                O que você quer encomendar?
              </label>
              <span className="text-xs text-texto-suave">
                {form.descricao.length}/{MAX_DESCRICAO}
              </span>
            </div>
            <textarea
              id="enc-descricao"
              value={form.descricao}
              onChange={(e) => atualizar("descricao", e.target.value)}
              maxLength={MAX_DESCRICAO}
              rows={4}
              placeholder="Ex.: vestido de festa azul, godê, com manga..."
              aria-invalid={Boolean(erroDe("descricao"))}
              className={inputClasse}
            />
            {erroDe("descricao") && (
              <p className="mt-1 text-sm text-erro">{erroDe("descricao")}</p>
            )}
          </div>

          {/* Tamanho: chips de seleção única + "Outro" (texto livre). */}
          <fieldset>
            <legend className="mb-1 block text-sm font-medium text-texto">
              Tamanho <span className="text-texto-suave">(opcional)</span>
            </legend>
            <div className="flex flex-wrap gap-2">
              {TAMANHOS.map((opcao) => {
                const ativo = tamanho === opcao;
                return (
                  <button
                    key={opcao}
                    type="button"
                    onClick={() => escolherTamanho(opcao)}
                    aria-pressed={ativo}
                    className={
                      "min-w-12 rounded-lg border px-4 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acento-escuro focus-visible:ring-offset-2 focus-visible:ring-offset-fundo " +
                      (ativo
                        ? "border-acento-escuro bg-acento-escuro text-white"
                        : "border-borda bg-superficie text-texto hover:border-acento-escuro")
                    }
                  >
                    {opcao}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => escolherTamanho("Outro")}
                aria-pressed={tamanho === "Outro"}
                className={
                  "rounded-lg border px-4 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acento-escuro focus-visible:ring-offset-2 focus-visible:ring-offset-fundo " +
                  (tamanho === "Outro"
                    ? "border-acento-escuro bg-acento-escuro text-white"
                    : "border-borda bg-superficie text-texto hover:border-acento-escuro")
                }
              >
                + Outro
              </button>
            </div>
            {tamanho === "Outro" && (
              <input
                value={tamanhoOutro}
                onChange={(e) => {
                  setTamanhoOutro(e.target.value);
                  limparErro("tamanho");
                }}
                maxLength={40}
                placeholder="Ex.: 38, 42, sob medida..."
                aria-label="Outro tamanho"
                aria-invalid={Boolean(erroDe("tamanho"))}
                className={inputClasse + " mt-2"}
              />
            )}
            {erroDe("tamanho") && (
              <p className="mt-1 text-sm text-erro">{erroDe("tamanho")}</p>
            )}
          </fieldset>

          {/* Medidas em cm (opcionais): numéricas com sufixo fixo + stepper. */}
          <fieldset>
            <legend className="mb-1 block text-sm font-medium text-texto">
              Medidas <span className="text-texto-suave">(opcional, em cm)</span>
            </legend>
            <p className="mb-2 text-xs text-texto-suave">
              Preencha o que souber. Pode deixar em branco o que não tiver.
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {CAMPOS_MEDIDAS.map((campo) => (
                <div key={campo.chave}>
                  <label
                    htmlFor={`enc-${campo.chave}`}
                    className="mb-1 block text-xs font-medium text-texto-suave"
                  >
                    {campo.etiqueta}
                  </label>
                  <div className="flex items-stretch gap-1">
                    <button
                      type="button"
                      onClick={() => ajustarMedida(campo.chave, -1)}
                      aria-label={`Diminuir ${campo.etiqueta}`}
                      className="inline-flex w-10 items-center justify-center rounded-lg border border-borda bg-superficie text-texto transition hover:border-acento-escuro focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acento-escuro"
                    >
                      <Minus size={16} aria-hidden="true" />
                    </button>
                    <div className="relative flex-1">
                      <input
                        id={`enc-${campo.chave}`}
                        type="text"
                        inputMode="numeric"
                        value={medidas[campo.chave]}
                        onChange={(e) => digitarMedida(campo.chave, e.target.value)}
                        placeholder="-"
                        className={inputClasse + " pr-9 text-center"}
                      />
                      <span
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-texto-suave"
                      >
                        cm
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => ajustarMedida(campo.chave, 1)}
                      aria-label={`Aumentar ${campo.etiqueta}`}
                      className="inline-flex w-10 items-center justify-center rounded-lg border border-borda bg-superficie text-texto transition hover:border-acento-escuro focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acento-escuro"
                    >
                      <Plus size={16} aria-hidden="true" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </fieldset>

          <div>
            <label htmlFor="enc-prazo" className="mb-1 block text-sm font-medium text-texto">
              Prazo desejado <span className="text-texto-suave">(opcional)</span>
            </label>
            <input
              id="enc-prazo"
              type="date"
              min={hojeISO}
              max={umAnoISO}
              value={form.prazo_desejado}
              onChange={(e) => atualizar("prazo_desejado", e.target.value)}
              aria-invalid={Boolean(erroDe("prazo_desejado"))}
              className={inputClasse}
            />
            {erroDe("prazo_desejado") && (
              <p className="mt-1 text-sm text-erro">{erroDe("prazo_desejado")}</p>
            )}
          </div>

          {/* Imagens de referência */}
          <div>
            <label htmlFor="enc-imagens" className="mb-1 block text-sm font-medium text-texto">
              Imagens de exemplo <span className="text-texto-suave">(até {MAX_IMAGENS}, 5 MB cada)</span>
            </label>
            <input
              id="enc-imagens"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              disabled={imagens.length >= MAX_IMAGENS}
              onChange={(e) => {
                if (e.target.files?.length) adicionarImagens(e.target.files);
                e.target.value = "";
              }}
              className={
                inputClasse +
                " file:mr-3 file:rounded file:border-0 file:bg-borda/60 file:px-3 file:py-1 file:text-texto"
              }
            />
            {erroDe("imagens") && (
              <p className="mt-1 text-sm text-erro">{erroDe("imagens")}</p>
            )}

            {imagens.length > 0 && (
              <ul className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-4">
                {imagens.map((img, i) => (
                  <li key={img.url} className="relative">
                    <img
                      src={img.url}
                      alt={`Referência ${i + 1}`}
                      className="aspect-square w-full rounded-lg border border-borda object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removerImagem(i)}
                      aria-label={`Remover imagem ${i + 1}`}
                      className="absolute right-1 top-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-sm text-white transition hover:bg-black/80"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </fieldset>

        <button
          type="submit"
          disabled={enviando}
          className="w-full rounded-lg bg-acento-escuro px-6 py-3 font-medium text-white transition hover:bg-acento-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acento-escuro focus-visible:ring-offset-2 focus-visible:ring-offset-fundo disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
        >
          {enviando ? "Enviando..." : "Enviar encomenda"}
        </button>
      </form>
    </section>
  );
}
