"""Validadores reutilizáveis do catálogo (CPF, etc.).

Mensagens em PT-BR. Não logam o valor recebido (dados sensíveis — LGPD).
"""

from django.core.exceptions import ValidationError


def so_digitos(valor) -> str:
    """Devolve apenas os dígitos de ``valor`` (str vazia se None)."""
    return "".join(c for c in str(valor or "") if c.isdigit())


def cpf_valido(valor) -> bool:
    """True se ``valor`` é um CPF válido (11 dígitos + dígitos verificadores)."""
    cpf = so_digitos(valor)
    if len(cpf) != 11:
        return False
    # Rejeita sequências repetidas (000..., 111..., etc.) — passam na conta dos
    # dígitos mas não são CPFs válidos.
    if cpf == cpf[0] * 11:
        return False
    for tamanho in (9, 10):
        soma = sum(int(cpf[i]) * (tamanho + 1 - i) for i in range(tamanho))
        resto = (soma * 10) % 11
        digito = 0 if resto == 10 else resto
        if digito != int(cpf[tamanho]):
            return False
    return True


def validar_cpf(valor):
    """Validador de model/serializer: levanta ``ValidationError`` se inválido."""
    if not cpf_valido(valor):
        raise ValidationError("CPF inválido.")
