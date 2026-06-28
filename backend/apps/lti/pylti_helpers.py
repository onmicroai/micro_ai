from django.conf import settings
from pylti1p3.contrib.django import DjangoCacheDataStorage
from pylti1p3.contrib.django.cookie import DjangoCookieService
from pylti1p3.contrib.django.request import DjangoRequest


class LTIDjangoRequest(DjangoRequest):
    """
    pylti1p3 only sets Secure + SameSite=None cookies when request.is_secure() is
    True. Behind nginx that is normally handled via SECURE_PROXY_SSL_HEADER, but
    if a request ever arrives without X-Forwarded-Proto the library would skip
    setting session-id on login while still requiring it on launch.
    """

    def is_secure(self):
        if getattr(settings, 'LTI_CROSS_SITE_COOKIES', False):
            return True
        return super().is_secure()


class LTIDjangoCookieService(DjangoCookieService):
    def __init__(self, request):
        django_request = (
            request if isinstance(request, LTIDjangoRequest) else LTIDjangoRequest(request)
        )
        super().__init__(django_request)


class LTIDjangoCacheDataStorage(DjangoCacheDataStorage):
    def get_session_cookie_name(self):
        # Store launch state keyed by launch_id only (no lti1p3-session-id prefix).
        # pylti1p3 documents this as the HTTPS iframe fallback when session cookies
        # are unreliable; launch_id is an unguessable UUID. OIDC state/nonce still
        # use their own short-lived lti1p3-state-* cookies on /lti/login/ + /launch/.
        return None


def lti_request(request, post_only=False):
    return LTIDjangoRequest(request, post_only=post_only)


def get_launch_data_storage():
    return LTIDjangoCacheDataStorage()
