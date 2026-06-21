import { useCategorias } from "../hooks/useCategorias";

export default function Filtro({ busca, onBusca, categoria, onCategoria }) {
  const { data: categorias = [] } = useCategorias();

  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
      <input
        type="search"
        value={busca}
        onChange={(e) => onBusca(e.target.value)}
        placeholder="Buscar por nome..."
        className="w-full flex-1 rounded-lg border border-borda bg-superficie px-4 py-2.5 text-texto placeholder:text-texto-suave focus:border-acento-escuro focus:outline-none focus:ring-2 focus:ring-acento-escuro/30"
      />

      <select
        value={categoria}
        onChange={(e) => onCategoria(e.target.value)}
        className="w-full rounded-lg border border-borda bg-superficie px-4 py-2.5 text-texto focus:border-acento-escuro focus:outline-none focus:ring-2 focus:ring-acento-escuro/30 sm:w-56"
      >
        <option value="">Todas as categorias</option>
        {categorias.map((c) => (
          <option key={c.id} value={c.id}>
            {c.nome}
          </option>
        ))}
      </select>
    </div>
  );
}
