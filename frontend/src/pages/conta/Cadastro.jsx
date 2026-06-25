import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { useConta } from "../../context/ContaContext";
import { mascararCpf, cpfValido, soDigitosCpf } from "../../lib/cpf";
import { mascararTelefone, telefoneValido, soDigitosTelefone } from "../../lib/telefone";

const inputClasse =
  "w-full rounded-lg border border-borda bg-superficie px-4 py-3 text-texto placeholder:italic placeholder:text-texto-suave/70 focus:border-acento-escuro focus:outline-none focus:ring-2 focus:ring-acento-escuro/30";

const emailValido = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

// Nome não aceita dígitos (filtra enquanto digita).
const semNumeros = (v) => v.replace(/[0-9]/g, "");

export default function Cadastro() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get("next") || "/conta";
  const { cadastrar, entrar } = useConta();

  const [form, setForm] = useState({
    nome: "",
    email: "",
    cpf: "",
    telefone: "",
    senha: "",
    confirmar: "",
  });
  const [erros, setErros] = useState({});

  const mut = useMutation({
    mutationFn: async () => {
      await cadastrar({
        nome: form.nome.trim(),
        email: form.email.trim(),
        cpf: soDigitosCpf(form.cpf),
        telefone: soDigitosTelefone(form.telefone),
        senha: form.senha,
      });
      // Entra automaticamente após criar a conta.
      await entrar(form.email.trim(), form.senha);
    },
    onSuccess: () => navigate(next, { replace: true }),
    onError: (e) => mapearErroBackend(e.message, setErros),
  });

  const set = (campo, transform) => (e) => {
    const valor = transform ? transform(e.target.value) : e.target.value;
    setForm((f) => ({ ...f, [campo]: valor }));
  };

  function enviar(e) {
    e.preventDefault();
    const novos = {};
    if (!form.nome.trim()) novos.nome = "Informe o seu nome.";
    if (!emailValido(form.email)) novos.email = "Informe um e-mail válido.";
    if (!cpfValido(form.cpf)) novos.cpf = "Informe um CPF válido.";
    if (form.telefone && !telefoneValido(form.telefone))
      novos.telefone = "Informe um telefone com DDD.";
    if (form.senha.length < 8) novos.senha = "A senha deve ter ao menos 8 caracteres.";
    if (form.confirmar !== form.senha)
      novos.confirmar = "A confirmação não corresponde à senha.";
    if (Object.keys(novos).length) {
      setErros(novos);
      return;
    }
    setErros({});
    mut.mutate();
  }

  const totalErros = Object.keys(erros).filter((k) => k !== "geral").length;

  // Validação do CPF em tempo real (indica inválido/válido enquanto digita).
  const cpfDigitos = soDigitosCpf(form.cpf);
  const cpfErroLive = cpfDigitos.length === 11 && !cpfValido(cpfDigitos) ? "CPF inválido." : "";
  const cpfOk = cpfDigitos.length === 11 && cpfValido(cpfDigitos);

  return (
    <section className="mx-auto max-w-md">
      <h1 className="font-display text-3xl font-semibold text-texto">Criar conta</h1>
      <p className="mt-2 text-sm text-texto-suave">
        Já tem conta?{" "}
        <Link
          to={`/conta/login${next ? `?next=${encodeURIComponent(next)}` : ""}`}
          className="font-medium text-acento-escuro hover:underline"
        >
          Entrar
        </Link>
        .
      </p>

      <form onSubmit={enviar} noValidate className="mt-6 space-y-4">
        {(totalErros > 0 || erros.geral) && (
          <p role="alert" className="rounded-lg bg-erro/10 px-4 py-3 text-sm text-erro">
            {erros.geral ||
              `Há ${totalErros} ${totalErros === 1 ? "campo com problema" : "campos com problemas"}. Confira abaixo.`}
          </p>
        )}

        <Campo id="nome" rotulo="Nome completo" erro={erros.nome}>
          <input
            id="nome"
            value={form.nome}
            onChange={set("nome", semNumeros)}
            maxLength={120}
            autoComplete="name"
            placeholder="Ex.: Maria Silva"
            className={inputClasse}
          />
        </Campo>

        <Campo id="email" rotulo="E-mail" erro={erros.email}>
          <input
            id="email"
            type="email"
            value={form.email}
            onChange={set("email")}
            autoComplete="email"
            placeholder="Ex.: maria@email.com"
            className={inputClasse}
          />
        </Campo>

        <div>
          <label htmlFor="cpf" className="mb-1 block text-sm font-medium text-texto">
            CPF
          </label>
          <input
            id="cpf"
            inputMode="numeric"
            value={form.cpf}
            onChange={set("cpf", mascararCpf)}
            aria-invalid={Boolean(erros.cpf || cpfErroLive)}
            placeholder="Ex.: 000.000.000-00"
            className={inputClasse}
          />
          {/* Validação em tempo real: erro do submit > erro ao vivo > "válido". */}
          {erros.cpf || cpfErroLive ? (
            <p className="mt-1 text-sm text-erro">{erros.cpf || cpfErroLive}</p>
          ) : cpfOk ? (
            <p className="mt-1 text-sm text-sucesso">CPF válido.</p>
          ) : null}
        </div>

        <Campo id="telefone" rotulo="Telefone (opcional)" erro={erros.telefone}>
          <input
            id="telefone"
            type="tel"
            inputMode="tel"
            value={form.telefone}
            onChange={set("telefone", mascararTelefone)}
            placeholder="Ex.: (67) 99999-9999"
            className={inputClasse}
          />
        </Campo>

        <Campo id="senha" rotulo="Senha" erro={erros.senha}>
          <input
            id="senha"
            type="password"
            value={form.senha}
            onChange={set("senha")}
            autoComplete="new-password"
            placeholder="Mínimo de 8 caracteres"
            className={inputClasse}
          />
        </Campo>

        <Campo id="confirmar" rotulo="Confirmar senha" erro={erros.confirmar}>
          <input
            id="confirmar"
            type="password"
            value={form.confirmar}
            onChange={set("confirmar")}
            autoComplete="new-password"
            className={inputClasse}
          />
        </Campo>

        <button
          type="submit"
          disabled={mut.isPending}
          className="w-full rounded-lg bg-acento-escuro px-6 py-3 font-medium text-white transition hover:bg-acento-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acento-escuro focus-visible:ring-offset-2 focus-visible:ring-offset-fundo disabled:cursor-not-allowed disabled:opacity-50"
        >
          {mut.isPending ? "Criando conta…" : "Criar conta"}
        </button>
      </form>
    </section>
  );
}

// Mapeia o erro PT-BR do backend ao campo correspondente (ou "geral").
function mapearErroBackend(msg, setErros) {
  const texto = msg || "Não foi possível criar a conta. Tente novamente.";
  const novos = {};
  if (/e-?mail/i.test(texto)) novos.email = texto;
  else if (/cpf/i.test(texto)) novos.cpf = texto;
  else if (/senha/i.test(texto)) novos.senha = texto;
  else novos.geral = texto;
  setErros(novos);
}

function Campo({ id, rotulo, erro, children }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-texto">
        {rotulo}
      </label>
      {children}
      {erro && <p className="mt-1 text-sm text-erro">{erro}</p>}
    </div>
  );
}
