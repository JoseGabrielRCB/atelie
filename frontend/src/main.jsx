import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import Providers from "./Providers.jsx";
import AppRoutes from "./routes.jsx";

// Cliente: monta sobre o HTML pré-renderizado (SSG). Usamos createRoot (em vez
// de hydrateRoot) para evitar divergências de hidratação em rotas servidas pelo
// fallback do SPA — o conteúdo é re-renderizado no mesmo tick, sem flash.
createRoot(document.getElementById("root")).render(
  <StrictMode>
    <Providers>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </Providers>
  </StrictMode>
);
