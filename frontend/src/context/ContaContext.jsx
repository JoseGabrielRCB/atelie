import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { Navigate, useLocation } from "react-router-dom";
import {
  tokensCliente,
  contaLogin,
  contaCadastro,
  contaMe,
  logoutCliente,
} from "../lib/api";
import { Carregando } from "../components/Estado";

// Sessão do CLIENTE da loja — SEPARADA do admin (`AuthContext`). Usa o cofre de
// tokens `tokensCliente` e o endpoint `/api/conta/me/`.
const ContaContext = createContext(null);

export function ContaProvider({ children }) {
  const [logado, setLogado] = useState(() => Boolean(tokensCliente.access));
  const [cliente, setCliente] = useState(null);
  const [carregando, setCarregando] = useState(() => Boolean(tokensCliente.access));

  const carregar = useCallback(async () => {
    if (!tokensCliente.access) {
      setCliente(null);
      setLogado(false);
      setCarregando(false);
      return null;
    }
    setCarregando(true);
    try {
      const dados = await contaMe();
      setCliente(dados);
      setLogado(true);
      return dados;
    } catch {
      setCliente(null);
      setLogado(false);
      return null;
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  // Sessão do cliente expirou (refresh falhou) → desloga.
  useEffect(() => {
    function aoExpirar() {
      setLogado(false);
      setCliente(null);
    }
    window.addEventListener("auth:expirou:cliente", aoExpirar);
    return () => window.removeEventListener("auth:expirou:cliente", aoExpirar);
  }, []);

  const entrar = useCallback(
    async (email, senha) => {
      await contaLogin(email, senha);
      return carregar();
    },
    [carregar]
  );

  const cadastrar = useCallback((dados) => contaCadastro(dados), []);

  const sair = useCallback(() => {
    logoutCliente(); // revoga o refresh no servidor (blacklist) + limpa o storage
    setCliente(null);
    setLogado(false);
  }, []);

  return (
    <ContaContext.Provider
      value={{ logado, cliente, carregando, entrar, cadastrar, sair, recarregar: carregar }}
    >
      {children}
    </ContaContext.Provider>
  );
}

export function useConta() {
  const ctx = useContext(ContaContext);
  if (!ctx) throw new Error("useConta deve ser usado dentro de <ContaProvider>.");
  return ctx;
}

// Guarda de rota do cliente: exige login; senão leva ao login guardando o destino.
export function RotaCliente({ children }) {
  const { logado, carregando } = useConta();
  const location = useLocation();
  if (carregando) return <Carregando texto="Carregando…" />;
  if (!logado) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/conta/login?next=${next}`} replace />;
  }
  return children;
}
