import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

// Protege as rotas /admin/*: sem autenticação, redireciona para o login,
// guardando a rota de origem para voltar depois.
export default function RotaProtegida({ children }) {
  const { autenticado } = useAuth();
  const location = useLocation();

  if (!autenticado) {
    return <Navigate to="/admin/login" replace state={{ de: location.pathname }} />;
  }
  return children;
}
