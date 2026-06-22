import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

const LINKS = [
  { para: "/admin", rotulo: "Resumo", fim: true },
  { para: "/admin/pecas", rotulo: "Peças", fim: false },
  { para: "/admin/estoque", rotulo: "Estoque", fim: false },
  { para: "/admin/categorias", rotulo: "Categorias", fim: false },
  { para: "/admin/cores", rotulo: "Cores", fim: false },
  { para: "/admin/destaques", rotulo: "Destaques", fim: false },
  { para: "/admin/encomendas", rotulo: "Encomendas", fim: false },
  { para: "/admin/vendas", rotulo: "Vendas", fim: false },
];

function classeLink({ isActive }) {
  return (
    "whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acento-escuro " +
    (isActive
      ? "bg-acento-escuro text-white"
      : "text-texto-suave hover:bg-borda/50 hover:text-texto")
  );
}

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
              alt="Atelie ++"
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
        <nav className="mx-auto flex max-w-[1200px] gap-1 overflow-x-auto px-3 pb-2">
          {LINKS.map((l) => (
            <NavLink key={l.para} to={l.para} end={l.fim} className={classeLink}>
              {l.rotulo}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-[1200px] px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
