import { Navigate, useParams } from "react-router-dom";

// /admin/pecas/:id agora abre o modal de edição na própria lista.
// Mantém deep links e o "ver detalhes" das Categorias funcionando.
export default function RedirecionaEdicao() {
  const { id } = useParams();
  return <Navigate to={`/admin/pecas?editar=${id}`} replace />;
}
