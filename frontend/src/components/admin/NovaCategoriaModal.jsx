import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { criarCategoria } from "../../lib/api";
import Modal from "./Modal";
import { BotaoPrimario, BotaoSecundario, Campo, Feedback } from "./ui";

// Largura fixa padronizada para os campos de nome de categoria.
const campoCategoriaClasse =
  "w-56 rounded-lg border border-borda bg-superficie px-3 py-2 text-texto placeholder:text-texto-suave focus:border-acento-escuro focus:outline-none focus:ring-2 focus:ring-acento-escuro/30";

// Modal para criar uma nova categoria sem tirar o admin da página.
// Ao criar com sucesso: invalida ["categorias"], limpa e fecha.
export default function NovaCategoriaModal({ aberto, aoFechar }) {
  const qc = useQueryClient();
  const [nome, setNome] = useState("");
  const [erro, setErro] = useState("");

  const criarMut = useMutation({
    mutationFn: criarCategoria,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["categorias"] });
      fechar();
    },
    onError: (e) => setErro(e.message),
  });

  function fechar() {
    setNome("");
    setErro("");
    aoFechar();
  }

  function enviar(e) {
    e.preventDefault();
    setErro("");
    const limpo = nome.trim();
    if (!limpo) {
      setErro("Informe um nome para a categoria.");
      return;
    }
    criarMut.mutate({ nome: limpo });
  }

  return (
    <Modal aberto={aberto} aoFechar={fechar} titulo="Nova categoria" tamanho="sm">
      <form onSubmit={enviar} className="space-y-4">
        <Campo label="Nome da categoria" htmlFor="nova-categoria-nome">
          <input
            id="nova-categoria-nome"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex.: Vestidos"
            className={campoCategoriaClasse}
          />
        </Campo>

        {erro && <Feedback tipo="erro">{erro}</Feedback>}

        <div className="flex justify-end gap-2">
          <BotaoSecundario type="button" onClick={fechar}>
            Cancelar
          </BotaoSecundario>
          <BotaoPrimario type="submit" disabled={criarMut.isPending || !nome.trim()}>
            Criar
          </BotaoPrimario>
        </div>
      </form>
    </Modal>
  );
}
