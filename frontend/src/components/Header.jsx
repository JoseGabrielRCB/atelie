import { Link, NavLink } from "react-router-dom";
import { useCarrinho } from "../context/CarrinhoContext";

const LINKS = [
  { para: "/", rotulo: "Início", fim: true },
  { para: "/vitrine", rotulo: "Vitrine", fim: false },
  { para: "/encomenda", rotulo: "Encomenda", fim: false },
];

function classeNav({ isActive }) {
  return (
    "text-sm font-medium transition hover:text-acento-escuro focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acento-escuro focus-visible:ring-offset-2 focus-visible:ring-offset-fundo " +
    (isActive ? "text-acento-escuro" : "text-texto")
  );
}

export default function Header() {
  const { totalItens } = useCarrinho();

  return (
    <header className="sticky top-0 z-30 border-b border-borda bg-fundo/90 backdrop-blur">
      <div className="mx-auto flex max-w-[1200px] items-center justify-between px-4 py-4">
        <Link
          to="/"
          aria-label="Atelie ++ — ir para a página inicial"
          className="inline-flex items-center rounded-lg p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acento-escuro focus-visible:ring-offset-2 focus-visible:ring-offset-fundo"
        >
          {/* Logo provido pelo dono em frontend/public/logo-atelie.png (idealmente PNG transparente). */}
          <img
            src="/logo-atelie.png"
            alt="Atelie ++"
            className="h-11 w-auto sm:h-12"
          />
        </Link>

        <div className="flex items-center gap-4 sm:gap-6">
        <nav className="hidden items-center gap-4 sm:flex sm:gap-6">
          {LINKS.map((l) => (
            <NavLink key={l.para} to={l.para} end={l.fim} className={classeNav}>
              {l.rotulo}
            </NavLink>
          ))}
        </nav>

        <Link
          to="/carrinho"
          className="relative inline-flex items-center gap-2 rounded-lg bg-acento-escuro px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-acento-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acento-escuro focus-visible:ring-offset-2 focus-visible:ring-offset-fundo"
          aria-label={`Meu pedido${totalItens > 0 ? `, ${totalItens} ${totalItens === 1 ? "item" : "itens"}` : ", vazio"}`}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M6 2 4 6v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6l-2-4z" />
            <path d="M4 6h16" />
            <path d="M16 10a4 4 0 0 1-8 0" />
          </svg>
          <span>Meu pedido</span>
          {totalItens > 0 && (
            <span className="ml-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1.5 text-xs font-bold text-acento-escuro">
              {totalItens}
            </span>
          )}
        </Link>
        </div>
      </div>
    </header>
  );
}
