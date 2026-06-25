import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Smartphone, QrCode, RefreshCw, LogOut, Save } from "lucide-react";
import {
  atualizarWhatsappDono,
  whatsappConectar,
  whatsappDesconectar,
  whatsappDono,
  whatsappStatus,
} from "../../lib/api";
import { Carregando, Erro } from "../../components/Estado";
import Modal from "../../components/admin/Modal";
import { BotaoPrimario, BotaoSecundario, Feedback, Selo, inputClasse } from "../../components/admin/ui";

// Rótulo + cor do selo por estado de conexão (vindo do backend).
// Os rótulos são em PT-BR simples, sem jargão técnico (ex.: "Evolution").
const ESTADOS = {
  open: { rotulo: "Conectado", cor: "verde" },
  connecting: { rotulo: "Conectando…", cor: "acento" },
  qr: { rotulo: "Aguardando leitura do QR", cor: "acento" },
  aguardando_qr: { rotulo: "QR não gerado", cor: "vermelho" },
  close: { rotulo: "Desconectado", cor: "cinza" },
  nao_criada: { rotulo: "Não conectado", cor: "cinza" },
  desconhecido: { rotulo: "Desconhecido", cor: "neutro" },
  nao_configurado: { rotulo: "Não configurado", cor: "vermelho" },
  nao_autorizado: { rotulo: "Chave inválida", cor: "vermelho" },
  erro_evolution: { rotulo: "Erro no serviço", cor: "vermelho" },
  indisponivel: { rotulo: "Serviço indisponível", cor: "vermelho" },
};

// Garante o prefixo data: para o <img> do QR (a Evolution às vezes manda cru).
function fonteQr(base64) {
  if (!base64) return null;
  return base64.startsWith("data:") ? base64 : `data:image/png;base64,${base64}`;
}

function apenasDigitos(valor) {
  return String(valor || "").replace(/\D/g, "").slice(0, 15);
}

function formatarNumero(numero) {
  const d = apenasDigitos(numero);
  if (!d) return "Não configurado";
  if (d.length === 13 && d.startsWith("55")) {
    return `+${d.slice(0, 2)} (${d.slice(2, 4)}) ${d.slice(4, 9)}-${d.slice(9)}`;
  }
  if (d.length === 12 && d.startsWith("55")) {
    return `+${d.slice(0, 2)} (${d.slice(2, 4)}) ${d.slice(4, 8)}-${d.slice(8)}`;
  }
  return `+${d}`;
}

export default function Whatsapp() {
  const qc = useQueryClient();
  const [qr, setQr] = useState(null); // { qr_base64, pairing_code, mensagem }
  const [feedback, setFeedback] = useState({ tipo: "", texto: "" });
  const [feedbackDono, setFeedbackDono] = useState({ tipo: "", texto: "" });
  const [numeroDonoEditado, setNumeroDonoEditado] = useState(null);
  // Confirmação em modal (no lugar do popup do navegador): { titulo, mensagem, rotulo, aoConfirmar }.
  const [confirmacao, setConfirmacao] = useState(null);

  const statusQ = useQuery({
    queryKey: ["admin", "whatsapp", "status"],
    queryFn: whatsappStatus,
    // Enquanto o QR está na tela (e ainda não conectou), faz polling.
    refetchInterval: (query) =>
      qr && query.state.data?.estado !== "open" ? 4000 : false,
  });

  const donoQ = useQuery({
    queryKey: ["admin", "whatsapp", "dono"],
    queryFn: whatsappDono,
  });



  const estado = statusQ.data?.estado;
  // Mostra o QR enquanto ainda não conectou.
  const mostrarQr = Boolean(qr) && estado !== "open";

  // Conectou enquanto o QR estava na tela → limpa o QR (ajuste de estado na
  // renderização, padrão recomendado do React — sem efeito).
  if (estado === "open" && qr) setQr(null);

  const conectarMut = useMutation({
    mutationFn: whatsappConectar,
    onMutate: () => setFeedback({ tipo: "", texto: "" }),
    onSuccess: (dados) => {
      if (dados.estado === "open") {
        setQr(null);
        setFeedback({ tipo: "sucesso", texto: "WhatsApp já está conectado." });
      } else if (dados.qr_base64 || dados.pairing_code) {
        setQr(dados);
      } else {
        setFeedback({ tipo: "erro", texto: dados.mensagem || "Não foi possível obter o QR Code." });
      }
      qc.invalidateQueries({ queryKey: ["admin", "whatsapp", "status"] });
    },
    onError: (e) => setFeedback({ tipo: "erro", texto: e.message }),
  });

  const desconectarMut = useMutation({
    mutationFn: whatsappDesconectar,
    onSuccess: (dados) => {
      setQr(null);
      setFeedback({
        tipo: dados.ok ? "sucesso" : "erro",
        texto: dados.mensagem,
      });
      qc.invalidateQueries({ queryKey: ["admin", "whatsapp", "status"] });
    },
    onError: (e) => setFeedback({ tipo: "erro", texto: e.message }),
  });

  const donoMut = useMutation({
    mutationFn: atualizarWhatsappDono,
    onSuccess: (dados) => {
      setNumeroDonoEditado(dados.numero || "");
      setFeedbackDono({ tipo: "sucesso", texto: dados.mensagem || "WhatsApp do dono atualizado." });
      qc.invalidateQueries({ queryKey: ["admin", "whatsapp", "dono"] });
    },
    onError: (e) => setFeedbackDono({ tipo: "erro", texto: e.message }),
  });

  function salvarDono(e) {
    e.preventDefault();
    setFeedbackDono({ tipo: "", texto: "" });
    const novo = apenasDigitos(numeroDono);
    if (!novo) {
      setFeedbackDono({ tipo: "erro", texto: "Informe o WhatsApp do dono." });
      return;
    }
    const atual = donoQ.data?.numero || "";
    if (novo === atual) {
      setFeedbackDono({ tipo: "sucesso", texto: "Este já é o WhatsApp do dono." });
      return;
    }
    setConfirmacao({
      titulo: "Trocar o WhatsApp do dono",
      mensagem: `Trocar o WhatsApp do dono de ${formatarNumero(atual)} para ${formatarNumero(novo)}?`,
      rotulo: "Trocar número",
      aoConfirmar: () => donoMut.mutate(novo),
    });
  }

  if (statusQ.isLoading || donoQ.isLoading) return <Carregando texto="Carregando WhatsApp…" />;
  if (statusQ.isError)
    return <Erro mensagem={statusQ.error.message} aoTentarNovamente={statusQ.refetch} />;
  if (donoQ.isError)
    return <Erro mensagem={donoQ.error.message} aoTentarNovamente={donoQ.refetch} />;

  const numeroDono = numeroDonoEditado ?? donoQ.data?.numero ?? "";
  const info = ESTADOS[estado] ?? ESTADOS.desconhecido;
  const conectado = estado === "open";
  const naoConfigurado = estado === "nao_configurado";
  const donoAtual = donoQ.data?.numero || "";

  return (
    <section className="max-w-2xl space-y-6">
      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
          <h1 className="flex items-center gap-2 font-display text-3xl font-semibold">
            <Smartphone size={26} aria-hidden="true" className="text-acento-escuro" />
            WhatsApp
          </h1>
          <Selo cor={info.cor}>{info.rotulo}</Selo>
        </div>
        <p className="text-sm text-texto-suave">
          Conecte aqui o número <strong>dedicado</strong> do bot (nunca o número principal do
          ateliê). Ele envia avisos de venda, encomenda e estoque baixo — e aceita comandos de
          estoque por mensagem.
        </p>
      </div>

      {feedback.texto && <Feedback tipo={feedback.tipo}>{feedback.texto}</Feedback>}

      <div className="rounded-lg border border-borda bg-superficie p-6">
        <h2 className="font-display text-2xl font-semibold text-texto">WhatsApp do dono</h2>
        <p className="mt-1 text-sm text-texto-suave">
          Atual: <strong className="text-texto">{formatarNumero(donoAtual)}</strong>
        </p>
        <form onSubmit={salvarDono} className="mt-4 space-y-3">
          <div>
            <label htmlFor="whatsapp-dono" className="mb-1 block text-sm font-medium text-texto">
              Novo WhatsApp autorizado
            </label>
            <input
              id="whatsapp-dono"
              type="tel"
              inputMode="numeric"
              value={numeroDono}
              onChange={(e) => setNumeroDonoEditado(apenasDigitos(e.target.value))}
              placeholder="Ex.: 5567999990000"
              className={inputClasse}
            />
            <p className="mt-1 text-xs text-texto-suave">
              Use formato internacional: DDI + DDD + número, somente dígitos.
            </p>
          </div>
          {feedbackDono.texto && <Feedback tipo={feedbackDono.tipo}>{feedbackDono.texto}</Feedback>}
          <BotaoPrimario type="submit" disabled={donoMut.isPending}>
            <Save size={18} aria-hidden="true" />
            {donoMut.isPending ? "Salvando…" : "Salvar WhatsApp do dono"}
          </BotaoPrimario>
        </form>
      </div>

      {naoConfigurado && (
        <div className="rounded-lg border border-erro/30 bg-erro/5 p-4 text-sm text-texto">
          O bot ainda não foi configurado. Defina <code>EVOLUTION_URL</code>,{" "}
          <code>EVOLUTION_API_KEY</code> e <code>EVOLUTION_INSTANCE</code> no <code>.env</code> e
          suba o serviço <code>evolution-api</code> (veja o README).
        </div>
      )}

      {!naoConfigurado && (
        <div className="rounded-lg border border-borda bg-superficie p-6">
          {conectado ? (
            <div className="space-y-4">
              <p className="text-texto">
                O WhatsApp do bot está <strong className="text-sucesso">conectado</strong> e
                pronto para enviar avisos e receber comandos.
              </p>
              <BotaoSecundario
                type="button"
                onClick={() =>
                  setConfirmacao({
                    titulo: "Desconectar o WhatsApp",
                    mensagem:
                      "Desconectar o WhatsApp do bot? Os avisos de venda, encomenda e estoque param até reconectar.",
                    rotulo: "Desconectar",
                    aoConfirmar: () => desconectarMut.mutate(),
                  })
                }
                disabled={desconectarMut.isPending}
              >
                <LogOut size={18} aria-hidden="true" />
                {desconectarMut.isPending ? "Desconectando…" : "Desconectar"}
              </BotaoSecundario>
            </div>
          ) : mostrarQr ? (
            <div className="space-y-4 text-center">
              <p className="text-sm text-texto">
                No celular do número dedicado, abra o <strong>WhatsApp</strong> →{" "}
                <strong>Aparelhos conectados</strong> → <strong>Conectar um aparelho</strong> e
                escaneie o código:
              </p>
              {fonteQr(qr.qr_base64) ? (
                <img
                  src={fonteQr(qr.qr_base64)}
                  alt="QR Code para conectar o WhatsApp"
                  className="mx-auto h-64 w-64 rounded-lg border border-borda bg-white object-contain p-2"
                />
              ) : (
                <p className="text-sm text-texto-suave">QR Code indisponível.</p>
              )}
              {qr.pairing_code && (
                <p className="text-sm text-texto-suave">
                  Ou use o código de pareamento:{" "}
                  <span className="font-mono font-semibold text-texto">{qr.pairing_code}</span>
                </p>
              )}
              <p className="text-xs text-texto-suave">
                O código expira em pouco tempo. Se não funcionar, gere outro.
              </p>
              <BotaoSecundario
                type="button"
                onClick={() => conectarMut.mutate()}
                disabled={conectarMut.isPending}
              >
                <RefreshCw size={16} aria-hidden="true" />
                Gerar outro QR
              </BotaoSecundario>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-texto">
                O WhatsApp do bot está <strong>desconectado</strong>. Clique abaixo para gerar o
                QR Code e parear o número dedicado.
              </p>
              <BotaoPrimario
                type="button"
                onClick={() => conectarMut.mutate()}
                disabled={conectarMut.isPending}
              >
                <QrCode size={18} aria-hidden="true" />
                {conectarMut.isPending ? "Gerando QR…" : "Conectar WhatsApp"}
              </BotaoPrimario>
            </div>
          )}
        </div>
      )}

      <Modal
        aberto={Boolean(confirmacao)}
        aoFechar={() => setConfirmacao(null)}
        titulo={confirmacao?.titulo}
        tamanho="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-texto">{confirmacao?.mensagem}</p>
          <div className="flex flex-col gap-3 border-t border-borda pt-4 sm:flex-row sm:justify-end">
            <BotaoSecundario type="button" onClick={() => setConfirmacao(null)}>
              Cancelar
            </BotaoSecundario>
            <BotaoPrimario
              type="button"
              onClick={() => {
                confirmacao?.aoConfirmar?.();
                setConfirmacao(null);
              }}
            >
              {confirmacao?.rotulo ?? "Confirmar"}
            </BotaoPrimario>
          </div>
        </div>
      </Modal>
    </section>
  );
}