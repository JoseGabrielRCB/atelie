// Configuração central do site — placeholders do dono num lugar só.
// Troque os valores entre [COLCHETES] quando tiver a informação confirmada.
// As seções da Home leem daqui, então o dono edita só este arquivo.

export const SITE = {
  nome: "Ateliê ++",
  tagline: "Costura sob medida",
  cidade: "Campo Grande – MS",

  // WhatsApp: usa VITE_WHATSAPP do .env quando existir (só dígitos, formato internacional).
  whatsapp: import.meta.env.VITE_WHATSAPP ?? "",

  // Pendências do dono (mantidas como [COLCHETE] até confirmar):
  instagram: "[@PERFIL]", // ex.: "@atelieplus"
  tempoAtuacao: "[TEMPO — ex.: alguns anos]",
  prazoEncomenda: "[PRAZO — ex.: de X a Y dias]",
  numeroPecas: "[Nº]", // ex.: "500" (selo de confiança, opcional)
  fazAjustes: true, // true: mostra "fazemos ajustes/consertos"; false: oculta

  // Domínio público do site (canonical/OG/sitemap) — preencher no deploy.
  dominio: "[DOMINIO]", // ex.: "https://atelieplus.com.br"
};

// Depoimentos — PLACEHOLDERS até ter reais (com permissão da pessoa) antes de publicar.
export const DEPOIMENTOS = [
  {
    texto:
      "Amei o vestido sob medida, ficou perfeito no corpo. Atendimento atencioso do começo ao fim.",
    autor: "[Nome da cliente], Campo Grande",
  },
  {
    texto: "Peça impecável e entregue no prazo. Virei cliente!",
    autor: "[Nome da cliente]",
  },
  {
    texto: "Capricho em cada detalhe. Recomendo demais.",
    autor: "[Nome da cliente]",
  },
];

// FAQ — fonte única (alimenta a seção visível e o JSON-LD FAQPage da Home).
export const FAQ = [
  {
    pergunta: "O Ateliê ++ faz roupas sob medida?",
    resposta:
      "Sim. Criamos peças sob medida a partir das suas referências e medidas, além de vendermos modelos prontos.",
  },
  {
    pergunta: "Vocês atendem em Campo Grande – MS?",
    resposta:
      "Sim. Atendemos em Campo Grande – MS e também recebemos encomendas [à distância / por envio — confirmar].",
  },
  {
    pergunta: "Como faço um pedido?",
    resposta:
      "Escolha uma peça na vitrine e finalize pelo WhatsApp, ou preencha o formulário de encomenda com fotos e detalhes.",
  },
  {
    pergunta: "Quanto tempo leva uma encomenda sob medida?",
    resposta: `O prazo varia conforme a peça. Em geral, ${SITE.prazoEncomenda} — combinamos o prazo exato com você antes de começar.`,
  },
  {
    pergunta: "Como funciona o pagamento?",
    resposta:
      "Combinamos o valor e a forma de pagamento direto pelo WhatsApp, de forma simples e transparente.",
  },
  ...(SITE.fazAjustes
    ? [
        {
          pergunta: "Vocês fazem ajustes e consertos?",
          resposta: "Sim, fazemos ajustes e pequenos consertos.",
        },
      ]
    : []),
];
