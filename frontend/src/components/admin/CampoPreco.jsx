import { digitarParaCentavos, formatarCentavos } from "../../lib/moeda";
import { inputClasse } from "./ui";

// Campo de preço com máscara BRL: o estado externo guarda CENTAVOS (inteiro);
// o usuário digita e vê "1.234,50"; o teto de R$ 1.000.000 é aplicado.
// Props: centavos (number), aoMudar (centavos => void), id, invalido.
export default function CampoPreco({ centavos, aoMudar, id, invalido = false, ...props }) {
  return (
    <div className="relative">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-texto-suave"
      >
        R$
      </span>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        value={formatarCentavos(centavos)}
        onChange={(e) => aoMudar(digitarParaCentavos(e.target.value))}
        className={
          inputClasse +
          " pl-9 text-right tabular-nums" +
          (invalido ? " border-erro focus:ring-erro/30" : "")
        }
        {...props}
      />
    </div>
  );
}
