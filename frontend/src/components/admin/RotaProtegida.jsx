import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { Carregando } from "../Estado";

// Exige apenas login (e a identidade /me/ carregada). Sem checagem de papel nem
// de senha provisória — usado pela própria tela de troca de senha provisória,
// para não criar laço de redirecionamento.
export function RequerLogin({ children }) {
  const { autenticado, carregandoMe } = useAuth();
  const location = useLocation();

  if (carregandoMe) return <Carregando texto="Carregando painel…" />;
  if (!autenticado) {
    return <Navigate to="/admin/login" replace state={{ de: location.pathname }} />;
  }
  return children;
}

// Protege as rotas /admin/*: exige login e, se a senha for provisória, força a
// troca antes de usar o painel. O backend reforça as permissões de qualquer forma.
export default function RotaProtegida({ children }) {
  const { senhaProvisoria } = useAuth();
  const location = useLocation();

  return (
    <RequerLogin>
      {senhaProvisoria && location.pathname !== "/admin/senha" ? (
        <Navigate to="/admin/senha" replace />
      ) : (
        children
      )}
    </RequerLogin>
  );
}

// Só Dono (Funcionários e Configurações). Acesso direto por URL volta ao Resumo.
export function ExigeDono({ children }) {
  const { ehDono } = useAuth();
  if (!ehDono) return <Navigate to="/admin" replace />;
  return children;
}

// Vendas/financeiro: Dono ou Funcionário com acesso liberado.
export function ExigeFinanceiro({ children }) {
  const { podeFinanceiro } = useAuth();
  if (!podeFinanceiro) return <Navigate to="/admin" replace />;
  return children;
}
