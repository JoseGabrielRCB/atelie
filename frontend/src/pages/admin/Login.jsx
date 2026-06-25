import { useState } from "react";
import { useLocation, useNavigate, Navigate, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { BotaoPrimario, Campo, Feedback, inputClasse } from "../../components/admin/ui";

export default function Login() {
  const { autenticado, entrar, expirou } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const destino = location.state?.de || "/admin";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  // Já autenticado: não faz sentido ver o login.
  if (autenticado) return <Navigate to={destino} replace />;

  async function aoEnviar(e) {
    e.preventDefault();
    setErro("");
    setEnviando(true);
    try {
      await entrar(username.trim(), password);
      navigate(destino, { replace: true });
    } catch (err) {
      setErro(err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-fundo px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="font-display text-3xl font-semibold text-texto">Ateliê da Sete</h1>
          <p className="mt-1 text-sm text-texto-suave">Painel de administração</p>
        </div>

        <form
          onSubmit={aoEnviar}
          className="space-y-4 rounded-lg border border-borda bg-superficie p-6 shadow-sm"
        >
          {expirou && !erro && (
            <Feedback tipo="erro">Sua sessão expirou. Entre novamente.</Feedback>
          )}

          <Campo label="Usuário" htmlFor="username">
            <input
              id="username"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className={inputClasse}
            />
          </Campo>

          <Campo label="Senha" htmlFor="password">
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className={inputClasse}
            />
          </Campo>

          {erro && <Feedback tipo="erro">{erro}</Feedback>}

          <BotaoPrimario type="submit" disabled={enviando} className="w-full">
            {enviando ? "Entrando..." : "Entrar"}
          </BotaoPrimario>
        </form>

        <p className="mt-4 text-center text-sm text-texto-suave">
          <Link to="/" className="hover:text-acento-escuro">
            ← Voltar à loja
          </Link>
        </p>
      </div>
    </div>
  );
}
