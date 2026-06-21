import { Link, Outlet } from "react-router-dom";
import Header from "./components/Header";
import { SITE } from "./config/site";
import { linkWhatsappTexto, whatsappConfigurado } from "./lib/whatsapp";

export default function App() {
  return (
    <div className="min-h-screen bg-fundo text-texto">
      <Header />
      <main className="mx-auto max-w-[1200px] px-4 py-6 sm:py-8">
        <Outlet />
      </main>
      {/* Rodapé com NAP (Nome, local, contato) para SEO local. */}
      <footer className="mt-8 border-t border-borda">
        <div className="mx-auto grid max-w-[1200px] gap-6 px-4 py-10 text-sm text-texto-suave sm:grid-cols-3">
          <div>
            <p className="font-display text-lg font-semibold text-texto">
              {SITE.nome}
            </p>
            <p className="mt-1">{SITE.tagline}</p>
            <p className="mt-1">Atendimento: {SITE.cidade} e por encomenda</p>
          </div>
          <div>
            <p className="font-medium text-texto">Contato</p>
            {whatsappConfigurado ? (
              <a
                href={linkWhatsappTexto("Olá! Vim pelo site do Ateliê ++.")}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 block transition hover:text-acento-escuro"
              >
                WhatsApp
              </a>
            ) : (
              <p className="mt-1">WhatsApp: {SITE.whatsapp || "[NÚMERO]"}</p>
            )}
            <p className="mt-1">Instagram: {SITE.instagram}</p>
          </div>
          <nav className="flex flex-col gap-1">
            <p className="font-medium text-texto">Navegação</p>
            <Link to="/" className="transition hover:text-acento-escuro">
              Início
            </Link>
            <Link to="/vitrine" className="transition hover:text-acento-escuro">
              Vitrine
            </Link>
            <Link to="/encomenda" className="transition hover:text-acento-escuro">
              Encomenda
            </Link>
          </nav>
        </div>
        <p className="px-4 pb-8 text-center text-xs text-texto-suave">
          © {new Date().getFullYear()} {SITE.nome} · {SITE.cidade}
        </p>
      </footer>
    </div>
  );
}
