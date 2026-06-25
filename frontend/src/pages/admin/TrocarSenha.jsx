import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { KeyRound } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { mudarSenha } from "../../lib/api";
import { BotaoPrimario, Campo, Feedback, inputClasse } from "../../components/admin/ui";

// Tela de troca de senha. Quando a senha é provisória, o usuário é trazido aqui
// (RotaProtegida) e só sai depois de definir uma nova.
export default function TrocarSenha() {
  const navigate = useNavigate();
  const { usuario, senhaProvisoria, sair, recarregarMe } = useAuth();
  const [form, setForm] = useState({ senha_atual: "", nova_senha: "", confirmar: "" });
  const [erros, setErros] = useState({});

  const mut = useMutation({
    mutationFn: () => mudarSenha(form.senha_atual, form.nova_senha),
    onSuccess: async () => {
      await recarregarMe();
      navigate("/admin", { replace: true });
    },
    onError: (e) => setErros({ geral: e.message }),
  });

  const definir = (campo) => (e) => {
    setForm((f) => ({ ...f, [campo]: e.target.value }));
  };

  function enviar(e) {
    e.preventDefault();
    const novos = {};
    if (!form.senha_atual) novos.senha_atual = "Informe a senha atual.";
    if (!form.nova_senha) novos.nova_senha = "Informe a nova senha.";
    else if (form.nova_senha.length < 8)
      novos.nova_senha = "A nova senha deve ter ao menos 8 caracteres.";
    if (form.confirmar !== form.nova_senha)
      novos.confirmar = "A confirmação não corresponde à nova senha.";
    if (Object.keys(novos).length) {
      setErros(novos);
      return;
    }
    setErros({});
    mut.mutate();
  }

  const totalErros = Object.keys(erros).filter((k) => k !== "geral").length;

  return (
    <div className="flex min-h-screen items-center justify-center bg-fundo px-4 py-10">
      <div className="w-full max-w-md rounded-lg border border-borda bg-superficie p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <KeyRound size={22} aria-hidden="true" className="text-acento-escuro" />
          <h1 className="font-display text-2xl font-semibold text-texto">
            {senhaProvisoria ? "Defina sua nova senha" : "Trocar senha"}
          </h1>
        </div>
        <p className="mb-5 text-sm text-texto-suave">
          {senhaProvisoria
            ? `Olá, ${usuario}! Sua senha é provisória. Defina uma nova senha para continuar.`
            : "Escolha uma nova senha para a sua conta."}
        </p>

        <form onSubmit={enviar} noValidate className="space-y-4">
          {(totalErros > 0 || erros.geral) && (
            <Feedback tipo="erro">
              {erros.geral ||
                `Há ${totalErros} ${totalErros === 1 ? "campo com problema" : "campos com problemas"}. Confira abaixo.`}
            </Feedback>
          )}

          <Campo label="Senha atual" htmlFor="senha-atual">
            <input
              id="senha-atual"
              type="password"
              autoComplete="current-password"
              value={form.senha_atual}
              onChange={definir("senha_atual")}
              className={inputClasse}
            />
            {erros.senha_atual && <p className="mt-1 text-sm text-erro">{erros.senha_atual}</p>}
          </Campo>

          <Campo label="Nova senha" htmlFor="nova-senha">
            <input
              id="nova-senha"
              type="password"
              autoComplete="new-password"
              value={form.nova_senha}
              onChange={definir("nova_senha")}
              className={inputClasse}
            />
            {erros.nova_senha && <p className="mt-1 text-sm text-erro">{erros.nova_senha}</p>}
          </Campo>

          <Campo label="Confirmar nova senha" htmlFor="confirmar">
            <input
              id="confirmar"
              type="password"
              autoComplete="new-password"
              value={form.confirmar}
              onChange={definir("confirmar")}
              className={inputClasse}
            />
            {erros.confirmar && <p className="mt-1 text-sm text-erro">{erros.confirmar}</p>}
          </Campo>

          <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:justify-between">
            <button
              type="button"
              onClick={() => {
                sair();
                navigate("/admin/login", { replace: true });
              }}
              className="text-sm text-texto-suave underline-offset-2 hover:underline"
            >
              Sair
            </button>
            <BotaoPrimario type="submit" disabled={mut.isPending}>
              {mut.isPending ? "Salvando…" : "Salvar nova senha"}
            </BotaoPrimario>
          </div>
        </form>
      </div>
    </div>
  );
}
