"""Middlewares do catálogo."""

from django.conf import settings


class ContentSecurityPolicyMiddleware:
    """Adiciona um header ``Content-Security-Policy`` básico (opcional, env-gated).

    Ligado apenas quando ``settings.CSP_ENABLED`` é True; a política vem de
    ``settings.CSP_POLICY``. Sem dependências externas. Não sobrescreve uma CSP
    já definida por uma camada anterior (usa ``setdefault``).
    """

    def __init__(self, get_response):
        self.get_response = get_response
        self.policy = getattr(settings, "CSP_POLICY", "default-src 'self'")

    def __call__(self, request):
        response = self.get_response(request)
        response.setdefault("Content-Security-Policy", self.policy)
        return response
