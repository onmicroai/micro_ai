from copy import copy
from django.conf import settings
from .meta import absolute_url, get_server_root


def project_meta(request):
    # modify these values as needed and add whatever else you want globally available here
    project_data = copy(settings.PROJECT_METADATA)
    project_data["TITLE"] = "{} | {}".format(project_data["NAME"], project_data["DESCRIPTION"])
    return {
        "project_meta": project_data,
        "server_url": get_server_root(),
        "page_url": absolute_url(request.path),
        "page_title": "",
        "page_description": "",
        "page_image": "",
        # put any settings you want made available to all templates here
        # then reference them as {{ project_settings.MY_VALUE }} in templates
        "project_settings": {
            "ACCOUNT_SIGNUP_PASSWORD_ENTER_TWICE": settings.ACCOUNT_SIGNUP_PASSWORD_ENTER_TWICE,
        },
        "turnstile_key": getattr(settings, "TURNSTILE_KEY", None),
    }


def google_analytics_id(request):
    """
    Adds google analytics id to all requests
    """
    if settings.GOOGLE_ANALYTICS_ID:
        return {
            "GOOGLE_ANALYTICS_ID": settings.GOOGLE_ANALYTICS_ID,
        }
    else:
        return {}


def email_context(request):
    """Add email-related context variables"""
    return {
        'domain': settings.DOMAIN,
        'user_email': getattr(request.user, 'email', '') if request.user.is_authenticated else '',
    }
