from django.core.checks import Error, Warning, register
from django.conf import settings

INSECURE_PLACEHOLDERS = [
    'your_secret_key', 'change_me', 'changeme',
    'change_me_to_secure_key_in_prod', 'django-insecure-',
    'your_access_key', '***', 'openai_api_key',
    'gemini_api_key', 'claude_api_key', 'your_secret_key',
]

SENSITIVE_SETTINGS = [
    'SECRET_KEY',
    'SIMPLE_JWT_SIGNING_KEY',
    'LITELLM_SALT_KEY',
    'LITELLM_MASTER_KEY',
]

def _is_insecure(value: str) -> bool:
    if not value:
        return False
    value_lower = value.lower().strip("'\"")
    return any(p in value_lower for p in INSECURE_PLACEHOLDERS)

@register()
def check_insecure_defaults(app_configs, **kwargs):
    is_production = getattr(settings, 'PRODUCTION', False)
    messages = []

    for name in SENSITIVE_SETTINGS:
        value = getattr(settings, name, None)
        if _is_insecure(str(value or '')):
            msg = f"{name} is set to an insecure placeholder value."
            hint = "Run ./setup.sh to generate secure values before deploying."
            if is_production:
                messages.append(Error(msg, hint=hint, id=f'security.E001'))
            else:
                messages.append(Warning(msg, hint=hint, id=f'security.W001'))

    if is_production and messages:
        messages.append(Error(
            "Insecure default values detected. Refusing to start in production.",
            hint="Run ./setup.sh to fix all insecure values.",
            id='security.E002',
        ))

    return messages
