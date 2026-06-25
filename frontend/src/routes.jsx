import { Routes, Route, Navigate } from "react-router-dom";
import App from "./App.jsx";
// Cliente (público)
import Home from "./pages/Home.jsx";
import Vitrine from "./pages/Vitrine.jsx";
import DetalhePeca from "./pages/DetalhePeca.jsx";
import Carrinho from "./pages/Carrinho.jsx";
import Encomenda from "./pages/Encomenda.jsx";
import PagamentoSucesso from "./pages/pagamento/Sucesso.jsx";
import PagamentoPendente from "./pages/pagamento/Pendente.jsx";
import PagamentoFalha from "./pages/pagamento/Falha.jsx";
// Admin
import AdminLayout from "./components/admin/AdminLayout.jsx";
import RotaProtegida, {
  RequerLogin,
  ExigeDono,
  ExigeFinanceiro,
} from "./components/admin/RotaProtegida.jsx";
import Login from "./pages/admin/Login.jsx";
import TrocarSenha from "./pages/admin/TrocarSenha.jsx";
import Dashboard from "./pages/admin/Dashboard.jsx";
import PecasLista from "./pages/admin/PecasLista.jsx";
import RedirecionaEdicao from "./components/admin/RedirecionaEdicao.jsx";
import Estoque from "./pages/admin/Estoque.jsx";
import Categorias from "./pages/admin/Categorias.jsx";
import Cores from "./pages/admin/Cores.jsx";
import Destaques from "./pages/admin/Destaques.jsx";
import Encomendas from "./pages/admin/Encomendas.jsx";
import Vendas from "./pages/admin/Vendas.jsx";
import Funcionarios from "./pages/admin/Funcionarios.jsx";
import Whatsapp from "./pages/admin/Whatsapp.jsx";

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
        {/* Retornos do Mercado Pago — dependem de query params (só CSR, fora do SSG). */}
        <Route path="pagamento/sucesso" element={<PagamentoSucesso />} />
        <Route path="pagamento/pendente" element={<PagamentoPendente />} />
        <Route path="pagamento/falha" element={<PagamentoFalha />} />
      </Route>

      {/* Login do admin (sem layout do painel) */}
      <Route path="/admin/login" element={<Login />} />

      {/* Troca de senha (provisória ou não): exige login, fora do layout/guarda de papel. */}
      <Route
        path="/admin/senha"
        element={
          <RequerLogin>
            <TrocarSenha />
          </RequerLogin>
        }
      />

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
        <Route path="cores" element={<Cores />} />
        <Route path="destaques" element={<Destaques />} />
        <Route path="encomendas" element={<Encomendas />} />
        {/* Vendas/financeiro: Dono ou Funcionário com acesso liberado. */}
        <Route
          path="vendas"
          element={
            <ExigeFinanceiro>
              <Vendas />
            </ExigeFinanceiro>
          }
        />
        {/* Áreas exclusivas do Dono. */}
        <Route
          path="funcionarios"
          element={
            <ExigeDono>
              <Funcionarios />
            </ExigeDono>
          }
        />
        <Route
          path="whatsapp"
          element={
            <ExigeDono>
              <Whatsapp />
            </ExigeDono>
          }
        />
      </Route>
    </Routes>
  );
}
