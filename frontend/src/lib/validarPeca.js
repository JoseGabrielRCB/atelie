import { TETO_PRECO } from "./moeda";

// Validação COMPLETA (acumula TODOS os erros de uma vez) dos campos de uma peça.
// Devolve um mapa de erros por campo: { nome, preco, categoria, "variacao-<i>" }.
// Chaves de variação usam o índice (mesma ordem do array `variacoes`).
//
// Params:
//   form: { nome, precoCentavos, categoria }
//   variacoes: [{ estoque }]  (centavos já tratado fora; aqui só estoque)
//   opcoes: { nomeDuplicado, validarVariacoes }
export function validarPeca(form, variacoes = [], opcoes = {}) {
  const { nomeDuplicado = false, validarVariacoes = true } = opcoes;
  const erros = {};

  const nome = String(form.nome ?? "").trim();
  if (!nome) erros.nome = "Informe o nome da peça.";
  else if (nome.length > 80) erros.nome = "O nome deve ter no máximo 80 caracteres.";
  else if (nomeDuplicado) erros.nome = "Já existe uma peça com esse nome.";

  const centavos = Number(form.precoCentavos ?? 0);
  if (!centavos || centavos <= 0) erros.preco = "Informe um preço válido.";
  else if (centavos / 100 > TETO_PRECO) erros.preco = "Preço acima do permitido.";

  if (!form.categoria) erros.categoria = "Selecione uma categoria.";

  if (validarVariacoes) {
    variacoes.forEach((v, i) => {
      const estoque = Number(v.estoque);
      if (v.estoque === "" || v.estoque == null || !Number.isInteger(estoque) || estoque < 0) {
        erros[`variacao-${i}`] = "Estoque inválido: use um número inteiro maior ou igual a 0.";
      }
    });
  }

  return erros;
}

// Resumo textual com a contagem de problemas (para o bloco-resumo do formulário).
export function resumoErros(erros) {
  const n = Object.keys(erros).length;
  if (n === 0) return "";
  return n === 1
    ? "Há 1 campo com problema. Corrija-o abaixo."
    : `Há ${n} campos com problemas. Corrija-os abaixo.`;
}
