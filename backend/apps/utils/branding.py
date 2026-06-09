from django.conf import settings


def get_logo_path() -> str:
    value = settings.LOGO_FILENAME.strip()
    return value if value.startswith("/") else f"/{value}"


def get_logo_url() -> str:
    domain = settings.DOMAIN.rstrip("/")
    return f"{domain}{get_logo_path()}"


def get_email_branding_context() -> dict[str, str]:
    return {
        "platform_name": settings.PLATFORM_NAME,
        "logo_url": get_logo_url(),
        "logo_alt": settings.PLATFORM_NAME,
    }
