import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "./context/AuthContext.jsx";
import { CarrinhoProvider } from "./context/CarrinhoContext.jsx";

// Provedores globais (Query + Auth + Carrinho). Usado no cliente e no SSR.
export default function Providers({ children }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 1,
            refetchOnWindowFocus: false,
            staleTime: 1000 * 60, // 1 min
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <CarrinhoProvider>{children}</CarrinhoProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
