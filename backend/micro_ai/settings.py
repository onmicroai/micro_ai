# \Projects\micro_ai\micro_ai\settings.py

"""
Django settings for Micro AI project.

For more information on this file, see
https://docs.djangoproject.com/en/stable/topics/settings/

For the full list of settings and their values, see
https://docs.djangoproject.com/en/stable/ref/settings/
"""

import os
from pathlib import Path

import environ
from django.utils.translation import gettext_lazy

# Build paths inside the project like this: BASE_DIR / "subdir".
BASE_DIR = Path(__file__).resolve().parent.parent

env = environ.Env()
env.read_env(os.path.join(BASE_DIR, ".env"))

# Quick-start development settings - unsuitable for production
# See https://docs.djangoproject.com/en/stable/howto/deployment/checklist/

# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = env("SECRET_KEY", default="django-insecure-bNAdOT0tBSQF2dofcJ1rJ5a4HgzXokFelavJN0Mh")

# SECURITY WARNING: don"t run with debug turned on in production!
DEBUG = env.bool("DEBUG", default=True)

# Note: It is not recommended to set ALLOWED_HOSTS to "*" in production
ALLOWED_HOSTS = env.list("ALLOWED_HOSTS", default=["*"])
# Keycloak's REST federation provider calls Django at http://web:8000/...
# (keycloak/realm-export.json). Django validates Host against this list;
# without the Docker service name, those lookups 400 once ALLOWED_HOSTS is
# a tight public-domain list.
if "*" not in ALLOWED_HOSTS and "web" not in ALLOWED_HOSTS:
    ALLOWED_HOSTS.append("web")

DOMAIN = env("DOMAIN", default="https://onmicro.ai")

# CloudFront base domain for static assets (no protocol).
CLOUDFRONT_DOMAIN = env(
    "CLOUDFRONT_DOMAIN", default=""
).replace("https://", "").replace("http://", "").strip().strip("/")

# Shared with frontend via the same .env keys (NEXT_PUBLIC_*).
PLATFORM_NAME = env("NEXT_PUBLIC_PLATFORM_NAME", default="OnMicro AI")
LOGO_FILENAME = env("NEXT_PUBLIC_LOGO_FILENAME", default="logo.svg")

# Application definition

DJANGO_APPS = [
    "django.contrib.admin",
    "django.contrib.admindocs",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.sitemaps",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "django.contrib.sites",
    "django.forms",
]

# Put your third-party apps here
THIRD_PARTY_APPS = [
    "allauth",  # allauth account/registration management
    "allauth.account",
    "allauth.socialaccount",
    "allauth.socialaccount.providers.google",
    "django_otp",
    "django_otp.plugins.otp_totp",
    "django_otp.plugins.otp_static",
    "allauth.mfa",
    "rest_framework",
    "rest_framework.authtoken",
    "corsheaders",
    "dj_rest_auth",
    "dj_rest_auth.registration",
    "drf_spectacular",
    "rest_framework_api_key",
    "whitenoise.runserver_nostatic",  # whitenoise runserver
]

# Put your project-specific apps here
PROJECT_APPS = [
    "apps.authentication.apps.AuthenticationConfig",
    "apps.subscriptions.apps.SubscriptionConfig",
    "apps.users.apps.UserConfig",
    "apps.dashboard.apps.DashboardConfig",
    "apps.api.apps.APIConfig",
    "apps.web",
    "apps.microapps",
    "apps.collection",
    "apps.utils",
    "apps.lti",
]

INSTALLED_APPS = DJANGO_APPS + THIRD_PARTY_APPS + PROJECT_APPS

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",  # Required for admin
    "django.middleware.locale.LocaleMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "allauth.account.middleware.AccountMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    'apps.lti.middleware.LTIFrameMiddleware',
]


ROOT_URLCONF = "micro_ai.urls"


# pylti1p3 launch data (state, nonce, JWT body) via DjangoCacheDataStorage.
# pylti1p3 launch state (OIDC nonce, JWT body, deep-link restore) must survive
# across requests and workers; LocMemCache is per-process and breaks deep-link
# picker reloads under gunicorn/uvicorn.
CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.db.DatabaseCache',
        'LOCATION': 'micro_ai_django_cache',
    },
}

# used to disable the cache in dev, but turn it on in production.
# more here: https://nickjanetakis.com/blog/django-4-1-html-templates-are-cached-by-default-with-debug-true
_DEFAULT_LOADERS = [
    "django.template.loaders.filesystem.Loader",
    "django.template.loaders.app_directories.Loader",
]

_CACHED_LOADERS = [("django.template.loaders.cached.Loader", _DEFAULT_LOADERS)]


TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [
            BASE_DIR / "templates",
        ],
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
                "apps.web.context_processors.project_meta",
                # this line can be removed if not using google analytics
                "apps.web.context_processors.google_analytics_id",
                # Add our email context processor
                "apps.web.context_processors.email_context",
            ],
            "loaders": _DEFAULT_LOADERS if DEBUG else _CACHED_LOADERS,
        },
    },
]

WSGI_APPLICATION = "micro_ai.wsgi.application"
ASGI_APPLICATION = "micro_ai.asgi.application"

FORM_RENDERER = "django.forms.renderers.TemplatesSetting"

# Database
# https://docs.djangoproject.com/en/stable/ref/settings/#databases

if "DATABASE_URL" in env:
    DATABASES = {"default": env.db()}
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": env("DJANGO_DATABASE_NAME", default="micro_ai"),
            "USER": env("DJANGO_DATABASE_USER", default="postgres"),
            "PASSWORD": env("DJANGO_DATABASE_PASSWORD", default="***"),
            "HOST": env("DJANGO_DATABASE_HOST", default="localhost"),
            "PORT": env("DJANGO_DATABASE_PORT", default="5432"),
        }
    }

# Auth / login stuff

# Django recommends overriding the user model even if you don"t think you need to because it makes
# future changes much easier.
AUTH_USER_MODEL = "users.CustomUser"
LOGIN_URL = "account_login"
LOGIN_REDIRECT_URL = "/"

# Password validation
# https://docs.djangoproject.com/en/stable/ref/settings/#auth-password-validators

AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
        "OPTIONS": {
            "min_length": 8,
        }
    },
    {
        "NAME": "django.contrib.auth.password_validation.CommonPasswordValidator",
    },
    {
        "NAME": "apps.authentication.validators.UppercaseValidator",
    },
]

# Allauth setup
ACCOUNT_ADAPTER = "apps.users.adapter.AcceptInvitationAdapter"
ACCOUNT_AUTHENTICATION_METHOD = "email"
ACCOUNT_EMAIL_REQUIRED = True
ACCOUNT_EMAIL_SUBJECT_PREFIX = ""
ACCOUNT_EMAIL_UNKNOWN_ACCOUNTS = False  # don't send "forgot password" emails to unknown accounts
ACCOUNT_CONFIRM_EMAIL_ON_GET = True
ACCOUNT_UNIQUE_EMAIL = True
ACCOUNT_USERNAME_REQUIRED = False
ACCOUNT_SIGNUP_PASSWORD_ENTER_TWICE = True
ACCOUNT_SESSION_REMEMBER = True
ACCOUNT_LOGOUT_ON_GET = True
ACCOUNT_LOGIN_ON_EMAIL_CONFIRMATION = True
ACCOUNT_LOGIN_BY_CODE_ENABLED = True


SOCIALACCOUNT_FORMS = {
    "signup": "apps.users.forms.CustomSocialSignupForm",
}


# User signup configuration: change to "mandatory" to require users to confirm email before signing in.
# or "optional" to send confirmation emails but not require them
ACCOUNT_EMAIL_VERIFICATION = env("ACCOUNT_EMAIL_VERIFICATION", default="mandatory")

AUTHENTICATION_BACKENDS = (
    # Needed to login by username in Django admin, regardless of `allauth`
    "django.contrib.auth.backends.ModelBackend",
    # `allauth` specific authentication methods, such as login by e-mail
    "allauth.account.auth_backends.AuthenticationBackend",
)

# enable social login
SOCIALACCOUNT_PROVIDERS = {
    "google": {
        "SCOPE": [
            "profile",
            "email",
        ],
        "AUTH_PARAMS": {
            "access_type": "online",
        },
    },
}

# For turnstile captchas
TURNSTILE_KEY = env("TURNSTILE_KEY", default=None)
TURNSTILE_SECRET = env("TURNSTILE_SECRET", default=None)


# Internationalization
# https://docs.djangoproject.com/en/stable/topics/i18n/

LANGUAGE_CODE = "en-us"

TIME_ZONE = "UTC"

USE_I18N = False

USE_TZ = True


# Static files (CSS, JavaScript, Images)
# https://docs.djangoproject.com/en/stable/howto/static-files/

STATIC_ROOT = BASE_DIR / "static_root"
STATIC_URL = "/static/"

STATICFILES_DIRS = []

# AWS Configuration
AWS_ACCESS_KEY_ID = env("AWS_ACCESS_KEY_ID", default="")
AWS_SECRET_ACCESS_KEY = env("AWS_SECRET_ACCESS_KEY", default="")
AWS_STORAGE_BUCKET_NAME = env("AWS_STORAGE_BUCKET_NAME", default="")
AWS_S3_REGION_NAME = env("AWS_S3_REGION_NAME", default="")
AWS_ACCOUNT_ID = env("AWS_ACCOUNT_ID", default="")
AWS_S3_SIGNATURE_VERSION = "s3v4"
AWS_S3_FILE_OVERWRITE = False
AWS_DEFAULT_ACL = None
AWS_S3_VERIFY = True

STORAGES = {
    "default": {
        "BACKEND": "django.core.files.storage.FileSystemStorage",
    },
    "staticfiles": {
        # swap these to use manifest storage to bust cache when files change
        # note: this may break image references in sass/css files which is why it is not enabled by default
        # "BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage",
        "BACKEND": "whitenoise.storage.CompressedStaticFilesStorage",
    },
}

MEDIA_ROOT = env.path("MEDIA_ROOT", default=str(BASE_DIR / "media"))
MEDIA_URL = "/media/"

# Default primary key field type
# https://docs.djangoproject.com/en/stable/ref/settings/#default-auto-field

# future versions of Django will use BigAutoField as the default, but it can result in unwanted library
# migration files being generated, so we stick with AutoField for now.
# change this to BigAutoField if you"re sure you want to use it and aren"t worried about migrations.
DEFAULT_AUTO_FIELD = "django.db.models.AutoField"

# Removes deprecation warning for future compatibility.
# see https://adamj.eu/tech/2023/12/07/django-fix-urlfield-assume-scheme-warnings/ for details.
FORMS_URLFIELD_ASSUME_HTTPS = True

# Email setup
# ------------------------------------------------------------------------------
# Default (no external SMTP credentials): Django SMTP to a local MTA / Postfix-style relay —
# plain SMTP, port 25, no STARTTLS, no SMTP AUTH (Open edX–style).
#
# Docker Compose sets EMAIL_HOST=host.docker.internal when unset so containers reach Postfix on the
# host (Linux: extra_hosts host-gateway). Bare-metal dev: omit EMAIL_HOST → localhost.
#
# External relay (e.g. AWS SES SMTP): set EMAIL_HOST_USER and EMAIL_HOST_PASSWORD. If EMAIL_HOST is
# still empty or host.docker.internal (Compose default), settings use SES SMTP endpoint defaults.

_explicit_email_backend = env("EMAIL_BACKEND", default="").strip()
_smtp_backend = "django.core.mail.backends.smtp.EmailBackend"

if _explicit_email_backend:
    EMAIL_BACKEND = _explicit_email_backend
else:
    EMAIL_BACKEND = _smtp_backend

_email_user = env("EMAIL_HOST_USER", default="").strip()
_email_password = env("EMAIL_HOST_PASSWORD", default="").strip()
_has_smtp_auth = bool(_email_user and _email_password)

if EMAIL_BACKEND == _smtp_backend and _has_smtp_auth:
    _smtp_host = env("EMAIL_HOST", default="").strip()
    _compose_local_relay = _smtp_host in ("", "host.docker.internal")
    if _compose_local_relay:
        EMAIL_HOST = "email-smtp.us-east-1.amazonaws.com"
        EMAIL_PORT = 587
        EMAIL_USE_TLS = True
        EMAIL_USE_SSL = False
    else:
        EMAIL_HOST = _smtp_host
        EMAIL_PORT = env.int("EMAIL_PORT", default=587)
        EMAIL_USE_TLS = env.bool("EMAIL_USE_TLS", default=True)
        EMAIL_USE_SSL = env.bool("EMAIL_USE_SSL", default=False)
    EMAIL_HOST_USER = _email_user
    EMAIL_HOST_PASSWORD = _email_password
else:
    EMAIL_HOST = env("EMAIL_HOST", default="localhost").strip() or "localhost"
    EMAIL_PORT = env.int("EMAIL_PORT", default=25)
    EMAIL_USE_TLS = env.bool("EMAIL_USE_TLS", default=False)
    EMAIL_USE_SSL = env.bool("EMAIL_USE_SSL", default=False)
    EMAIL_HOST_USER = ""
    EMAIL_HOST_PASSWORD = ""

DEFAULT_FROM_EMAIL = env("DEFAULT_FROM_EMAIL", default="webmaster@localhost") or "webmaster@localhost"

# use in production with Mailgun etc.: https://github.com/anymail/django-anymail
# EMAIL_BACKEND = "anymail.backends.mailgun.EmailBackend"

EMAIL_SUBJECT_PREFIX = "[OnMicro.AI] "

# Django sites

SITE_ID = 1

# DRF config
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "apps.authentication.keycloak_auth.KeycloakAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": ("apps.api.permissions.IsAuthenticatedOrHasUserAPIKey",),
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 100,
    "DEFAULT_THROTTLE_RATES": {
        "add_admin": "20/hour",
        "federation_password_check": "10/hour",
    },
}

PRODUCTION = env.bool('PRODUCTION', default=False)
is_production = PRODUCTION
cookies_domain = os.getenv('COOKIES_DOMAIN', None) if is_production else None

# Trust the X-Forwarded-Proto header set by the nginx reverse proxy so that
# request.is_secure() returns True behind TLS termination. This is required for
# LTI: pylti1p3 only marks its state/nonce cookies "Secure; SameSite=None" (and
# therefore sendable inside a cross-site LMS iframe) when request.is_secure() is
# True. nginx always sets this header to the real scheme, overriding any client
# value, so trusting it here is safe. (Also declared in settings_production.py.)
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

# LTI 1.3 launches run inside a cross-site LMS iframe. pylti1p3's session-id cookie
# must use SameSite=None; Secure on every /lti/login/ and /lti/launch/ request.
# Default to True when the public DOMAIN is HTTPS (e.g. dev.onmicro.ai) so cookie
# behaviour stays consistent even if a proxy header is missing on one hop.
LTI_CROSS_SITE_COOKIES = env.bool(
    'LTI_CROSS_SITE_COOKIES',
    default=str(DOMAIN).startswith('https://'),
)

# SameSite cookie configuration for production vs development
SAMESITE_SETTING = 'None' if is_production else 'Lax'

# Keycloak resource-server config — validates tokens minted by the realm's
# own Keycloak (keycloak/realm-export.json), never issues any itself.
KEYCLOAK_REALM = env("KEYCLOAK_REALM", default="onmicro")
# Must match the token's `iss` claim exactly — this is the public URL
# (KC_HOSTNAME in docker-compose*.yml), reachable from the browser.
KEYCLOAK_ISSUER = env(
    "KEYCLOAK_ISSUER",
    default=f"{DOMAIN}/auth/realms/{KEYCLOAK_REALM}",
)
# Where Django actually fetches JWKS from — container-to-container via the
# Docker service name, since "localhost" in KEYCLOAK_ISSUER means the web
# container itself, not the keycloak container, from inside Django.
KEYCLOAK_JWKS_URL = env(
    "KEYCLOAK_JWKS_URL",
    default=f"http://keycloak:8080/auth/realms/{KEYCLOAK_REALM}",
)
KEYCLOAK_AUDIENCE = env("KEYCLOAK_AUDIENCE", default="onmicro-spa")

# REST federation (apps/authentication/federation_views.py) — the Bearer
# token Keycloak's "User migration using a REST client" provider sends on
# every call to the two federation endpoints. No default: an empty secret
# would make HasFederationSharedSecret reject every request, which is the
# correct fail-closed behavior if this isn't configured.
KEYCLOAK_FEDERATION_SHARED_SECRET = env("KEYCLOAK_FEDERATION_SHARED_SECRET", default="")

# Keycloak → Django federation is plain HTTP on the internal Docker network
# (no nginx, no X-Forwarded-Proto). settings_production.py turns on
# SECURE_SSL_REDIRECT, which would otherwise 301 those GETs to
# https://web:8000/... — uvicorn does not terminate TLS, the provider's
# HttpClient follows the redirect, the handshake fails, and every legacy
# login is logged as "User not found in external repository".
# Matched against request.path.lstrip("/").
SECURE_REDIRECT_EXEMPT = [r"^api/auth/federation/"]

REST_AUTH = {
    "USER_DETAILS_SERIALIZER": "apps.users.serializers.CustomUserSerializer",
}
    
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOWED_ORIGINS = env.list("CORS_ALLOWED_ORIGINS")
CSRF_TRUSTED_ORIGINS = env.list("CSRF_TRUSTED_ORIGINS")
CSRF_COOKIE_SECURE = is_production
CSRF_COOKIE_SAMESITE = SAMESITE_SETTING

SPECTACULAR_SETTINGS = {
    "TITLE": "OnMicro.AI",
    "DESCRIPTION": "Build Micro Apps with No Code",
    "VERSION": "0.1.0",
    "SERVE_INCLUDE_SCHEMA": False,
    "SWAGGER_UI_SETTINGS": {
        "displayOperationId": True,
    },
    "PREPROCESSING_HOOKS": [
        "apps.api.schema.filter_schema_apis",
    ],
    "APPEND_COMPONENTS": {
        "securitySchemes": {"ApiKeyAuth": {"type": "apiKey", "in": "header", "name": "Authorization"}}
    },
    "SECURITY": [
        {
            "ApiKeyAuth": [],
        }
    ],
}

# replace any values below with specifics for your project
PROJECT_METADATA = {
    "NAME": gettext_lazy("OnMicro.AI"),
    "URL": env("DOMAIN", default="http://localhost"),
    "DESCRIPTION": gettext_lazy("Build Micro Apps with No Code"),
    "IMAGE": "/static/images/web/favicon.png",
    "KEYWORDS": "SaaS, django",
    "CONTACT_EMAIL": ["yibrahim@knysys.com", "john@curricu.me"],
}

# set this to True in production to have URLs generated with https instead of http
USE_HTTPS_IN_ABSOLUTE_URLS = env.bool("USE_HTTPS_IN_ABSOLUTE_URLS", default=False)

ADMINS = [("Yibrahim", "yibrahim@knysys.com"), ("John", "john@curricu.me")]

# Add your google analytics ID to the environment to connect to Google Analytics
GOOGLE_ANALYTICS_ID = env("GOOGLE_ANALYTICS_ID", default="")


# Stripe config — all optional. Leave empty to run without Stripe (free plan only).
# Use test keys in dev/staging and live keys in production (one pair per environment).
STRIPE_PUBLIC_KEY = env("STRIPE_PUBLIC_KEY", default="")
STRIPE_SECRET_KEY = env("STRIPE_SECRET_KEY", default="")
STRIPE_WEBHOOK_SECRET = env("STRIPE_WEBHOOK_SECRET_KEY", default="")
STRIPE_ENABLED = bool(STRIPE_SECRET_KEY)

PRO_PLAN_PRICE_ID = env("INDIVIDUAL_PLAN_PRICE_ID", default="")
ENTERPRISE_PLAN_PRICE_ID = env("ENTERPRISE_PLAN_PRICE_ID", default="")
TOP_UP_CREDITS_PLAN_ID = env("TOP_UP_CREDITS_PLAN_ID", default="")
TOP_UP_CREDITS = env.int("TOP_UP_CREDITS", default=200000)
DEFAULT_PORTAL_CONFIGURATION_ID = env("DEFAULT_PORTAL_CONFIGURATION_ID", default="")

# Monthly credit limit for all users when Stripe is not configured.
# billing cycle auto-renews on expiry.
FREE_PLAN_CREDIT_LIMIT = env.int("FREE_PLAN_CREDIT_LIMIT", default=10_000)

# LiteLLM Configuration
LITELLM_BASE_URL = env("LITELLM_BASE_URL", default="http://om-litellm:4000")
LITELLM_API_KEY = env("LITELLM_MASTER_KEY", default="")

# Score Analysis: "Why students get points off" — optional LLM (LiteLLM)
SCORE_ANALYSIS_INSIGHT_LLM_ENABLED = env.bool("SCORE_ANALYSIS_INSIGHT_LLM_ENABLED", default=True)
# Model name must exist in UsageVariables / LiteLLM (e.g. gpt-4o-mini)
SCORE_ANALYSIS_INSIGHT_MODEL = env("SCORE_ANALYSIS_INSIGHT_MODEL", default="gpt-4o-mini")

SILENCED_SYSTEM_CHECKS = [
]

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "verbose": {
            "format": '[{asctime}] {levelname} "{name}" {message}',
            "style": "{",
            "datefmt": "%d/%b/%Y %H:%M:%S",  # match Django server time format
        },
    },
    "handlers": {
        "console": {"class": "logging.StreamHandler", "formatter": "verbose"},
    },
    "loggers": {
        "django": {
            "handlers": ["console"],
            "level": env("DJANGO_LOG_LEVEL", default="INFO"),
        },
        "micro_ai": {
            "handlers": ["console"],
            "level": env("MICRO_AI_LOG_LEVEL", default="INFO"),
        },
    },
}

# Session settings - limit sessions to admin only
SESSION_COOKIE_NAME = 'sessionid'
SESSION_COOKIE_PATH = '/admin/'  # Only set session cookie for admin paths
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SECURE = is_production
SESSION_COOKIE_SAMESITE = SAMESITE_SETTING  # Dynamic: None in prod, Lax in dev