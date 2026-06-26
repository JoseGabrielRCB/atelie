"""
Configurações do projeto do Ateliê.

Todos os segredos e parâmetros sensíveis são lidos de variáveis de ambiente
(arquivo .env) via django-environ. Nada de credenciais no código.
"""

from datetime import timedelta
from pathlib import Path

import environ
from django.core.exceptions import ImproperlyConfigured

BASE_DIR = Path(__file__).resolve().parent.parent

# --------------------------------------------------------------------------
# Leitura do ambiente (.env)
# --------------------------------------------------------------------------
env = environ.Env(
    DEBUG=(bool, False),
    ALLOWED_HOSTS=(list, ["localhost", "127.0.0.1"]),
    CORS_ALLOWED_ORIGINS=(list, []),
    DB_PORT=(int, 5432),
    WHATSAPP_DONO=(list, []),
    WHATSAPP_DONO_LID=(list, []),
    ESTOQUE_BAIXO_LIMIAR=(int, 1),
)

# Carrega o .env se existir (em produção as vars podem vir do próprio ambiente)
env_file = BASE_DIR / ".env"
if env_file.exists():
    environ.Env.read_env(env_file)

DEBUG = env("DEBUG")

# SECRET_KEY: SEMPRE do ambiente. Em produção (DEBUG=False) é OBRIGATÓRIA e forte
# — sem default inseguro: o boot FALHA se faltar/for fraca. Em dev usa um default
# só por conveniência (nunca vai para produção).
_DEV_SECRET = "dev-only-insecure-key-troque-em-producao-0123456789abcdef"
_SECRETS_INSEGUROS = {
    "",
    "insecure-dev-key-troque-em-producao",
    "troque-esta-chave-em-producao",
    _DEV_SECRET,
}
SECRET_KEY = env("SECRET_KEY", default="")
if SECRET_KEY in _SECRETS_INSEGUROS or len(SECRET_KEY) < 50:
    if DEBUG:
        SECRET_KEY = _DEV_SECRET  # só para desenvolvimento local
    else:
        raise ImproperlyConfigured(
            "SECRET_KEY ausente ou fraca em produção. Defina uma chave forte na "
            "variável de ambiente SECRET_KEY (>= 50 caracteres). Gere com: "
            'python -c "from django.core.management.utils import '
            'get_random_secret_key; print(get_random_secret_key())"'
        )

# ALLOWED_HOSTS restritos ao(s) domínio(s) real(is) em produção (nunca "*").
ALLOWED_HOSTS = env("ALLOWED_HOSTS")
if not DEBUG and (not ALLOWED_HOSTS or "*" in ALLOWED_HOSTS):
    raise ImproperlyConfigured(
        "ALLOWED_HOSTS deve listar os domínios reais em produção (sem '*')."
    )

# --------------------------------------------------------------------------
# Apps
# --------------------------------------------------------------------------
INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # Terceiros
    "rest_framework",
    "rest_framework_simplejwt",
    "rest_framework_simplejwt.token_blacklist",  # revoga refresh no logout
    "corsheaders",
    "django_filters",
    # Local
    "catalogo",
    # Apaga arquivos físicos órfãos ao excluir/trocar ImageField. DEVE ser o
    # último app (conecta os signals depois de todos os models carregados).
    "django_cleanup.apps.CleanupConfig",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    # Cache-Control: privado=no-store (conta/admin/tokens), público=cache curto.
    "catalogo.middleware.CacheControlMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"

# --------------------------------------------------------------------------
# Banco de dados — PostgreSQL
# --------------------------------------------------------------------------
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": env("DB_NAME", default="atelie"),
        "USER": env("DB_USER", default="atelie"),
        "PASSWORD": env("DB_PASSWORD", default="atelie"),
        "HOST": env("DB_HOST", default="localhost"),
        "PORT": env("DB_PORT"),
    }
}

# --------------------------------------------------------------------------
# Validação de senha
# --------------------------------------------------------------------------
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# --------------------------------------------------------------------------
# Internacionalização — interface em PT-BR
# --------------------------------------------------------------------------
LANGUAGE_CODE = "pt-br"
TIME_ZONE = "America/Recife"
USE_I18N = True
USE_TZ = True

# --------------------------------------------------------------------------
# Arquivos estáticos e de mídia (uploads de imagem)
# --------------------------------------------------------------------------
STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

MEDIA_URL = "media/"
MEDIA_ROOT = BASE_DIR / "media"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# --------------------------------------------------------------------------
# Django REST Framework
# --------------------------------------------------------------------------
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticatedOrReadOnly",
    ),
    "DEFAULT_FILTER_BACKENDS": (
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ),
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 20,
    "EXCEPTION_HANDLER": "catalogo.exceptions.tratador_de_excecoes",
    # Throttling GLOBAL (anti-abuso) + escopos específicos. Anônimo por IP; logado
    # por usuário (mais alto). Webhooks são isentos (throttle_classes=[] na view).
    "DEFAULT_THROTTLE_CLASSES": (
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
    ),
    "DEFAULT_THROTTLE_RATES": {
        "anon": "120/min",       # navegação pública (vitrine etc.) por IP
        "user": "240/min",       # autenticado (admin/cliente) por usuário
        "login": "10/min",       # autenticação por IP (anti brute-force)
        "encomendas": "10/hour",  # endpoints públicos sensíveis (cadastro/encomenda/cupom/checkout)
    },
}

# IP real atrás de proxy/load balancer. Por padrão (None) o DRF usa REMOTE_ADDR
# (seguro). Em produção atrás de N proxies confiáveis, defina NUM_PROXIES=N para o
# throttle ler o X-Forwarded-For na posição certa — sem confiar cegamente no header.
_num_proxies = env("NUM_PROXIES", default="")
if str(_num_proxies) != "":
    REST_FRAMEWORK["NUM_PROXIES"] = int(_num_proxies)

# --------------------------------------------------------------------------
# JWT (djangorestframework-simplejwt)
# --------------------------------------------------------------------------
SIMPLE_JWT = {
    # Access curto (renovado pelo refresh; o front renova sozinho em 401).
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=env.int("JWT_ACCESS_MIN", default=30)),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=env.int("JWT_REFRESH_DAYS", default=7)),
    "AUTH_HEADER_TYPES": ("Bearer",),
    # O logout REVOGA o refresh de fato (blacklist via app token_blacklist).
    # Rotação desligada por padrão: evita corrida de refresh concorrente no SPA
    # (vários 401 simultâneos invalidariam o refresh um do outro). Quando ligada,
    # BLACKLIST_AFTER_ROTATION garante que o refresh antigo seja revogado.
    "ROTATE_REFRESH_TOKENS": env.bool("JWT_ROTATE_REFRESH", default=False),
    "BLACKLIST_AFTER_ROTATION": True,
}
# Sem dados sensíveis nas claims do JWT: só `papel`/`acesso_financeiro` (admin) e
# `audiencia="cliente"` — nunca CPF, senha ou segredos.

# --------------------------------------------------------------------------
# CORS — apenas a(s) origem(ns) do frontend (lista explícita; nunca "allow all").
# --------------------------------------------------------------------------
CORS_ALLOWED_ORIGINS = env("CORS_ALLOWED_ORIGINS")
# Não usamos CORS_ALLOW_ALL_ORIGINS — a lista acima é a fonte da verdade.
if not DEBUG and not CORS_ALLOWED_ORIGINS:
    raise ImproperlyConfigured(
        "CORS_ALLOWED_ORIGINS deve listar a(s) origem(ns) do frontend em produção."
    )

# --------------------------------------------------------------------------
# Segurança de transporte e headers (endurecido para produção).
# Em DEBUG (dev) os redirects/cookies seguros ficam DESLIGADOS para o
# http://localhost funcionar; em produção (DEBUG=False) ligam por padrão e podem
# ser ajustados por env. `python manage.py check --deploy` fica limpo em produção.
# --------------------------------------------------------------------------
_PROD = not DEBUG

# Redireciona HTTP→HTTPS e HSTS (cabeçalho que obriga HTTPS por um período).
SECURE_SSL_REDIRECT = env.bool("SECURE_SSL_REDIRECT", default=_PROD)
SECURE_HSTS_SECONDS = env.int("SECURE_HSTS_SECONDS", default=31536000 if _PROD else 0)
SECURE_HSTS_INCLUDE_SUBDOMAINS = env.bool("SECURE_HSTS_INCLUDE_SUBDOMAINS", default=_PROD)
SECURE_HSTS_PRELOAD = env.bool("SECURE_HSTS_PRELOAD", default=_PROD)

# Cookies (sessão do Django admin e CSRF) só por HTTPS em produção.
SESSION_COOKIE_SECURE = env.bool("SESSION_COOKIE_SECURE", default=_PROD)
CSRF_COOKIE_SECURE = env.bool("CSRF_COOKIE_SECURE", default=_PROD)

# Atrás de proxy/load balancer que TERMINA o TLS (Nginx, ALB, Cloud Run): confia
# no header que diz se a requisição original era HTTPS. Ligue via env nesse caso.
if env.bool("USE_X_FORWARDED_PROTO", default=False):
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

# Headers de segurança (seguros também em dev).
SECURE_CONTENT_TYPE_NOSNIFF = True          # impede MIME-sniffing
SECURE_REFERRER_POLICY = "same-origin"      # não vaza a URL para terceiros
X_FRAME_OPTIONS = "DENY"                     # anti-clickjacking (nega iframes)

# Content-Security-Policy básica (OPCIONAL, env-gated). A SPA do cliente é servida
# FORA do Django (Vite/host estático), então a CSP "real" dela vive nesse host/CDN;
# aqui é uma camada extra para o que o Django serve (admin, mídia, browsable API).
# Desligada por padrão para não quebrar o Django admin sem teste — ligue com
# CSP_ENABLED=True após validar.
CSP_ENABLED = env.bool("CSP_ENABLED", default=False)
CSP_POLICY = env(
    "CSP_POLICY",
    default=(
        "default-src 'self'; img-src 'self' data:; "
        "style-src 'self' 'unsafe-inline'; script-src 'self'; "
        "object-src 'none'; frame-ancestors 'none'; base-uri 'self'"
    ),
)
if CSP_ENABLED:
    MIDDLEWARE = MIDDLEWARE + ["catalogo.middleware.ContentSecurityPolicyMiddleware"]

# --------------------------------------------------------------------------
# Pagamento online — Mercado Pago (Checkout Pro)
# Segredos SOMENTE via ambiente; nunca no código, nunca logados.
# --------------------------------------------------------------------------
# Access token do Mercado Pago (servidor). Vazio em dev/testes.
MP_ACCESS_TOKEN = env("MP_ACCESS_TOKEN", default="")
# Segredo para validar a assinatura HMAC do webhook.
MP_WEBHOOK_SECRET = env("MP_WEBHOOK_SECRET", default="")
# Base HTTPS pública do backend (para notification_url do webhook).
MP_PUBLIC_URL = env("MP_PUBLIC_URL", default="http://localhost:8000")
# Base do frontend (para as back_urls de sucesso/pendente/falha).
FRONTEND_URL = env("FRONTEND_URL", default="http://localhost:5173")

# --------------------------------------------------------------------------
# Bot de WhatsApp do DONO (privado) — Evolution API (não-oficial, Baileys).
# Uso interno do ateliê: alertas de estoque e comandos do dono. NUNCA fala com
# clientes. Use um número de telefone DEDICADO (risco de banimento).
# Segredos SOMENTE via ambiente. Defaults vazios = recurso desligado em dev.
# --------------------------------------------------------------------------
# URL base da Evolution API (ex.: http://localhost:8080 no host, ou
# http://evolution-api:8080 dentro da rede do compose).
EVOLUTION_URL = env("EVOLUTION_URL", default="")
# Chave global da Evolution (header "apikey" em todas as chamadas).
EVOLUTION_API_KEY = env("EVOLUTION_API_KEY", default="")
# Nome da instância criada na Evolution (ex.: "atelie-bot").
EVOLUTION_INSTANCE = env("EVOLUTION_INSTANCE", default="")
# URL que a Evolution chama para entregar mensagens recebidas.
EVOLUTION_WEBHOOK_URL = env(
    "EVOLUTION_WEBHOOK_URL",
    default="http://backend:8000/api/webhooks/whatsapp/",
)
# Números autorizados (LISTA, separados por vírgula). Recebem alertas e podem
# comandar o bot. Apenas dígitos, formato internacional (ex.: 5567999990000).
WHATSAPP_DONO = env("WHATSAPP_DONO")
# LIDs autorizados para ENTRADA (LISTA, separados por vírgula). A Evolution/
# Baileys pode entregar mensagens como "8712...@lid" em vez do telefone.
# Estes ids só autorizam comandos recebidos; o envio continua indo ao telefone
# em WHATSAPP_DONO.
WHATSAPP_DONO_LID = env("WHATSAPP_DONO_LID")
# Limiar de estoque baixo: variações com estoque <= este valor disparam alerta.
ESTOQUE_BAIXO_LIMIAR = env("ESTOQUE_BAIXO_LIMIAR")
