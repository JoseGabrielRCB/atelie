import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { tokens, login as apiLogin } from "../lib/api";

const AuthContext = createContext(null);
const CHAVE_USER = "atelie_admin_user";

export function AuthProvider({ children }) {
  const [autenticado, setAutenticado] = useState(() => Boolean(tokens.access));
  const [usuario, setUsuario] = useState(
    () => localStorage.getItem(CHAVE_USER) || ""
  );
  // Sinaliza quando a sessão expirou (refresh falhou) para mostrar aviso no login.
  const [expirou, setExpirou] = useState(false);

  // A camada de API dispara "auth:expirou" quando o refresh falha.
  useEffect(() => {
    function aoExpirar() {
      setAutenticado(false);
      setExpirou(true);
    }
    window.addEventListener("auth:expirou", aoExpirar);
    return () => window.removeEventListener("auth:expirou", aoExpirar);
  }, []);

  const entrar = useCallback(async (username, password) => {
    await apiLogin(username, password);
    localStorage.setItem(CHAVE_USER, username);
    setUsuario(username);
    setExpirou(false);
    setAutenticado(true);
  }, []);

  const sair = useCallback(() => {
    tokens.limpar();
    localStorage.removeItem(CHAVE_USER);
    setUsuario("");
    setAutenticado(false);
  }, []);

  return (
    <AuthContext.Provider value={{ autenticado, usuario, expirou, entrar, sair }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de <AuthProvider>.");
  return ctx;
}
