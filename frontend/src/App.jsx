import { Outlet } from "react-router-dom";
import Header from "./components/Header";

export default function App() {
  return (
    <div className="min-h-screen bg-fundo text-texto">
      <Header />
      <main className="mx-auto max-w-[1200px] px-4 py-6 sm:py-8">
        <Outlet />
      </main>
      <footer className="mx-auto max-w-[1200px] px-4 py-10 text-center text-sm text-texto-suave">
        Feito com carinho · Pedidos pelo WhatsApp
      </footer>
    </div>
  );
}
