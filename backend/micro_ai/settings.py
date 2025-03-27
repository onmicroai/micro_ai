# \Projects\micro_ai\micro_ai\settings.py

"""
Django settings for Micro AI project.

For more information on this file, see
https://docs.djangoproject.com/en/stable/topics/settings/

For the full list of settings and their values, see
https://docs.djangoproject.com/en/stable/ref/settings/
"""

import os
from datetime import timedelta
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

DOMAIN = env("DOMAIN", default="https://onmicro.ai")

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
    "rest_framework_simplejwt",
    "rest_framework_simplejwt.token_blacklist",  # Add token blacklist support
    "corsheaders",
    "dj_rest_auth",
    "dj_rest_auth.registration",
    "drf_spectacular",
    "rest_framework_api_key",
    "celery_progress",
    "djstripe",  # stripe integration
    "whitenoise.runserver_nostatic",  # whitenoise runserver
    "waffle",
    "django_celery_beat",
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
    "apps.collection"
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
    "waffle.middleware.WaffleMiddleware",
    'micro_ai.middleware.JWTRefreshTokenMiddleware',
]


ROOT_URLCONF = "micro_ai.urls"


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

TOTP_ISSUER = "OnMicro.AI"

ACCOUNT_FORMS = {
    "signup": "apps.teams.forms.TeamSignupForm",
}
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

STATICFILES_DIRS = [
    BASE_DIR / "assets",
    
]

# AWS Configuration
AWS_ACCESS_KEY_ID = env("AWS_ACCESS_KEY_ID")
AWS_SECRET_ACCESS_KEY = env("AWS_SECRET_ACCESS_KEY")
AWS_STORAGE_BUCKET_NAME = env("AWS_STORAGE_BUCKET_NAME")
AWS_S3_REGION_NAME = env("AWS_S3_REGION_NAME")
AWS_ACCOUNT_ID = env("AWS_ACCOUNT_ID")
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

MEDIA_ROOT = BASE_DIR / "media"
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

# use in development
# EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"

EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
EMAIL_HOST = 'email-smtp.us-east-1.amazonaws.com'
EMAIL_PORT = 587  # or 25, 2587
EMAIL_USE_TLS = True  # STARTTLS
EMAIL_HOST_USER = env("EMAIL_HOST_USER")
EMAIL_HOST_PASSWORD = env("EMAIL_HOST_PASSWORD")
DEFAULT_FROM_EMAIL = env("DEFAULT_FROM_EMAIL")

# use in production
# see https://github.com/anymail/django-anymail for more details/examples
# EMAIL_BACKEND = "anymail.backends.mailgun.EmailBackend"

EMAIL_SUBJECT_PREFIX = "[OnMicro.AI] "

# Django sites

SITE_ID = 1

# DRF config
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": ("apps.api.permissions.IsAuthenticatedOrHasUserAPIKey",),
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 100,
}

is_production = os.getenv('PRODUCTION', 'False') == 'True'
cookies_domain = os.getenv('COOKIES_DOMAIN', None) if is_production else None

# Get token lifetime settings from environment with fallbacks
ACCESS_TOKEN_LIFETIME_MINUTES = env.float("ACCESS_TOKEN_LIFETIME_MINUTES", default=60.0)
REFRESH_TOKEN_LIFETIME_DAYS = env.float("REFRESH_TOKEN_LIFETIME_DAYS", default=7.0)

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=ACCESS_TOKEN_LIFETIME_MINUTES),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=REFRESH_TOKEN_LIFETIME_DAYS),
    "ROTATE_REFRESH_TOKENS": False,
    "BLACKLIST_AFTER_ROTATION": True,
    "UPDATE_LAST_LOGIN": True,
    "SIGNING_KEY": env("SIMPLE_JWT_SIGNING_KEY", default="django-insecure-HF3Rx2KW345SJ0XCxcuSJqKTz5347aFJCV5w34VEyhnKFyHBuXPjxotI5MM1R2345WmohV3"),
    "ALGORITHM": "HS512",
    "AUTH_COOKIE": "refresh_token",
    "AUTH_COOKIE_DOMAIN": cookies_domain, 
    "AUTH_COOKIE_SECURE": is_production,      
    "AUTH_COOKIE_HTTP_ONLY": True,   
    "AUTH_COOKIE_PATH": "/",         
    "AUTH_COOKIE_SAMESITE": "None",
}

REST_AUTH = {
    "USE_JWT": True,
    "JWT_AUTH_HTTPONLY": True,
    'JWT_AUTH_REFRESH_COOKIE': 'refresh_token',
    "USER_DETAILS_SERIALIZER": "apps.users.serializers.CustomUserSerializer",
}
    
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOWED_ORIGINS = env.list("CORS_ALLOWED_ORIGINS")
CSRF_TRUSTED_ORIGINS = env.list("CSRF_TRUSTED_ORIGINS")

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

# Celery setup (using redis)
if "REDIS_URL" in env:
    REDIS_URL = env("REDIS_URL")
elif "REDIS_TLS_URL" in env:
    REDIS_URL = env("REDIS_TLS_URL")
else:
    REDIS_HOST = env("REDIS_HOST", default="localhost")
    REDIS_PORT = env("REDIS_PORT", default="6379")
    REDIS_URL = f"redis://{REDIS_HOST}:{REDIS_PORT}/0"

if REDIS_URL.startswith("rediss"):
    REDIS_URL = f"{REDIS_URL}?ssl_cert_reqs=none"

CELERY_BROKER_URL = CELERY_RESULT_BACKEND = REDIS_URL
CELERY_BEAT_SCHEDULER = "django_celery_beat.schedulers:DatabaseScheduler"

# Waffle config

WAFFLE_FLAG_MODEL = "teams.Flag"

# Pegasus config

# replace any values below with specifics for your project
PROJECT_METADATA = {
    "NAME": gettext_lazy("OnMicro.AI"),
    "URL": "http://localhost:8000",
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


# Stripe config
# modeled to be the same as https://github.com/dj-stripe/dj-stripe
# Note: don"t edit these values here - edit them in your .env file or environment variables!
# The defaults are provided to prevent crashes if your keys don"t match the expected format.
STRIPE_LIVE_PUBLIC_KEY = env("STRIPE_LIVE_PUBLIC_KEY", default="pk_live_***")
STRIPE_LIVE_SECRET_KEY = env("STRIPE_LIVE_SECRET_KEY", default="sk_live_***")
STRIPE_TEST_PUBLIC_KEY = env("STRIPE_TEST_PUBLIC_KEY", default="pk_test_***")
STRIPE_TEST_SECRET_KEY = env("STRIPE_TEST_SECRET_KEY", default="sk_test_***")
STRIPE_WEBHOOK_SECRET = env("STRIPE_WEBHOOK_SECRET_KEY", default="whsec_***")
# STRIPE_PRICING_TABLE_ID = env("STRIPE_PRICING_TABLE_ID", default="***")
# Change to True in production
STRIPE_LIVE_MODE = env.bool("STRIPE_LIVE_MODE", False)

FREE_PLAN_FEATURES = env("FREE_PLAN_FEATURES").split(";")
INDIVIDUAL_PLAN_FEATURES = env("INDIVIDUAL_PLAN_FEATURES").split(";")
ENTERPRISE_PLAN_FEATURES = env("ENTERPRISE_PLAN_FEATURES").split(";")

# OBSOLETE
FREE_PLAN_PID = env("FREE_PLAN_PID")
INDIVIDUAL_PLAN_PID = env("INDIVIDUAL_PLAN_PID")
ENTERPRISE_PLAN_PID = env("ENTERPRISE_PLAN_PID")

FREE_PLAN_DESC = env("FREE_PLAN_DESC")
INDIVIDUAL_PLAN_DESC = env("INDIVIDUAL_PLAN_DESC")
ENTERPRISE_PLAN_DESC = env("ENTERPRISE_PLAN_DESC")

FREE_PLAN_NAME = env("FREE_PLAN_NAME")
INDIVIDUAL_PLAN_NAME = env("INDIVIDUAL_PLAN_NAME")
ENTERPRISE_PLAN_NAME = env("ENTERPRISE_PLAN_NAME")
##################

INDIVIDUAL_PLAN_PRICE_ID = env("INDIVIDUAL_PLAN_PRICE_ID")
ENTERPRISE_PLAN_PRICE_ID = env("ENTERPRISE_PLAN_PRICE_ID")

TOP_UP_CREDITS_PLAN_ID=env("TOP_UP_CREDITS_PLAN_ID")
TOP_UP_CREDITS=env.int("TOP_UP_CREDITS", default=200000)

DEFAULT_PORTAL_CONFIGURATION_ID=env("DEFAULT_PORTAL_CONFIGURATION_ID")
# djstripe settings
# Get it from the section in the Stripe dashboard where you added the webhook endpoint
# or from the stripe CLI when testing
DJSTRIPE_FOREIGN_KEY_TO_FIELD = "id"  # change to "djstripe_id" if not a new installation
DJSTRIPE_SUBSCRIBER_MODEL = "teams.Team"
DJSTRIPE_SUBSCRIBER_MODEL_REQUEST_CALLBACK = lambda request: request.team  # noqa E731

SILENCED_SYSTEM_CHECKS = [
    "djstripe.I002",  # Pegasus uses the same settings as dj-stripe for keys, so don't complain they are here
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
SESSION_COOKIE_SAMESITE = 'Lax'  # More restrictive for admin