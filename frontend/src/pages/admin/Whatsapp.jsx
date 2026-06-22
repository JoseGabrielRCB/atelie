import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Smartphone, QrCode, RefreshCw, LogOut } from "lucide-react";
import { whatsappStatus, whatsappConectar, whatsappDesconectar } from "../../lib/api";
import { Carregando, Erro } from "../../components/Estado";
import { BotaoPrimario, BotaoSecundario, Feedback, Selo } from "../../components/admin/ui";

// Rótulo + cor do selo por estado de conexão (vindo do backend).
const ESTADOS = {
  open: { rotulo: "Conectado", cor: "verde" },
  connecting: { rotulo: "Conectando…", cor: "acento" },
  qr: { rotulo: "Aguardando leitura do QR", cor: "acento" },
  close: { rotulo: "Desconectado", cor: "cinza" },
  nao_criada: { rotulo: "Não conectado", cor: "cinza" },
  desconhecido: { rotulo: "Desconhecido", cor: "neutro" },
  nao_configurado: { rotulo: "Não configurado", cor: "vermelho" },
  indisponivel: { rotulo: "Evolution indisponível", cor: "vermelho" },
};

// Garante o prefixo data: para o <img> do QR (a Evolution às vezes manda cru).
function fonteQr(base64) {
  if (!base64) return null;
  return base64.startsWith("data:") ? base64 : `data:image/png;base64,${base64}`;
}

export default function Whatsapp() {
  const qc = useQueryClient();
  const [qr, setQr] = useState(null); // { qr_base64, pairing_code, mensagem }
  const [feedback, setFeedback] = useState({ tipo: "", texto: "" });

  const statusQ = useQuery({
    queryKey: ["admin", "whatsapp", "status"],
    queryFn: whatsappStatus,
    // Enquanto o QR está na tela (e ainda não conectou), faz polling.
    refetchInterval: (query) =>
      qr && query.state.data?.estado !== "open" ? 4000 : false,
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

  if (statusQ.isLoading) return <Carregando texto="Carregando status do WhatsApp…" />;
  if (statusQ.isError)
    return <Erro mensagem={statusQ.error.message} aoTentarNovamente={statusQ.refetch} />;

  const info = ESTADOS[estado] ?? ESTADOS.desconhecido;
  const conectado = estado === "open";
  const naoConfigurado = estado === "nao_configurado";

  return (
    <section className="max-w-2xl">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 font-display text-3xl font-semibold">
          <Smartphone size={26} aria-hidden="true" className="text-acento-escuro" />
          WhatsApp
        </h1>
        <Selo cor={info.cor}>{info.rotulo}</Selo>
      </div>
      <p className="mb-6 text-sm text-texto-suave">
        Conecte aqui o número <strong>dedicado</strong> do bot (nunca o número principal do
        ateliê). Ele envia avisos de venda, encomenda e estoque baixo — e aceita comandos de
        estoque por mensagem.
      </p>

      {feedback.texto && (
        <div className="mb-4">
          <Feedback tipo={feedback.tipo}>{feedback.texto}</Feedback>
        </div>
      )}

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
                onClick={() => {
                  if (
                    window.confirm(
                      "Desconectar o WhatsApp do bot? Os avisos param até reconectar."
                    )
                  ) {
                    desconectarMut.mutate();
                  }
                }}
                disabled={desconectarMut.isPending}
              >
                <LogOut size={18} aria-hidden="true" />
                Desconectar
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
    </section>
  );
}
