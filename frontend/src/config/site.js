// Configuração central do site — placeholders do dono num lugar só.
// Troque os valores entre [COLCHETES] quando tiver a informação confirmada.
// As seções da Home leem daqui, então o dono edita só este arquivo.
//
// Marca: Ateliê da Sete · Roupas & Artigos Religiosos (Umbanda + Candomblé),
// sob medida, conforme o fundamento de cada casa. Campo Grande/MS, para todo o
// Brasil. Dona: Gabrielly Liberato.

export const SITE = {
  nome: "Ateliê da Sete",
  tagline: "Roupas & Artigos Religiosos",
  cidade: "Campo Grande – MS",
  dona: "Gabrielly Liberato",

  // WhatsApp: usa VITE_WHATSAPP do .env quando existir (só dígitos, formato internacional).
  whatsapp: import.meta.env.VITE_WHATSAPP ?? "",

  // Pendências do dono (mantidas como [COLCHETE] até confirmar):
  instagram: "[@PERFIL]", // handle real (o material cita +106 mil seguidores — confirmar)
  prazoEncomenda: "15 a 30 dias", // FAQ: prazo médio de confecção

  // Domínio público do site (canonical/OG/sitemap) — preencher no deploy.
  dominio: "[DOMINIO]", // ex.: "https://ateliedasete.com.br"
};

// Depoimentos — PLACEHOLDERS até ter reais (com permissão da pessoa) antes de publicar.
export const DEPOIMENTOS = [
  {
    texto:
      "Minha roupa de corrente ficou perfeita — branca de verdade, não entrega no suor. E no fundamento da minha casa.",
    autor: "[Nome], [cidade]",
  },
  {
    texto: "Encomendei o paramento do meu guia e chegou impecável, no prazo.",
    autor: "[Nome]",
  },
  {
    texto: "Atendimento que entende do assunto. Virei cliente.",
    autor: "[Nome]",
  },
];

// FAQ — fonte única (alimenta a seção visível e o JSON-LD FAQPage da Home).
// Regras: sempre "conforme o fundamento da sua casa"; atende Umbanda E Candomblé.
export const FAQ = [
  {
    pergunta: "Vocês fazem conforme o fundamento da minha casa?",
    resposta:
      "Sempre. É a base do trabalho: a cor, o modelo e o detalhe seguem o que o seu dirigente firma — não um padrão de prateleira.",
  },
  {
    pergunta: "Atendem Umbanda e Candomblé?",
    resposta:
      "Sim, os dois. Roupa branca de corrente e paramentos de guias (Umbanda) e axós/paramentos no fundamento do Orixá (Candomblé).",
  },
  {
    pergunta: "Como funciona a medida à distância?",
    resposta:
      "A gente combina pelo WhatsApp: passo a tabela de medidas, você confere, e enviamos para todo o Brasil.",
  },
  {
    pergunta: "Fazem paramento de Exu e Pombagira?",
    resposta:
      "Sim — capas, cartola, renda e o brilho da linha, no preto e vermelho.",
  },
  {
    pergunta: "Qual o prazo de confecção?",
    resposta: `Em média ${SITE.prazoEncomenda}, conforme a peça e a fila — combinamos o prazo exato antes de começar.`,
  },
  {
    pergunta: "A roupa branca fica transparente?",
    resposta:
      "Não. Tecido e forro próprios para o trabalho, pensados para horas de gira sem transparência.",
  },
];
