"""Middlewares do catálogo."""

from django.conf import settings
from django.utils.cache import patch_vary_headers


class CacheControlMiddleware:
    """Define ``Cache-Control`` para nunca cachear conteúdo privado/autenticado.

    - **Privado** (`no-store, private`): requisições com header ``Authorization``
      (JWT do admin/cliente), rotas de autenticação/conta/identidade/admin (login,
      refresh, cadastro, `/conta/*`, `/me/*`, `/admin/*`) ou sessão autenticada.
      Assim navegador/proxy/CDN nunca guardam dados de conta/admin nem tokens.
    - **Público** (catálogo): `GET` em `/api/*` sem autenticação ganha um cache
      curto opcional (`public, max-age=60`) com ``Vary: Authorization`` (não mistura
      a resposta pública com a de um usuário autenticado na mesma URL).
    - `/media` e `/static` não são tocados (deixe o storage/CDN cuidar).
    """

    # Rotas sensíveis SEM header Authorization (tokens/sessão): login, refresh,
    # cadastro, conta, identidade e o Django admin.
    PRIVADO_PREFIXOS = ("/api/auth", "/api/conta", "/api/me", "/admin")

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        caminho = request.path
        if not (caminho.startswith("/api/") or caminho.startswith("/admin")):
            return response

        if self._privado(request, caminho):
            response["Cache-Control"] = "no-store, private"
            response["Pragma"] = "no-cache"
        elif request.method in ("GET", "HEAD") and not response.has_header("Cache-Control"):
            response["Cache-Control"] = "public, max-age=60"
            patch_vary_headers(response, ("Authorization",))
        return response

    @staticmethod
    def _privado(request, caminho):
        if request.META.get("HTTP_AUTHORIZATION"):
            return True
        user = getattr(request, "user", None)
        if user is not None and user.is_authenticated:
            return True
        return caminho.startswith(CacheControlMiddleware.PRIVADO_PREFIXOS)


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
