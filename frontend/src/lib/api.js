// Cliente HTTP da API do ateliê.
// - Leitura pública (vitrine) e escrita autenticada (admin, JWT Bearer).
// - Nunca falha em silêncio: em erro, lança Error com mensagem em PT-BR.
// - Em 401 numa chamada autenticada, tenta renovar o access com o refresh;
//   se não conseguir, limpa a sessão e avisa via evento "auth:expirou".

const BASE = import.meta.env.VITE_API_URL?.replace(/\/$/, "") ?? "";

// Sem localStorage no build SSG (Node): retorna null com segurança.
const temStorage = typeof localStorage !== "undefined";

// Fábrica de um cofre de tokens (admin e cliente usam chaves SEPARADAS, para
// não misturar as sessões — um login não vale no contexto do outro).
function criarCofre(chaveAccess, chaveRefresh) {
  return {
    get access() {
      return temStorage ? localStorage.getItem(chaveAccess) : null;
    },
    get refresh() {
      return temStorage ? localStorage.getItem(chaveRefresh) : null;
    },
    salvar(access, refresh) {
      if (access) localStorage.setItem(chaveAccess, access);
      if (refresh) localStorage.setItem(chaveRefresh, refresh);
    },
    salvarAccess(access) {
      if (access) localStorage.setItem(chaveAccess, access);
    },
    limpar() {
      localStorage.removeItem(chaveAccess);
      localStorage.removeItem(chaveRefresh);
    },
  };
}

// Tokens do ADMIN (staff) e do CLIENTE da loja — chaves de storage distintas.
export const tokens = criarCofre("atelie_admin_access", "atelie_admin_refresh");
export const tokensCliente = criarCofre("atelie_cliente_access", "atelie_cliente_refresh");

// Resolve o cofre + evento de expiração conforme a audiência da chamada.
// auth === "cliente" → sessão do cliente; auth truthy (true) → admin.
function contextoAuth(auth) {
  if (auth === "cliente") {
    return { cofre: tokensCliente, evento: "auth:expirou:cliente" };
  }
  return { cofre: tokens, evento: "auth:expirou" };
}

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
  contato: "Contato",
  itens: "Itens",
  email: "E-mail",
  cpf: "CPF",
  senha: "Senha",
  telefone: "Telefone",
  senha_atual: "Senha atual",
  nova_senha: "Nova senha",
  disponibilidade: "",
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

async function renovarAccess(cofre) {
  const refresh = cofre.refresh;
  if (!refresh) return false;
  try {
    const resp = await fetch(`${BASE}/api/auth/refresh/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh }),
    });
    if (!resp.ok) return false;
    const dados = await resp.json();
    cofre.salvarAccess(dados.access);
    return true;
  } catch {
    return false;
  }
}

function expirarSessao(cofre, evento) {
  cofre.limpar();
  window.dispatchEvent(new Event(evento));
}

async function request(
  caminho,
  { method = "GET", body, auth = false, multipart = false, _retry = false } = {}
) {
  const headers = {};
  const ctx = auth ? contextoAuth(auth) : null;
  if (ctx && ctx.cofre.access) headers.Authorization = `Bearer ${ctx.cofre.access}`;

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

  // Tenta renovar uma vez em caso de access expirado (na sessão correta).
  if (resp.status === 401 && ctx && !_retry) {
    const renovou = await renovarAccess(ctx.cofre);
    if (renovou) {
      return request(caminho, { method, body, auth, multipart, _retry: true });
    }
    expirarSessao(ctx.cofre, ctx.evento);
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

// Logout: revoga o refresh no servidor (blacklist) e limpa o storage local.
// Best-effort — a UI não pode travar se a rede falhar; `keepalive` permite o
// envio mesmo durante o unload da página. O storage é limpo de imediato.
function revogarELimpar(cofre) {
  const refresh = cofre.refresh;
  cofre.limpar();
  if (refresh) {
    fetch(`${BASE}/api/auth/logout/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh }),
      keepalive: true,
    }).catch(() => {});
  }
}
export const logoutAdmin = () => revogarELimpar(tokens);
export const logoutCliente = () => revogarELimpar(tokensCliente);

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

// ----------------------------------------------------------------------------
// Checkout (pagamento online — Mercado Pago)
// ----------------------------------------------------------------------------
// Criação PÚBLICA (sem auth). O servidor recomputa os preços; qualquer valor do
// cliente é ignorado. Sucesso 201: { pedido_id, init_point } — redirecionar o
// navegador para `init_point`. Erros vêm por campo (nome/contato/itens),
// 409 { disponibilidade: [...] } (estoque insuficiente) ou 502 { detalhe }.
// Agora exige conta de cliente (auth do cliente). nome/contato/CPF vêm da conta
// no servidor; o corpo só leva os itens (+ cupom opcional, validado no servidor).
export function criarCheckout({ itens, cupom }) {
  return request("/checkout/", {
    method: "POST",
    body: cupom ? { itens, cupom } : { itens },
    auth: "cliente",
  });
}

// Pré-valida um cupom contra o carrinho (público) → { valido, desconto, total, mensagem }.
export function validarCupom(codigo, itens) {
  return request("/cupom/validar/", { method: "POST", body: { codigo, itens } });
}

export const obterEncomenda = (id) =>
  request(`/encomendas/${id}/`, { auth: true });
export const atualizarEncomendaStatus = (id, status) =>
  request(`/encomendas/${id}/`, { method: "PATCH", body: { status }, auth: true });
export const excluirEncomenda = (id) =>
  request(`/encomendas/${id}/`, { method: "DELETE", auth: true });

// ----------------------------------------------------------------------------
// Vendas / Pedidos (pagamento online) — SOMENTE LEITURA (admin)
// ----------------------------------------------------------------------------
// Os pedidos são criados pelo checkout público e confirmados por webhook do
// Mercado Pago. O painel apenas LÊ (não cria/edita/exclui); estorno e
// cancelamento são feitos no painel do Mercado Pago.
// Lista TODOS os pedidos percorrendo a paginação. Filtro opcional `?status=`.
export async function listarTodosPedidos(filtros = {}, { auth = true } = {}) {
  let url = `/pedidos/${querystring(filtros)}`;
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

export const obterPedido = (id) => request(`/pedidos/${id}/`, { auth: true });

// Grava/edita o código de rastreio dos Correios (só em pedido pago — o servidor
// valida). Não altera o status; demais campos seguem somente leitura.
export const atualizarRastreio = (id, codigo_rastreio) =>
  request(`/pedidos/${id}/rastreio/`, {
    method: "PATCH",
    body: { codigo_rastreio },
    auth: true,
  });

// ----------------------------------------------------------------------------
// Conexão do WhatsApp (bot do dono) — admin. O backend faz de proxy para a
// Evolution; a chave da Evolution NUNCA chega ao navegador.
// ----------------------------------------------------------------------------
export const whatsappStatus = () => request("/whatsapp/status/", { auth: true });
export const whatsappConectar = () =>
  request("/whatsapp/conectar/", { method: "POST", auth: true });
export const whatsappDesconectar = () =>
  request("/whatsapp/desconectar/", { method: "POST", auth: true });
export const whatsappDono = () => request("/whatsapp/dono/", { auth: true });
export const atualizarWhatsappDono = (numero) =>
  request("/whatsapp/dono/", { method: "PATCH", body: { numero }, auth: true });

// ----------------------------------------------------------------------------
// Contas do painel — identidade, troca de senha e gestão de funcionários.
// As permissões são forçadas no backend; o front só decide o que mostrar.
// ----------------------------------------------------------------------------
// Identidade do usuário logado: { usuario, nome, papel, ativo, senha_provisoria, acesso_financeiro }.
export const obterMe = () => request("/me/", { auth: true });

// Troca da própria senha (limpa senha_provisoria no backend).
export const mudarSenha = (senha_atual, nova_senha) =>
  request("/me/senha/", {
    method: "POST",
    body: { senha_atual, nova_senha },
    auth: true,
  });

// Lista TODOS os funcionários (só Dono), percorrendo a paginação.
export async function listarUsuarios() {
  let url = "/usuarios/";
  const todos = [];
  let guarda = 0;
  while (url && guarda < 100) {
    const pagina = await request(url, { auth: true });
    if (Array.isArray(pagina)) {
      todos.push(...pagina);
      url = null;
    } else {
      todos.push(...(pagina.results ?? []));
      if (pagina.next) {
        const u = new URL(pagina.next);
        url = u.pathname.replace(/^\/api/, "") + u.search;
      } else {
        url = null;
      }
    }
    guarda += 1;
  }
  return todos;
}

// Promoções/cupons (admin financeiro) — percorre a paginação.
export async function listarPromocoes() {
  let url = "/promocoes/";
  const todas = [];
  let guarda = 0;
  while (url && guarda < 100) {
    const pagina = await request(url, { auth: true });
    todas.push(...(pagina.results ?? (Array.isArray(pagina) ? pagina : [])));
    if (!Array.isArray(pagina) && pagina.next) {
      const u = new URL(pagina.next);
      url = u.pathname.replace(/^\/api/, "") + u.search;
    } else {
      url = null;
    }
    guarda += 1;
  }
  return todas;
}
export const criarPromocao = (dados) =>
  request("/promocoes/", { method: "POST", body: dados, auth: true });
export const atualizarPromocao = (id, dados) =>
  request(`/promocoes/${id}/`, { method: "PATCH", body: dados, auth: true });
export const excluirPromocao = (id) =>
  request(`/promocoes/${id}/`, { method: "DELETE", auth: true });

// ----------------------------------------------------------------------------
// Relatórios financeiros (admin) — agregações no servidor + exportação.
// ----------------------------------------------------------------------------
export const relatorioFinanceiro = (params = {}) =>
  request(`/relatorios/financeiro/${querystring(params)}`, { auth: true });
export const relatorioVendasPeriodo = (params = {}) =>
  request(`/relatorios/vendas-por-periodo/${querystring(params)}`, { auth: true });
export const relatorioProdutosVendidos = (params = {}) =>
  request(`/relatorios/produtos-mais-vendidos/${querystring(params)}`, { auth: true });
export const relatorioResumoMes = (params = {}) =>
  request(`/relatorios/resumo-do-mes/${querystring(params)}`, { auth: true });

// Baixa o relatório como arquivo (CSV/PDF). Precisa do header de auth, então não
// dá para usar um <a href> simples: busca o blob com o token e dispara o download.
export async function baixarRelatorio(slug, params = {}) {
  const caminho = `/relatorios/${slug}/${querystring(params)}`;
  const headers = {};
  if (tokens.access) headers.Authorization = `Bearer ${tokens.access}`;

  let resp;
  try {
    resp = await fetch(`${BASE}/api${caminho}`, { headers });
  } catch {
    throw new Error("Não foi possível conectar ao servidor.");
  }
  // Tenta renovar o access uma vez (mesma lógica do request()).
  if (resp.status === 401 && (await renovarAccess(tokens))) {
    headers.Authorization = `Bearer ${tokens.access}`;
    resp = await fetch(`${BASE}/api${caminho}`, { headers });
  }
  if (!resp.ok) throw new Error(mensagemDeErro(resp.status, await corpoJson(resp)));

  const blob = await resp.blob();
  const cd = resp.headers.get("Content-Disposition") || "";
  const m = /filename="?([^"]+)"?/.exec(cd);
  const nome = m ? m[1] : `${slug}.${(params.formato || "csv")}`;

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export const criarUsuario = (dados) =>
  request("/usuarios/", { method: "POST", body: dados, auth: true });
export const atualizarUsuario = (id, dados) =>
  request(`/usuarios/${id}/`, { method: "PATCH", body: dados, auth: true });
export const excluirUsuario = (id) =>
  request(`/usuarios/${id}/`, { method: "DELETE", auth: true });

// ----------------------------------------------------------------------------
// Conta do CLIENTE da loja (cadastro/login/perfil/pedidos) — sessão SEPARADA
// do admin (cofre `tokensCliente`). O backend reforça as permissões.
// ----------------------------------------------------------------------------
// Cadastro público: { nome, email, cpf, telefone, senha } → { mensagem }.
export const contaCadastro = (dados) =>
  request("/conta/cadastro/", { method: "POST", body: dados });

// Login do cliente (e-mail + senha) → guarda os tokens do cliente.
export async function contaLogin(email, senha) {
  let resp;
  try {
    resp = await fetch(`${BASE}/api/conta/login/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: senha }),
    });
  } catch {
    throw new Error("Não foi possível conectar ao servidor.");
  }
  if (resp.status === 401) throw new Error("E-mail ou senha inválidos.");
  if (!resp.ok) throw new Error(mensagemDeErro(resp.status, await corpoJson(resp)));
  const dados = await resp.json();
  tokensCliente.salvar(dados.access, dados.refresh);
  return dados;
}

export const contaMe = () => request("/conta/me/", { auth: "cliente" });
export const contaAtualizar = (dados) =>
  request("/conta/me/", { method: "PATCH", body: dados, auth: "cliente" });
export const contaTrocarSenha = (senha_atual, nova_senha) =>
  request("/conta/senha/", {
    method: "POST",
    body: { senha_atual, nova_senha },
    auth: "cliente",
  });

// Histórico de pedidos do próprio cliente (percorre a paginação).
export async function contaPedidos() {
  let url = "/conta/pedidos/";
  const todos = [];
  let guarda = 0;
  while (url && guarda < 100) {
    const pagina = await request(url, { auth: "cliente" });
    todos.push(...(pagina.results ?? []));
    if (pagina.next) {
      const u = new URL(pagina.next);
      url = u.pathname.replace(/^\/api/, "") + u.search;
    } else {
      url = null;
    }
    guarda += 1;
  }
  return todos;
}