import { Routes, Route, Navigate } from "react-router-dom";
import App from "./App.jsx";
// Cliente (público)
import Home from "./pages/Home.jsx";
import Vitrine from "./pages/Vitrine.jsx";
import DetalhePeca from "./pages/DetalhePeca.jsx";
import Carrinho from "./pages/Carrinho.jsx";
import Encomenda from "./pages/Encomenda.jsx";
// Admin
import AdminLayout from "./components/admin/AdminLayout.jsx";
import RotaProtegida from "./components/admin/RotaProtegida.jsx";
import Login from "./pages/admin/Login.jsx";
import Dashboard from "./pages/admin/Dashboard.jsx";
import PecasLista from "./pages/admin/PecasLista.jsx";
import RedirecionaEdicao from "./components/admin/RedirecionaEdicao.jsx";
import Estoque from "./pages/admin/Estoque.jsx";
import Categorias from "./pages/admin/Categorias.jsx";
import Encomendas from "./pages/admin/Encomendas.jsx";

// Árvore de rotas compartilhada (cliente: BrowserRouter; SSG: StaticRouter).
export default function AppRoutes() {
  return (
    <Routes>
      {/* Área do cliente (layout com header/carrinho/footer) */}
      <Route path="/" element={<App />}>
        <Route index element={<Home />} />
        <Route path="vitrine" element={<Vitrine />} />
        <Route path="peca/:id" element={<DetalhePeca />} />
        <Route path="carrinho" element={<Carrinho />} />
        <Route path="encomenda" element={<Encomenda />} />
      </Route>

      {/* Login do admin (sem layout do painel) */}
      <Route path="/admin/login" element={<Login />} />

      {/* Painel do admin (protegido, layout próprio) */}
      <Route
        path="/admin"
        element={
          <RotaProtegida>
            <AdminLayout />
          </RotaProtegida>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="pecas" element={<PecasLista />} />
        <Route path="pecas/nova" element={<Navigate to="/admin/pecas?nova=1" replace />} />
        <Route path="pecas/:id" element={<RedirecionaEdicao />} />
        <Route path="estoque" element={<Estoque />} />
        <Route path="categorias" element={<Categorias />} />
        <Route path="encomendas" element={<Encomendas />} />
      </Route>
    </Routes>
  );
}
