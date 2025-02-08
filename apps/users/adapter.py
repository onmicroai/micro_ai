from allauth.account import app_settings
from allauth.account.adapter import DefaultAccountAdapter
from allauth.account.utils import user_email, user_field
from allauth.mfa.models import Authenticator
from django.conf import settings


class EmailAsUsernameAdapter(DefaultAccountAdapter):
    """
    Adapter that always sets the username equal to the user's email address.
    """

    def populate_username(self, request, user):
        # override the username population to always use the email
        user_field(user, app_settings.USER_MODEL_USERNAME_FIELD, user_email(user))

    def get_email_confirmation_context(self, request, emailconfirmation):
        ctx = super().get_email_confirmation_context(request, emailconfirmation)
        ctx['domain'] = settings.DOMAIN
        ctx['user_email'] = emailconfirmation.email_address.email
        return ctx

    def get_email_confirmation_signup_context(self, request, emailconfirmation):
        ctx = super().get_email_confirmation_signup_context(request, emailconfirmation)
        ctx['domain'] = settings.DOMAIN
        ctx['user_email'] = emailconfirmation.email_address.email
        return ctx

    def get_reset_password_context(self, request, user, temp_key):
        ctx = super().get_reset_password_context(request, user, temp_key)
        ctx['domain'] = settings.DOMAIN
        ctx['user_email'] = user.email
        return ctx

    def get_login_code_context(self, request, user, code):
        ctx = super().get_login_code_context(request, user, code)
        ctx['domain'] = settings.DOMAIN
        ctx['user_email'] = user.email
        return ctx


class NoNewUsersAccountAdapter(DefaultAccountAdapter):
    """
    Adapter that can be used to disable public sign-ups for your app.
    """

    def is_open_for_signup(self, request):
        # see https://stackoverflow.com/a/29799664/8207
        return False


def user_has_valid_totp_device(user) -> bool:
    if not user.is_authenticated:
        return False
    return user.authenticator_set.filter(type=Authenticator.Type.TOTP).exists()
