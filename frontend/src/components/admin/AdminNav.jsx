import { useEffect, useRef, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { ChevronDown, Menu, X } from "lucide-react";
import { useAuth } from "../../context/AuthContext";

// Navegação agrupada do painel (5 itens de topo; 3 com submenu). A visibilidade
// segue o papel (o backend reforça as permissões; aqui é só conveniência de UI):
// - Funcionário: Resumo, Catálogo, Estoque, Pedidos (Vendas só com financeiro).
// - Dono: tudo, incluindo Configurações.
// Grupo sem itens para o papel some do menu.
function montarGrupos({ ehDono, podeFinanceiro }) {
  const grupos = [
    { id: "resumo", rotulo: "Resumo", para: "/admin", fim: true },
    {
      id: "catalogo",
      rotulo: "Catálogo",
      itens: [
        { para: "/admin/pecas", rotulo: "Peças" },
        { para: "/admin/categorias", rotulo: "Categorias" },
        { para: "/admin/cores", rotulo: "Cores" },
        { para: "/admin/destaques", rotulo: "Destaques" },
      ],
    },
    { id: "estoque", rotulo: "Estoque", para: "/admin/estoque" },
    {
      id: "pedidos",
      rotulo: "Pedidos",
      itens: [
        { para: "/admin/encomendas", rotulo: "Encomendas" },
        ...(podeFinanceiro ? [{ para: "/admin/vendas", rotulo: "Vendas" }] : []),
      ],
    },
    ...(ehDono
      ? [
          {
            id: "config",
            rotulo: "Configurações",
            itens: [
              { para: "/admin/funcionarios", rotulo: "Funcionários" },
              { para: "/admin/whatsapp", rotulo: "WhatsApp" },
            ],
          },
        ]
      : []),
  ];
  // Remove grupos de submenu que ficaram sem itens para este papel.
  return grupos.filter((g) => g.para || (g.itens && g.itens.length > 0));
}

// Rota "casa" com a do item (igualdade ou prefixo de subrota, ex.: /admin/pecas/3).
function rotaCasa(pathname, para) {
  return pathname === para || pathname.startsWith(para + "/");
}

function grupoAtivo(grupo, pathname) {
  if (grupo.para) return false; // links diretos usam o estado do próprio NavLink
  return (grupo.itens ?? []).some((i) => rotaCasa(pathname, i.para));
}

const classeTopoBase =
  "inline-flex items-center gap-1 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acento-escuro";

function classeLinkDireto({ isActive }) {
  return (
    classeTopoBase +
    " " +
    (isActive
      ? "bg-acento-escuro text-white"
      : "text-texto-suave hover:bg-borda/50 hover:text-texto")
  );
}

function classeBotaoTopo(ativo) {
  return (
    classeTopoBase +
    " " +
    (ativo
      ? "bg-acento-escuro text-white"
      : "text-texto-suave hover:bg-borda/50 hover:text-texto")
  );
}

function classeItemMenu({ isActive }) {
  return (
    "block rounded-lg px-3 py-2 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acento-escuro " +
    (isActive
      ? "bg-acento/10 font-medium text-acento-escuro"
      : "text-texto hover:bg-borda/50")
  );
}

export default function AdminNav() {
  const { ehDono, podeFinanceiro } = useAuth();
  const grupos = montarGrupos({ ehDono, podeFinanceiro });

  return (
    <>
      <NavDesktop grupos={grupos} />
      <NavMobile grupos={grupos} />
    </>
  );
}

// --------------------------------------------------------------------------
// Desktop: barra horizontal com dropdowns (hover + clique + teclado).
// --------------------------------------------------------------------------
function NavDesktop({ grupos }) {
  const [abertoId, setAbertoId] = useState(null);
  const navRef = useRef(null);
  const timerRef = useRef(null);
  const location = useLocation();

  // Fecha ao trocar de rota.
  useEffect(() => {
    setAbertoId(null);
  }, [location.pathname]);

  // Fecha ao clicar fora da navegação.
  useEffect(() => {
    function aoClicarFora(e) {
      if (navRef.current && !navRef.current.contains(e.target)) setAbertoId(null);
    }
    document.addEventListener("mousedown", aoClicarFora);
    return () => document.removeEventListener("mousedown", aoClicarFora);
  }, []);

  const limparTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };
  useEffect(() => () => limparTimer(), []);

  const abrir = (id) => {
    limparTimer();
    setAbertoId(id);
  };
  const fechar = () => {
    limparTimer();
    setAbertoId(null);
  };
  // Pequeno atraso ao tirar o mouse, p/ não fechar à toa ao mirar o submenu.
  const agendarFechar = () => {
    limparTimer();
    timerRef.current = setTimeout(() => setAbertoId(null), 150);
  };

  return (
    <nav
      ref={navRef}
      aria-label="Navegação do painel"
      className="mx-auto hidden max-w-[1200px] px-3 pb-2 md:block"
    >
      <ul className="flex flex-wrap gap-1">
        {grupos.map((g) =>
          g.para ? (
            <li key={g.id}>
              <NavLink to={g.para} end={g.fim} className={classeLinkDireto}>
                {g.rotulo}
              </NavLink>
            </li>
          ) : (
            <GrupoDesktop
              key={g.id}
              grupo={g}
              aberto={abertoId === g.id}
              aoAbrir={() => abrir(g.id)}
              aoFechar={fechar}
              aoAgendarFechar={agendarFechar}
              aoAlternar={() => setAbertoId((atual) => (atual === g.id ? null : g.id))}
            />
          )
        )}
      </ul>
    </nav>
  );
}

function GrupoDesktop({ grupo, aberto, aoAbrir, aoFechar, aoAgendarFechar, aoAlternar }) {
  const location = useLocation();
  const ativo = grupoAtivo(grupo, location.pathname);
  const btnRef = useRef(null);
  const itensRef = useRef([]);
  // Distingue foco vindo do mouse (deixa o clique decidir) do foco por teclado.
  const focoDeMouse = useRef(false);
  // Suprime a reabertura quando o Esc devolve o foco ao botão.
  const suprimirFoco = useRef(false);

  function focarItem(idx) {
    const els = itensRef.current.filter(Boolean);
    if (!els.length) return;
    const i = (idx + els.length) % els.length;
    els[i].focus();
  }

  function aoTeclarBotao(e) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      aoAbrir();
      requestAnimationFrame(() => focarItem(0));
    } else if (e.key === "Escape") {
      aoFechar();
    }
  }

  function aoTeclarMenu(e) {
    if (e.key === "Escape") {
      e.stopPropagation();
      aoFechar();
      suprimirFoco.current = true;
      btnRef.current?.focus();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      focarItem(itensRef.current.indexOf(document.activeElement) + 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      focarItem(itensRef.current.indexOf(document.activeElement) - 1);
    }
  }

  return (
    <li
      className="relative"
      onMouseEnter={aoAbrir}
      onMouseLeave={aoAgendarFechar}
      onBlur={(e) => {
        // Foco saiu do grupo inteiro (ex.: Tab além do último item) → fecha.
        if (!e.currentTarget.contains(e.relatedTarget)) aoFechar();
      }}
    >
      <button
        ref={btnRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={aberto}
        onMouseDown={() => {
          focoDeMouse.current = true;
        }}
        onFocus={() => {
          if (suprimirFoco.current) {
            suprimirFoco.current = false;
            return;
          }
          if (focoDeMouse.current) return; // clique do mouse cuida do toggle
          aoAbrir();
        }}
        onClick={() => {
          aoAlternar();
          focoDeMouse.current = false;
        }}
        onKeyDown={aoTeclarBotao}
        className={classeBotaoTopo(ativo)}
      >
        {grupo.rotulo}
        <ChevronDown
          size={16}
          aria-hidden="true"
          className={"transition-transform " + (aberto ? "rotate-180" : "")}
        />
      </button>

      {aberto && (
        <div
          role="menu"
          aria-label={grupo.rotulo}
          onKeyDown={aoTeclarMenu}
          className="absolute left-0 top-full z-40 mt-1 min-w-48 rounded-lg border border-borda bg-superficie p-1 shadow-[0_10px_30px_rgba(0,0,0,0.12)]"
        >
          {grupo.itens.map((it, idx) => (
            <NavLink
              key={it.para}
              to={it.para}
              role="menuitem"
              ref={(el) => (itensRef.current[idx] = el)}
              className={classeItemMenu}
            >
              {it.rotulo}
            </NavLink>
          ))}
        </div>
      )}
    </li>
  );
}

// --------------------------------------------------------------------------
// Mobile: botão hambúrguer + menu sanfona (sem hover).
// --------------------------------------------------------------------------
function NavMobile({ grupos }) {
  const location = useLocation();
  const [aberto, setAberto] = useState(false);
  // Grupo expandido na sanfona (começa no grupo da rota atual, se houver).
  const [expandido, setExpandido] = useState(
    () => grupos.find((g) => grupoAtivo(g, location.pathname))?.id ?? null
  );

  // Fecha o menu ao navegar.
  useEffect(() => {
    setAberto(false);
  }, [location.pathname]);

  return (
    <div className="mx-auto max-w-[1200px] px-3 pb-2 md:hidden">
      <button
        type="button"
        onClick={() => setAberto((a) => !a)}
        aria-expanded={aberto}
        aria-controls="menu-mobile-admin"
        className="inline-flex items-center gap-2 rounded-lg border border-borda bg-superficie px-3 py-2 text-sm font-medium text-texto transition hover:border-acento-escuro focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acento-escuro"
      >
        {aberto ? <X size={18} aria-hidden="true" /> : <Menu size={18} aria-hidden="true" />}
        Menu
      </button>

      {aberto && (
        <nav
          id="menu-mobile-admin"
          aria-label="Navegação do painel"
          className="mt-2 space-y-1 rounded-lg border border-borda bg-superficie p-2"
        >
          {grupos.map((g) =>
            g.para ? (
              <NavLink
                key={g.id}
                to={g.para}
                end={g.fim}
                className={({ isActive }) =>
                  "block rounded-lg px-3 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acento-escuro " +
                  (isActive
                    ? "bg-acento-escuro text-white"
                    : "text-texto hover:bg-borda/50")
                }
              >
                {g.rotulo}
              </NavLink>
            ) : (
              <div key={g.id}>
                <button
                  type="button"
                  aria-expanded={expandido === g.id}
                  onClick={() =>
                    setExpandido((atual) => (atual === g.id ? null : g.id))
                  }
                  className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium text-texto transition hover:bg-borda/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acento-escuro"
                >
                  {g.rotulo}
                  <ChevronDown
                    size={16}
                    aria-hidden="true"
                    className={"transition-transform " + (expandido === g.id ? "rotate-180" : "")}
                  />
                </button>
                {expandido === g.id && (
                  <div className="mt-1 space-y-1 pl-3">
                    {g.itens.map((it) => (
                      <NavLink
                        key={it.para}
                        to={it.para}
                        className={classeItemMenu}
                      >
                        {it.rotulo}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            )
          )}
        </nav>
      )}
    </div>
  );
}
