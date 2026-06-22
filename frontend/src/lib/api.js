// Cliente HTTP da API do ateliê.
// - Leitura pública (vitrine) e escrita autenticada (admin, JWT Bearer).
// - Nunca falha em silêncio: em erro, lança Error com mensagem em PT-BR.
// - Em 401 numa chamada autenticada, tenta renovar o access com o refresh;
//   se não conseguir, limpa a sessão e avisa via evento "auth:expirou".

const BASE = import.meta.env.VITE_API_URL?.replace(/\/$/, "") ?? "";

const CHAVE_ACCESS = "atelie_admin_access";
const CHAVE_REFRESH = "atelie_admin_refresh";

// Sem localStorage no build SSG (Node): retorna null com segurança.
const temStorage = typeof localStorage !== "undefined";

// Armazenamento dos tokens (localStorage — app de admin único).
export const tokens = {
  get access() {
    return temStorage ? localStorage.getItem(CHAVE_ACCESS) : null;
  },
  get refresh() {
    return temStorage ? localStorage.getItem(CHAVE_REFRESH) : null;
  },
  salvar(access, refresh) {
    if (access) localStorage.setItem(CHAVE_ACCESS, access);
    if (refresh) localStorage.setItem(CHAVE_REFRESH, refresh);
  },
  salvarAccess(access) {
    if (access) localStorage.setItem(CHAVE_ACCESS, access);
  },
  limpar() {
    localStorage.removeItem(CHAVE_ACCESS);
    localStorage.removeItem(CHAVE_REFRESH);
  },
};

// Rótulos amigáveis (PT-BR) para os campos da API, usados nas mensagens de erro.
const ROTULOS_CAMPO = {
  tamanho: "Tamanho",
  cor: "Cor",
  cor_hex: "Cor",
  hex: "Cor (hex)",
  estoque: "Estoque",
  peca: "Peça",
  nome: "Nome",
  preco: "Preço",
  categoria: "Categoria",
  descricao: "Descrição",
  arquivo: "Imagem",
  non_field_errors: "",
};

// Normaliza o valor de erro de um campo (string ou lista) em texto.
function textoDoCampo(valor) {
  if (Array.isArray(valor)) return valor.map(textoDoCampo).filter(Boolean).join(" ");
  if (valor && typeof valor === "object") return Object.values(valor).map(textoDoCampo).join(" ");
  return valor == null ? "" : String(valor);
}

// Extrai uma mensagem legível do corpo de erro do DRF.
// Prioriza erros POR CAMPO (ex.: {"tamanho": ["..."]}) sobre o detalhe genérico,
// para que o painel mostre qual campo falhou e por quê.
function mensagemDeErro(status, corpo) {
  if (corpo && typeof corpo === "object") {
    // 1) Erros específicos de campo (exceto detail/detalhe genéricos).
    const partes = [];
    for (const [campo, valor] of Object.entries(corpo)) {
      if (campo === "detail" || campo === "detalhe") continue;
      const texto = textoDoCampo(valor);
      if (!texto) continue;
      const rotulo = ROTULOS_CAMPO[campo] ?? campo;
      partes.push(rotulo ? `${rotulo}: ${texto}` : texto);
    }
    if (partes.length) return partes.join(" | ");

    // 2) Fallback: mensagem genérica do servidor.
    if (corpo.detail) return corpo.detail;
    if (corpo.detalhe) return corpo.detalhe;
  }
  if (status === 400) return "Dados inválidos. Verifique os campos e tente novamente.";
  if (status === 401) return "Sessão expirada. Faça login novamente.";
  if (status === 403) return "Você não tem permissão para esta ação.";
  if (status === 404) return "Conteúdo não encontrado.";
  return "Ocorreu um erro. Tente novamente em instantes.";
}

async function corpoJson(resp) {
  const texto = await resp.text();
  if (!texto) return null;
  try {
    return JSON.parse(texto);
  } catch {
    return texto;
  }
}

async function renovarAccess() {
  const refresh = tokens.refresh;
  if (!refresh) return false;
  try {
    const resp = await fetch(`${BASE}/api/auth/refresh/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh }),
    });
    if (!resp.ok) return false;
    const dados = await resp.json();
    tokens.salvarAccess(dados.access);
    return true;
  } catch {
    return false;
  }
}

function expirarSessao() {
  tokens.limpar();
  window.dispatchEvent(new Event("auth:expirou"));
}

async function request(
  caminho,
  { method = "GET", body, auth = false, multipart = false, _retry = false } = {}
) {
  const headers = {};
  if (auth && tokens.access) headers.Authorization = `Bearer ${tokens.access}`;

  let corpo;
  if (multipart) {
    corpo = body; // FormData — o navegador define o Content-Type (com boundary).
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    corpo = JSON.stringify(body);
  }

  let resp;
  try {
    resp = await fetch(`${BASE}/api${caminho}`, { method, headers, body: corpo });
  } catch {
    throw new Error(
      "Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente."
    );
  }

  // Tenta renovar uma vez em caso de access expirado.
  if (resp.status === 401 && auth && !_retry) {
    const renovou = await renovarAccess();
    if (renovou) {
      return request(caminho, { method, body, auth, multipart, _retry: true });
    }
    expirarSessao();
    throw new Error("Sessão expirada. Faça login novamente.");
  }

  if (!resp.ok) {
    const corpoErro = await corpoJson(resp);
    throw new Error(mensagemDeErro(resp.status, corpoErro));
  }

  if (resp.status === 204) return null;
  return corpoJson(resp);
}

// Monta a query string ignorando valores vazios.
function querystring(params = {}) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([chave, valor]) => {
    if (valor !== undefined && valor !== null && valor !== "") {
      qs.append(chave, valor);
    }
  });
  const texto = qs.toString();
  return texto ? `?${texto}` : "";
}

// ----------------------------------------------------------------------------
// Catálogo — leitura
// ----------------------------------------------------------------------------
export function listarCategorias() {
  return request("/categorias/");
}

export function listarPecas(filtros = {}, { auth = false } = {}) {
  return request(`/pecas/${querystring(filtros)}`, { auth });
}

export function obterPeca(id, { auth = false } = {}) {
  return request(`/pecas/${id}/`, { auth });
}

// Percorre todas as páginas (uso no admin, onde o volume é pequeno).
export async function listarTodasPecas(filtros = {}, { auth = false } = {}) {
  let url = `/pecas/${querystring(filtros)}`;
  const todas = [];
  let guarda = 0;
  while (url && guarda < 100) {
    const pagina = await request(url, { auth });
    todas.push(...(pagina.results ?? []));
    if (pagina.next) {
      const u = new URL(pagina.next);
      url = u.pathname.replace(/^\/api/, "") + u.search;
    } else {
      url = null;
    }
    guarda += 1;
  }
  return todas;
}

// ----------------------------------------------------------------------------
// Cores (paleta salva) — leitura pública, escrita autenticada (admin)
// ----------------------------------------------------------------------------
// Lista TODAS as cores percorrendo a paginação (volume pequeno).
export async function listarCores() {
  let url = "/cores/";
  const todas = [];
  let guarda = 0;
  while (url && guarda < 100) {
    const pagina = await request(url);
    // A resposta pode vir paginada ({results}) ou como array.
    if (Array.isArray(pagina)) {
      todas.push(...pagina);
      url = null;
    } else {
      todas.push(...(pagina.results ?? []));
      if (pagina.next) {
        const u = new URL(pagina.next);
        url = u.pathname.replace(/^\/api/, "") + u.search;
      } else {
        url = null;
      }
    }
    guarda += 1;
  }
  return todas;
}

export const criarCor = (dados) =>
  request("/cores/", { method: "POST", body: dados, auth: true });
export const atualizarCor = (id, dados) =>
  request(`/cores/${id}/`, { method: "PATCH", body: dados, auth: true });
export const excluirCor = (id) =>
  request(`/cores/${id}/`, { method: "DELETE", auth: true });

// ----------------------------------------------------------------------------
// Autenticação
// ----------------------------------------------------------------------------
export async function login(username, password) {
  let resp;
  try {
    resp = await fetch(`${BASE}/api/auth/login/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
  } catch {
    throw new Error("Não foi possível conectar ao servidor.");
  }
  if (resp.status === 401) throw new Error("Usuário ou senha inválidos.");
  if (!resp.ok) throw new Error(mensagemDeErro(resp.status, await corpoJson(resp)));
  const dados = await resp.json();
  tokens.salvar(dados.access, dados.refresh);
  return dados;
}

// ----------------------------------------------------------------------------
// Catálogo — escrita (admin)
// ----------------------------------------------------------------------------
export const criarPeca = (dados) =>
  request("/pecas/", { method: "POST", body: dados, auth: true });
export const atualizarPeca = (id, dados) =>
  request(`/pecas/${id}/`, { method: "PATCH", body: dados, auth: true });
export const excluirPeca = (id) =>
  request(`/pecas/${id}/`, { method: "DELETE", auth: true });

export const criarCategoria = (dados) =>
  request("/categorias/", { method: "POST", body: dados, auth: true });
export const atualizarCategoria = (id, dados) =>
  request(`/categorias/${id}/`, { method: "PATCH", body: dados, auth: true });
export const excluirCategoria = (id) =>
  request(`/categorias/${id}/`, { method: "DELETE", auth: true });

export const criarVariacao = (dados) =>
  request("/variacoes/", { method: "POST", body: dados, auth: true });
export const atualizarVariacao = (id, dados) =>
  request(`/variacoes/${id}/`, { method: "PATCH", body: dados, auth: true });
export const excluirVariacao = (id) =>
  request(`/variacoes/${id}/`, { method: "DELETE", auth: true });

export function enviarImagem({ peca, arquivo, principal }) {
  const fd = new FormData();
  fd.append("peca", peca);
  fd.append("arquivo", arquivo);
  fd.append("principal", principal ? "true" : "false");
  return request("/imagens/", { method: "POST", body: fd, auth: true, multipart: true });
}
export const atualizarImagem = (id, dados) =>
  request(`/imagens/${id}/`, { method: "PATCH", body: dados, auth: true });
export const excluirImagem = (id) =>
  request(`/imagens/${id}/`, { method: "DELETE", auth: true });

// ----------------------------------------------------------------------------
// Encomendas sob medida
// ----------------------------------------------------------------------------
// Criação PÚBLICA (sem auth): um único multipart com os campos + N imagens
// (mesmo nome de campo "imagens"). Resposta: { id, status, mensagem }.
export function criarEncomenda({
  nome,
  contato,
  descricao,
  tamanho_medidas = "",
  prazo_desejado = "",
  imagens = [],
}) {
  const fd = new FormData();
  fd.append("nome", nome);
  fd.append("contato", contato);
  fd.append("descricao", descricao);
  if (tamanho_medidas) fd.append("tamanho_medidas", tamanho_medidas);
  if (prazo_desejado) fd.append("prazo_desejado", prazo_desejado);
  imagens.forEach((arquivo) => fd.append("imagens", arquivo));
  return request("/encomendas/", { method: "POST", body: fd, multipart: true });
}

// Admin (auth): lista TODAS as encomendas percorrendo a paginação.
export async function listarTodasEncomendas(filtros = {}) {
  let url = `/encomendas/${querystring(filtros)}`;
  const todas = [];
  let guarda = 0;
  while (url && guarda < 100) {
    const pagina = await request(url, { auth: true });
    todas.push(...(pagina.results ?? []));
    if (pagina.next) {
      const u = new URL(pagina.next);
      url = u.pathname.replace(/^\/api/, "") + u.search;
    } else {
      url = null;
    }
    guarda += 1;
  }
  return todas;
}

export const obterEncomenda = (id) =>
  request(`/encomendas/${id}/`, { auth: true });
export const atualizarEncomendaStatus = (id, status) =>
  request(`/encomendas/${id}/`, { method: "PATCH", body: { status }, auth: true });
export const excluirEncomenda = (id) =>
  request(`/encomendas/${id}/`, { method: "DELETE", auth: true });
