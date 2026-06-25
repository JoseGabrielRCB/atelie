import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { useCarrinho } from "../context/CarrinhoContext";
import { useConta } from "../context/ContaContext";

const LINKS = [
  { para: "/", rotulo: "Início", fim: true },
  { para: "/vitrine", rotulo: "Vitrine", fim: false },
  { para: "/encomenda", rotulo: "Encomenda", fim: false },
];

// Link de navegação no desktop (texto).
function classeNav({ isActive }) {
  return (
    "text-sm font-medium transition hover:text-acento-escuro focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acento-escuro focus-visible:ring-offset-2 focus-visible:ring-offset-fundo " +
    (isActive ? "text-acento-escuro" : "text-texto")
  );
}

// Item dentro do menu mobile (bloco, área de toque maior).
function classeItemMobile({ isActive }) {
  return (
    "block rounded-lg px-3 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acento-escuro " +
    (isActive ? "bg-acento-escuro text-white" : "text-texto hover:bg-borda/50")
  );
}

// Ícone da sacola (mantém o desenho atual; sem trocar por imagem).
function IconeSacola() {
  return (
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
  );
}

export default function Header() {
  const { totalItens } = useCarrinho();
  const { logado, sair } = useConta();
  const location = useLocation();
  const [aberto, setAberto] = useState(false);
  const headerRef = useRef(null);
  const botaoRef = useRef(null);

  // Fecha o menu ao navegar (cobre cliques nos links e navegação programática).
  useEffect(() => {
    setAberto(false);
  }, [location.pathname]);

  // Fecha no Esc e ao clicar fora (acessibilidade).
  useEffect(() => {
    if (!aberto) return;
    function aoClicarFora(e) {
      if (headerRef.current && !headerRef.current.contains(e.target)) setAberto(false);
    }
    function aoTeclar(e) {
      if (e.key === "Escape") {
        setAberto(false);
        botaoRef.current?.focus();
      }
    }
    document.addEventListener("mousedown", aoClicarFora);
    document.addEventListener("keydown", aoTeclar);
    return () => {
      document.removeEventListener("mousedown", aoClicarFora);
      document.removeEventListener("keydown", aoTeclar);
    };
  }, [aberto]);

  const aviso =
    totalItens > 0 ? `, ${totalItens} ${totalItens === 1 ? "item" : "itens"}` : ", vazio";

  return (
    <header
      ref={headerRef}
      className="sticky top-0 z-30 border-b border-borda bg-fundo/90 backdrop-blur"
    >
      <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-3 px-4 py-3">
        {/* Logo */}
        <Link
          to="/"
          aria-label="Ateliê da Sete — ir para a página inicial"
          className="inline-flex shrink-0 items-center rounded-lg p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acento-escuro focus-visible:ring-offset-2 focus-visible:ring-offset-fundo"
        >
          <img
            src="/logo-atelie.png"
            alt="Ateliê da Sete — roupas e artigos religiosos"
            className="h-10 w-auto sm:h-12"
          />
        </Link>

        {/* Navegação (desktop) */}
        <nav className="hidden items-center gap-6 sm:flex">
          {LINKS.map((l) => (
            <NavLink key={l.para} to={l.para} end={l.fim} className={classeNav}>
              {l.rotulo}
            </NavLink>
          ))}
        </nav>

        {/* Ações à direita */}
        <div className="flex shrink-0 items-center gap-3 sm:gap-4">
          {/* Conta (desktop) */}
          {logado ? (
            <div className="hidden items-center gap-3 sm:flex">
              <NavLink to="/conta" className={classeNav}>
                Minha conta
              </NavLink>
              <button
                type="button"
                onClick={sair}
                className="text-sm font-medium text-texto-suave transition hover:text-acento-escuro focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acento-escuro"
              >
                Sair
              </button>
            </div>
          ) : (
            <div className="hidden items-center gap-3 sm:flex">
              <NavLink to="/conta/login" className={classeNav}>
                Entrar
              </NavLink>
              <Link
                to="/conta/cadastro"
                className="text-sm font-medium text-texto transition hover:text-acento-escuro"
              >
                Criar conta
              </Link>
            </div>
          )}

          {/* Carrinho (texto só no desktop; compacto no mobile) */}
          <Link
            to="/carrinho"
            className="relative inline-flex items-center gap-2 rounded-lg bg-acento-escuro px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-acento-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acento-escuro focus-visible:ring-offset-2 focus-visible:ring-offset-fundo sm:px-4 sm:py-2.5"
            aria-label={`Meu pedido${aviso}`}
          >
            <IconeSacola />
            <span className="hidden sm:inline">Meu pedido</span>
            {totalItens > 0 && (
              <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1.5 text-xs font-bold text-acento-escuro shadow ring-1 ring-borda sm:static sm:right-auto sm:top-auto sm:ml-0.5 sm:shadow-none sm:ring-0">
                {totalItens}
              </span>
            )}
          </Link>

          {/* Hambúrguer (mobile) */}
          <button
            ref={botaoRef}
            type="button"
            onClick={() => setAberto((a) => !a)}
            aria-expanded={aberto}
            aria-controls="menu-mobile-cliente"
            aria-label={aberto ? "Fechar menu" : "Abrir menu"}
            className="inline-flex items-center justify-center rounded-lg border border-borda bg-superficie p-2 text-texto transition hover:border-acento-escuro focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acento-escuro sm:hidden"
          >
            {aberto ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
          </button>
        </div>
      </div>

      {/* Painel mobile: navegação + conta */}
      {aberto && (
        <nav
          id="menu-mobile-cliente"
          aria-label="Navegação do site"
          className="border-t border-borda bg-fundo/95 px-4 py-3 sm:hidden"
        >
          <div className="mx-auto max-w-[1200px] space-y-1">
            {LINKS.map((l) => (
              <NavLink key={l.para} to={l.para} end={l.fim} className={classeItemMobile}>
                {l.rotulo}
              </NavLink>
            ))}

            <div className="my-2 border-t border-borda" />

            {logado ? (
              <>
                <NavLink to="/conta" className={classeItemMobile}>
                  Minha conta
                </NavLink>
                <button
                  type="button"
                  onClick={() => {
                    setAberto(false);
                    sair();
                  }}
                  className="block w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-texto-suave transition hover:bg-borda/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acento-escuro"
                >
                  Sair
                </button>
              </>
            ) : (
              <>
                <NavLink to="/conta/login" className={classeItemMobile}>
                  Entrar
                </NavLink>
                <NavLink to="/conta/cadastro" className={classeItemMobile}>
                  Criar conta
                </NavLink>
              </>
            )}
          </div>
        </nav>
      )}
    </header>
  );
}
