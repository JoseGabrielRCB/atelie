import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { tokens, login as apiLogin, obterMe } from "../lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [autenticado, setAutenticado] = useState(() => Boolean(tokens.access));
  // Identidade do backend (/me/): { usuario, nome, papel, ativo, senha_provisoria, acesso_financeiro }.
  const [me, setMe] = useState(null);
  // Enquanto busca o /me/ no 1º carregamento (com token), evita "piscar" a tela.
  const [carregandoMe, setCarregandoMe] = useState(() => Boolean(tokens.access));
  // Sinaliza quando a sessão expirou (refresh falhou) para mostrar aviso no login.
  const [expirou, setExpirou] = useState(false);

  // Carrega (ou recarrega) a identidade do usuário logado.
  const carregarMe = useCallback(async () => {
    if (!tokens.access) {
      setMe(null);
      setAutenticado(false);
      setCarregandoMe(false);
      return null;
    }
    setCarregandoMe(true);
    try {
      const dados = await obterMe();
      setMe(dados);
      setAutenticado(true);
      return dados;
    } catch {
      // 401/refresh falho já dispara "auth:expirou" na camada de API.
      setMe(null);
      setAutenticado(false);
      return null;
    } finally {
      setCarregandoMe(false);
    }
  }, []);

  useEffect(() => {
    carregarMe();
  }, [carregarMe]);

  // A camada de API dispara "auth:expirou" quando o refresh falha.
  useEffect(() => {
    function aoExpirar() {
      setAutenticado(false);
      setMe(null);
      setExpirou(true);
    }
    window.addEventListener("auth:expirou", aoExpirar);
    return () => window.removeEventListener("auth:expirou", aoExpirar);
  }, []);

  const entrar = useCallback(
    async (username, password) => {
      await apiLogin(username, password);
      setExpirou(false);
      return carregarMe();
    },
    [carregarMe]
  );

  const sair = useCallback(() => {
    tokens.limpar();
    setMe(null);
    setAutenticado(false);
  }, []);

  // Derivados de papel (o backend é a fonte da verdade; isto é só conveniência de UI).
  const papel = me?.papel ?? null;
  const ehDono = papel === "dono";
  const podeFinanceiro = ehDono || Boolean(me?.acesso_financeiro);
  const senhaProvisoria = Boolean(me?.senha_provisoria);
  const usuario = me?.nome || me?.usuario || "";

  return (
    <AuthContext.Provider
      value={{
        autenticado,
        carregandoMe,
        expirou,
        me,
        usuario,
        papel,
        ehDono,
        podeFinanceiro,
        senhaProvisoria,
        entrar,
        sair,
        recarregarMe: carregarMe,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de <AuthProvider>.");
  return ctx;
}
