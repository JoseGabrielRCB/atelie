import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { useConta } from "../../context/ContaContext";
import { contaAtualizar, contaTrocarSenha } from "../../lib/api";
import { mascararTelefone, telefoneValido, soDigitosTelefone } from "../../lib/telefone";

const inputClasse =
  "w-full rounded-lg border border-borda bg-superficie px-4 py-3 text-texto placeholder:italic placeholder:text-texto-suave/70 focus:border-acento-escuro focus:outline-none focus:ring-2 focus:ring-acento-escuro/30";

const inputTravado = inputClasse + " bg-borda/20 text-texto-suave";

export default function MinhaConta() {
  const { cliente, recarregar } = useConta();
  const [dados, setDados] = useState({
    nome: cliente?.nome ?? "",
    telefone: cliente?.telefone ? mascararTelefone(cliente.telefone) : "",
  });
  const [erros, setErros] = useState({});
  const [ok, setOk] = useState("");

  const salvarMut = useMutation({
    mutationFn: () =>
      contaAtualizar({ nome: dados.nome.trim(), telefone: soDigitosTelefone(dados.telefone) }),
    onSuccess: async () => {
      await recarregar();
      setOk("Dados atualizados.");
    },
    onError: (e) => setErros({ geral: e.message }),
  });

  function salvar(e) {
    e.preventDefault();
    setOk("");
    const novos = {};
    if (!dados.nome.trim()) novos.nome = "Informe o seu nome.";
    if (dados.telefone && !telefoneValido(dados.telefone))
      novos.telefone = "Informe um telefone com DDD.";
    if (Object.keys(novos).length) {
      setErros(novos);
      return;
    }
    setErros({});
    salvarMut.mutate();
  }

  return (
    <section className="mx-auto max-w-xl space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-semibold text-texto">Minha conta</h1>
        <Link
          to="/conta/pedidos"
          className="text-sm font-medium text-acento-escuro hover:underline"
        >
          Meus pedidos →
        </Link>
      </div>

      {/* Dados da conta */}
      <form onSubmit={salvar} noValidate className="space-y-4 rounded-lg border border-borda bg-superficie p-5">
        <h2 className="font-display text-xl font-semibold text-texto">Seus dados</h2>

        {erros.geral && (
          <p role="alert" className="rounded-lg bg-erro/10 px-4 py-3 text-sm text-erro">
            {erros.geral}
          </p>
        )}
        {ok && (
          <p role="status" className="rounded-lg bg-sucesso/10 px-4 py-3 text-sm text-sucesso">
            {ok}
          </p>
        )}

        <div>
          <label htmlFor="nome" className="mb-1 block text-sm font-medium text-texto">Nome</label>
          <input
            id="nome"
            value={dados.nome}
            onChange={(e) =>
              setDados((d) => ({ ...d, nome: e.target.value.replace(/[0-9]/g, "") }))
            }
            maxLength={120}
            className={inputClasse}
          />
          {erros.nome && <p className="mt-1 text-sm text-erro">{erros.nome}</p>}
        </div>

        <div>
          <label htmlFor="telefone" className="mb-1 block text-sm font-medium text-texto">Telefone</label>
          <input
            id="telefone"
            type="tel"
            inputMode="tel"
            value={dados.telefone}
            onChange={(e) => setDados((d) => ({ ...d, telefone: mascararTelefone(e.target.value) }))}
            placeholder="Ex.: (67) 99999-9999"
            className={inputClasse}
          />
          {erros.telefone && <p className="mt-1 text-sm text-erro">{erros.telefone}</p>}
        </div>

        {/* E-mail e CPF são somente-leitura (mudança via suporte). */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-texto">E-mail</label>
            <input value={cliente?.email ?? ""} readOnly disabled className={inputTravado} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-texto">CPF</label>
            <input value={cliente?.cpf ?? ""} readOnly disabled className={inputTravado} />
          </div>
        </div>
        <p className="text-xs text-texto-suave">
          Para alterar e-mail ou CPF, fale com o ateliê.
        </p>

        <button
          type="submit"
          disabled={salvarMut.isPending}
          className="rounded-lg bg-acento-escuro px-6 py-3 font-medium text-white transition hover:bg-acento-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acento-escuro focus-visible:ring-offset-2 focus-visible:ring-offset-fundo disabled:cursor-not-allowed disabled:opacity-50"
        >
          {salvarMut.isPending ? "Salvando…" : "Salvar dados"}
        </button>
      </form>

      <TrocarSenhaConta />
    </section>
  );
}

function TrocarSenhaConta() {
  const [form, setForm] = useState({ senha_atual: "", nova_senha: "", confirmar: "" });
  const [erros, setErros] = useState({});
  const [ok, setOk] = useState("");

  const mut = useMutation({
    mutationFn: () => contaTrocarSenha(form.senha_atual, form.nova_senha),
    onSuccess: () => {
      setOk("Senha atualizada.");
      setForm({ senha_atual: "", nova_senha: "", confirmar: "" });
    },
    onError: (e) => setErros({ geral: e.message }),
  });

  function enviar(e) {
    e.preventDefault();
    setOk("");
    const novos = {};
    if (!form.senha_atual) novos.senha_atual = "Informe a senha atual.";
    if (form.nova_senha.length < 8) novos.nova_senha = "A nova senha deve ter ao menos 8 caracteres.";
    if (form.confirmar !== form.nova_senha) novos.confirmar = "A confirmação não corresponde.";
    if (Object.keys(novos).length) {
      setErros(novos);
      return;
    }
    setErros({});
    mut.mutate();
  }

  const set = (campo) => (e) => setForm((f) => ({ ...f, [campo]: e.target.value }));

  return (
    <form onSubmit={enviar} noValidate className="space-y-4 rounded-lg border border-borda bg-superficie p-5">
      <h2 className="font-display text-xl font-semibold text-texto">Trocar senha</h2>

      {erros.geral && (
        <p role="alert" className="rounded-lg bg-erro/10 px-4 py-3 text-sm text-erro">{erros.geral}</p>
      )}
      {ok && (
        <p role="status" className="rounded-lg bg-sucesso/10 px-4 py-3 text-sm text-sucesso">{ok}</p>
      )}

      <div>
        <label htmlFor="senha-atual" className="mb-1 block text-sm font-medium text-texto">Senha atual</label>
        <input id="senha-atual" type="password" autoComplete="current-password" value={form.senha_atual} onChange={set("senha_atual")} className={inputClasse} />
        {erros.senha_atual && <p className="mt-1 text-sm text-erro">{erros.senha_atual}</p>}
      </div>
      <div>
        <label htmlFor="nova-senha" className="mb-1 block text-sm font-medium text-texto">Nova senha</label>
        <input id="nova-senha" type="password" autoComplete="new-password" value={form.nova_senha} onChange={set("nova_senha")} placeholder="Mínimo de 8 caracteres" className={inputClasse} />
        {erros.nova_senha && <p className="mt-1 text-sm text-erro">{erros.nova_senha}</p>}
      </div>
      <div>
        <label htmlFor="confirmar-senha" className="mb-1 block text-sm font-medium text-texto">Confirmar nova senha</label>
        <input id="confirmar-senha" type="password" autoComplete="new-password" value={form.confirmar} onChange={set("confirmar")} className={inputClasse} />
        {erros.confirmar && <p className="mt-1 text-sm text-erro">{erros.confirmar}</p>}
      </div>

      <button
        type="submit"
        disabled={mut.isPending}
        className="rounded-lg border border-borda px-6 py-3 font-medium text-texto transition hover:border-acento-escuro focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acento-escuro disabled:opacity-50"
      >
        {mut.isPending ? "Salvando…" : "Trocar senha"}
      </button>
    </form>
  );
}
