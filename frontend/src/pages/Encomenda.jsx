import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { criarEncomenda } from "../lib/api";
import { linkWhatsappEncomenda, whatsappConfigurado } from "../lib/whatsapp";

// Limites espelham a validação do backend (POST público /api/encomendas/).
const MAX_IMAGENS = 5;
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const TIPOS_OK = ["image/jpeg", "image/png", "image/webp"];

const inputClasse =
  "w-full rounded-lg border border-borda bg-superficie px-4 py-3 text-texto placeholder:text-texto-suave focus:border-acento-escuro focus:outline-none focus:ring-2 focus:ring-acento-escuro/30";

const formInicial = {
  nome: "",
  contato: "",
  descricao: "",
  prazo_desejado: "",
};

// Blocos de tamanho/medidas (todos opcionais). São compostos em um único texto
// (`tamanho_medidas`) ao enviar, pois o backend guarda em um só campo.
const CAMPOS_MEDIDAS = [
  { chave: "tamanho", rotulo: "Tamanho", etiqueta: "Tamanho", placeholder: "P, M, G ou 38" },
  { chave: "busto", rotulo: "Busto (cm)", etiqueta: "Busto", placeholder: "90" },
  { chave: "cintura", rotulo: "Cintura (cm)", etiqueta: "Cintura", placeholder: "70" },
  { chave: "quadril", rotulo: "Quadril (cm)", etiqueta: "Quadril", placeholder: "95" },
  { chave: "comprimento", rotulo: "Comprimento (cm)", etiqueta: "Comprimento", placeholder: "120" },
];
const medidasInicial = Object.fromEntries(CAMPOS_MEDIDAS.map((c) => [c.chave, ""]));

function comporMedidas(medidas) {
  return CAMPOS_MEDIDAS.filter((c) => medidas[c.chave].trim())
    .map((c) => `${c.etiqueta}: ${medidas[c.chave].trim()}`)
    .join("; ");
}

// Data de hoje em YYYY-MM-DD (para bloquear datas passadas no campo de prazo).
const hojeISO = new Date().toLocaleDateString("en-CA");

export default function Encomenda() {
  const [form, setForm] = useState(formInicial);
  const [medidas, setMedidas] = useState(medidasInicial);
  const [imagens, setImagens] = useState([]); // [{ arquivo, url }]
  const [erro, setErro] = useState("");
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

  const atualizar = (campo, valor) =>
    setForm((f) => ({ ...f, [campo]: valor }));

  const atualizarMedida = (chave, valor) =>
    setMedidas((m) => ({ ...m, [chave]: valor }));

  function adicionarImagens(lista) {
    setErro("");
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
    if (problema) setErro(problema);
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
        tamanho_medidas: comporMedidas(medidas),
        imagens: imagens.map((i) => i.arquivo),
      }),
    onSuccess: () => setEnviada(true),
    onError: (e) => setErro(e.message),
  });

  function aoEnviar(e) {
    e.preventDefault();
    setErro("");
    if (!form.nome.trim()) return setErro("Informe o seu nome.");
    if (!form.contato.trim())
      return setErro("Informe um contato (telefone/WhatsApp).");
    if (!form.descricao.trim())
      return setErro("Descreva a peça que deseja encomendar.");
    if (form.prazo_desejado && form.prazo_desejado < hojeISO)
      return setErro("O prazo desejado não pode ser uma data passada.");
    enviarMut.mutate();
  }

  function novaEncomenda() {
    imagens.forEach((i) => URL.revokeObjectURL(i.url));
    setImagens([]);
    setForm(formInicial);
    setMedidas(medidasInicial);
    setErro("");
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
              to="/"
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

  return (
    <section className="mx-auto max-w-xl">
      <Link
        to="/"
        className="mb-4 inline-block text-sm text-texto-suave transition hover:text-acento-escuro"
      >
        ← Voltar à vitrine
      </Link>

      <h1 className="font-display text-3xl font-semibold text-texto sm:text-4xl">
        Encomenda sob medida
      </h1>
      <p className="mt-2 text-texto-suave">
        Não achou o que procurava? Conte o que você quer e anexe fotos de
        referência — o ateliê analisa e entra em contato.
      </p>

      <form onSubmit={aoEnviar} className="mt-6 space-y-5">
        <fieldset className="space-y-5" disabled={enviando}>
          <div>
            <label htmlFor="enc-nome" className="mb-1 block text-sm font-medium text-texto">
              Nome
            </label>
            <input
              id="enc-nome"
              value={form.nome}
              onChange={(e) => atualizar("nome", e.target.value)}
              required
              className={inputClasse}
            />
          </div>

          <div>
            <label htmlFor="enc-contato" className="mb-1 block text-sm font-medium text-texto">
              Contato (telefone/WhatsApp)
            </label>
            <input
              id="enc-contato"
              value={form.contato}
              onChange={(e) => atualizar("contato", e.target.value)}
              required
              placeholder="(81) 99999-0000"
              className={inputClasse}
            />
          </div>

          <div>
            <label htmlFor="enc-descricao" className="mb-1 block text-sm font-medium text-texto">
              O que você quer encomendar?
            </label>
            <textarea
              id="enc-descricao"
              value={form.descricao}
              onChange={(e) => atualizar("descricao", e.target.value)}
              required
              rows={4}
              placeholder="Ex.: vestido de festa azul, godê, com manga..."
              className={inputClasse}
            />
          </div>

          <fieldset>
            <legend className="mb-1 block text-sm font-medium text-texto">
              Tamanho ou medidas <span className="text-texto-suave">(opcional)</span>
            </legend>
            <p className="mb-2 text-xs text-texto-suave">
              Preencha o que souber — pode deixar em branco os que não tiver.
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {CAMPOS_MEDIDAS.map((campo) => (
                <div key={campo.chave}>
                  <label
                    htmlFor={`enc-${campo.chave}`}
                    className="mb-1 block text-xs font-medium text-texto-suave"
                  >
                    {campo.rotulo}
                  </label>
                  <input
                    id={`enc-${campo.chave}`}
                    value={medidas[campo.chave]}
                    onChange={(e) => atualizarMedida(campo.chave, e.target.value)}
                    placeholder={campo.placeholder}
                    className={inputClasse}
                  />
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
              value={form.prazo_desejado}
              onChange={(e) => atualizar("prazo_desejado", e.target.value)}
              className={inputClasse}
            />
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

        {erro && (
          <p role="alert" className="rounded-lg bg-erro/10 px-4 py-3 text-sm text-erro">
            {erro}
          </p>
        )}

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
