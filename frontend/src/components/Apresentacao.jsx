// Bloco de boas-vindas no topo da vitrine: foto de apresentação + texto curto.
// Imagem provida pelo dono em frontend/public/apresentacao-atelie.jpg.
// Mobile-first: empilha (imagem acima, texto abaixo); a partir de sm fica lado a lado.
export default function Apresentacao() {
  return (
    <section className="mb-10 overflow-hidden rounded-lg border border-borda bg-superficie">
      <div className="grid gap-0 sm:grid-cols-2">
        <img
          src="/apresentacao-atelie.jpg"
          alt="Atelie ++ — costura sob medida"
          loading="lazy"
          className="aspect-[4/3] w-full object-cover sm:aspect-auto sm:h-full"
        />
        <div className="flex flex-col justify-center gap-3 p-6 sm:p-8">
          <h1 className="font-display text-3xl font-semibold text-texto sm:text-4xl">
            Atelie ++
          </h1>
          <p className="text-sm font-medium uppercase tracking-wide text-acento">
            Costura sob medida
          </p>
          <p className="text-base leading-relaxed text-texto-suave">
            Peças feitas com cuidado e atenção aos detalhes. Explore a vitrine,
            monte sua seleção e finalize o pedido pelo WhatsApp.
          </p>
        </div>
      </div>
    </section>
  );
}
