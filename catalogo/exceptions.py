"""Tratamento de erros da API com mensagens claras em PT-BR."""

from rest_framework.views import exception_handler


def tratador_de_excecoes(exc, context):
    """
    Envolve o handler padrão do DRF para garantir respostas de erro
    consistentes e nunca falhar em silêncio.

    Mantém o corpo de erro original do DRF (que já traz as mensagens dos
    validadores por campo, em PT-BR via LANGUAGE_CODE). O campo genérico
    "detalhe" é só um *fallback*: só é adicionado quando a resposta não tem
    nenhuma informação útil (sem "detail" e sem erros de campo). Assim os
    erros específicos (ex.: {"tamanho": ["..."]}) nunca são obscurecidos e o
    cliente consegue exibir qual campo falhou e por quê.
    """
    resposta = exception_handler(exc, context)

    if resposta is None:
        # Erro não tratado pelo DRF (ex.: exceção inesperada). Em DEBUG o
        # Django ainda mostra o traceback; aqui apenas garantimos que, se
        # chegar uma resposta, ela seja informativa.
        return resposta

    if isinstance(resposta.data, dict) and not resposta.data:
        # Só preenche o fallback quando não há nenhum erro específico.
        resposta.data["detalhe"] = (
            "Não foi possível processar a requisição. Verifique os dados enviados."
        )

    return resposta
