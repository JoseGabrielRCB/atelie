import { useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useConta } from "../../context/ContaContext";

const inputClasse =
  "w-full rounded-lg border border-borda bg-superficie px-4 py-3 text-texto placeholder:italic placeholder:text-texto-suave/70 focus:border-acento-escuro focus:outline-none focus:ring-2 focus:ring-acento-escuro/30";

export default function ContaLogin() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get("next") || "/conta";
  const { logado, carregando, entrar } = useConta();

  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  // Já logado como cliente → não faz sentido ver o login.
  if (!carregando && logado) return <Navigate to={next} replace />;

  async function aoEnviar(e) {
    e.preventDefault();
    setErro("");
    setEnviando(true);
    try {
      await entrar(email.trim(), senha);
      navigate(next, { replace: true });
    } catch (err) {
      setErro(err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section className="mx-auto max-w-md">
      <h1 className="font-display text-3xl font-semibold text-texto">Entrar</h1>
      <p className="mt-2 text-sm text-texto-suave">
        Não tem conta?{" "}
        <Link
          to={`/conta/cadastro${next ? `?next=${encodeURIComponent(next)}` : ""}`}
          className="font-medium text-acento-escuro hover:underline"
        >
          Criar conta
        </Link>
        .
      </p>

      <form onSubmit={aoEnviar} noValidate className="mt-6 space-y-4">
        {erro && (
          <p role="alert" className="rounded-lg bg-erro/10 px-4 py-3 text-sm text-erro">
            {erro}
          </p>
        )}

        <div>
          <label htmlFor="email" className="mb-1 block text-sm font-medium text-texto">
            E-mail
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
            placeholder="Ex.: maria@email.com"
            className={inputClasse}
          />
        </div>

        <div>
          <label htmlFor="senha" className="mb-1 block text-sm font-medium text-texto">
            Senha
          </label>
          <input
            id="senha"
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            autoComplete="current-password"
            required
            className={inputClasse}
          />
        </div>

        <button
          type="submit"
          disabled={enviando}
          className="w-full rounded-lg bg-acento-escuro px-6 py-3 font-medium text-white transition hover:bg-acento-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acento-escuro focus-visible:ring-offset-2 focus-visible:ring-offset-fundo disabled:cursor-not-allowed disabled:opacity-50"
        >
          {enviando ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </section>
  );
}
