from allauth.account import app_settings
from allauth.account.adapter import DefaultAccountAdapter
from allauth.account.utils import user_email, user_field
from allauth.mfa.models import Authenticator
from django.conf import settings
from django.urls import reverse
from rest_framework import serializers
import django
from apps.users.models import CustomUser
from apps.utils.branding import get_email_branding_context
from apps.utils.custom_error_message import ErrorMessages as error

class EmailAsUsernameAdapter(DefaultAccountAdapter):
    """
    Adapter that always sets the username equal to the user's email address.
    """

    def populate_username(self, request, user):
        # override the username population to always use the email
        user_field(user, app_settings.USER_MODEL_USERNAME_FIELD, user_email(user))

    def _base_email_context(self):
        return {
            "domain": settings.DOMAIN,
            "cloudfront_domain": getattr(settings, "CLOUDFRONT_DOMAIN", ""),
            **get_email_branding_context(),
        }

    def get_email_confirmation_url(self, request, emailconfirmation):
        """
        Override to use the DOMAIN setting from .env instead of the request's domain.
        """
        from django.conf import settings
        
        # Get the path part of the URL
        path = reverse("account_confirm_email", args=[emailconfirmation.key])
        
        # Construct the full URL with the domain from settings
        domain = settings.DOMAIN.rstrip('/')  # Remove trailing slash if present
        url = f"{domain}{path}"
        
        print(f"Generated confirmation URL: {url}")
        
        return url

    def get_email_confirmation_context(self, request, emailconfirmation):
        ctx = super().get_email_confirmation_context(request, emailconfirmation)
        ctx.update(self._base_email_context())
        ctx['user_email'] = emailconfirmation.email_address.email
        return ctx

    def get_email_confirmation_signup_context(self, request, emailconfirmation):
        ctx = super().get_email_confirmation_signup_context(request, emailconfirmation)
        ctx.update(self._base_email_context())
        ctx['user_email'] = emailconfirmation.email_address.email
        return ctx

    def get_reset_password_context(self, request, user, temp_key):
        ctx = super().get_reset_password_context(request, user, temp_key)
        ctx.update(self._base_email_context())
        ctx['user_email'] = user.email
        return ctx

    def get_login_code_context(self, request, user, code):
        ctx = super().get_login_code_context(request, user, code)
        ctx.update(self._base_email_context())
        ctx['user_email'] = user.email
        return ctx


class AcceptInvitationAdapter(EmailAsUsernameAdapter):
    """
    Adapter that checks for an invitation id in the session and redirects
    to accepting it after login.
    """
    
    def save_user(self, request, user, form, commit=True):
        try:
            username = form.cleaned_data.get('email')
            if CustomUser.objects.filter(username=username):
                raise serializers.ValidationError({'error': error.EMAIL_ALREADY_EXIST})
            else:
                user = super().save_user(request, user, form, commit)
                if user.pk is None: 
                    user.save()
                return user
        except django.db.utils.IntegrityError as e:  
            raise serializers.ValidationError({'error': repr(e)})
        except Exception as e:
            raise serializers.ValidationError({'error': repr(e)})


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
