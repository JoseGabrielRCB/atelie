import { useQuery } from "@tanstack/react-query";
import { obterPeca } from "../../lib/api";
import { hexValido } from "../../lib/cores";
import { Carregando, Erro } from "../Estado";
import Preco from "../Preco";
import { Selo } from "./ui";

// Visualização SOMENTE LEITURA de uma peça (sem inputs). Acionada pelo ícone de
// "olho"; a edição fica no ícone de lápis (modal separado).
export default function DetalhePecaModal({ pecaId }) {
  const pecaQ = useQuery({
    queryKey: ["admin", "peca", String(pecaId)],
    queryFn: () => obterPeca(pecaId, { auth: true }),
    enabled: Boolean(pecaId),
  });

  if (pecaQ.isLoading) return <Carregando texto="Carregando peça..." />;
  if (pecaQ.isError)
    return <Erro mensagem={pecaQ.error.message} aoTentarNovamente={pecaQ.refetch} />;
  if (!pecaQ.data) return null;

  const p = pecaQ.data;
  const variacoes = p.variacoes ?? [];
  const imagens = p.imagens ?? [];

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-display text-2xl font-semibold text-texto">{p.nome}</p>
          <p className="mt-1 text-sm text-texto-suave">
            {p.categoria_nome} · {p.tipo === "sob_medida" ? "Sob medida" : "Pronta"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {p.ativo ? <Selo cor="verde">Ativa</Selo> : <Selo cor="cinza">Oculta</Selo>}
          {p.destaque && <Selo cor="acento">Em destaque</Selo>}
        </div>
      </div>

      <p className="font-display text-xl font-semibold text-texto">
        <Preco valor={p.preco} />
      </p>

      {p.descricao && (
        <div>
          <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-texto-suave">
            Descrição
          </h3>
          <p className="whitespace-pre-line text-sm text-texto">{p.descricao}</p>
        </div>
      )}

      {/* Imagens */}
      {imagens.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-texto-suave">
            Imagens
          </h3>
          <div className="flex flex-wrap gap-2">
            {imagens.map((img) => (
              <div key={img.id} className="relative">
                <img
                  src={img.arquivo}
                  alt={p.nome}
                  className="h-24 w-24 rounded-lg border border-borda object-cover"
                  loading="lazy"
                />
                {img.principal && (
                  <span className="absolute left-1 top-1 rounded bg-acento-escuro px-1.5 py-0.5 text-[10px] font-medium text-white">
                    Principal
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Variações */}
      <div>
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-texto-suave">
          Variações
        </h3>
        {variacoes.length === 0 ? (
          <p className="text-sm text-texto-suave">Nenhuma variação cadastrada.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-borda">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-borda text-texto-suave">
                <tr>
                  <th className="px-4 py-2 font-medium">Tamanho</th>
                  <th className="px-4 py-2 font-medium">Cor</th>
                  <th className="px-4 py-2 font-medium">Estoque</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-borda">
                {variacoes.map((v) => (
                  <tr key={v.id}>
                    <td className="px-4 py-2 text-texto">{v.tamanho || "—"}</td>
                    <td className="px-4 py-2 text-texto">
                      <span className="inline-flex items-center gap-2">
                        {hexValido(v.cor_hex) && (
                          <span
                            aria-hidden="true"
                            className="inline-block h-4 w-4 shrink-0 rounded border border-borda"
                            style={{ backgroundColor: v.cor_hex }}
                          />
                        )}
                        {v.cor || "—"}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <span className="tabular-nums text-texto">{v.estoque}</span>
                      {v.esgotado && (
                        <span className="ml-2">
                          <Selo cor="vermelho">Esgotado</Selo>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
