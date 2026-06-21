import { StrictMode } from "react";
import { renderToString } from "react-dom/server";
import { StaticRouter } from "react-router";
import Providers from "./Providers.jsx";
import AppRoutes from "./routes.jsx";

// Reexporta o que o prerender.js precisa (rodando sobre o bundle SSR).
export {
  ROTAS_SSG,
  getMeta,
  buildHead,
  jsonLdLocalBusiness,
  jsonLdFaqPage,
} from "./seo/meta.js";
export { SITE } from "./config/site.js";

// Renderiza a aplicação para HTML estático na URL informada (build-time SSG).
export function render(url) {
  return renderToString(
    <StrictMode>
      <Providers>
        <StaticRouter location={url}>
          <AppRoutes />
        </StaticRouter>
      </Providers>
    </StrictMode>
  );
}
