import { Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import AdminNav from "./AdminNav";

export default function AdminLayout() {
  const { usuario, sair } = useAuth();
  const navigate = useNavigate();

  function aoSair() {
    sair();
    navigate("/admin/login", { replace: true });
  }

  return (
    <div className="min-h-screen bg-fundo text-texto">
      <header className="sticky top-0 z-30 border-b border-borda bg-fundo/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-2">
            {/* Logo provido pelo dono em frontend/public/logo-atelie.png. */}
            <img
              src="/logo-atelie.png"
              alt="Ateliê da Sete"
              className="h-7 w-auto sm:h-8"
            />
            <span className="rounded bg-borda/60 px-2 py-0.5 text-xs font-medium text-texto-suave">
              Painel
            </span>
          </div>
          <div className="flex items-center gap-3">
            {usuario && (
              <span className="hidden text-sm text-texto-suave sm:inline">
                Olá, {usuario}
              </span>
            )}
            <button
              onClick={aoSair}
              className="rounded-lg border border-borda bg-superficie px-3 py-1.5 text-sm text-texto transition hover:border-acento-escuro focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acento-escuro"
            >
              Sair
            </button>
          </div>
        </div>
        <AdminNav />
      </header>

      <main className="mx-auto max-w-[1200px] px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
