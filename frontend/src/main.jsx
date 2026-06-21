import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "./index.css";
import App from "./App.jsx";
import { CarrinhoProvider } from "./context/CarrinhoContext.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
// Cliente (público)
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

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60, // 1 min
    },
  },
});

const router = createBrowserRouter([
  // Área do cliente (layout com header/carrinho)
  {
    path: "/",
    element: <App />,
    children: [
      { index: true, element: <Vitrine /> },
      { path: "peca/:id", element: <DetalhePeca /> },
      { path: "carrinho", element: <Carrinho /> },
      { path: "encomenda", element: <Encomenda /> },
    ],
  },
  // Login do admin (sem layout do painel)
  { path: "/admin/login", element: <Login /> },
  // Painel do admin (protegido, layout próprio)
  {
    path: "/admin",
    element: (
      <RotaProtegida>
        <AdminLayout />
      </RotaProtegida>
    ),
    children: [
      { index: true, element: <Dashboard /> },
      { path: "pecas", element: <PecasLista /> },
      { path: "pecas/nova", element: <Navigate to="/admin/pecas?nova=1" replace /> },
      { path: "pecas/:id", element: <RedirecionaEdicao /> },
      { path: "estoque", element: <Estoque /> },
      { path: "categorias", element: <Categorias /> },
      { path: "encomendas", element: <Encomendas /> },
    ],
  },
]);

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <CarrinhoProvider>
          <RouterProvider router={router} />
        </CarrinhoProvider>
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>
);
