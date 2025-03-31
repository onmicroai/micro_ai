import logging
import requests

from allauth.account.forms import SignupForm
from allauth.socialaccount.forms import SignupForm as SocialSignupForm
from django import forms
from django.conf import settings
from django.contrib.auth.forms import UserChangeForm
from django.utils.translation import gettext

from .helpers import validate_profile_picture
from .models import CustomUser


class TurnstileSignupForm(SignupForm):
    """
    Sign up form that includes a turnstile captcha.
    """

    turnstile_token = forms.CharField(widget=forms.HiddenInput(), required=False)

    def clean_turnstile_token(self):
        if not settings.TURNSTILE_SECRET:
            logging.info("No turnstile secret found, not checking captcha")
            return

        turnstile_token = self.cleaned_data.get("turnstile_token", None)
        if not turnstile_token:
            raise forms.ValidationError("Missing captcha. Please try again.")

        turnstile_url = "https://challenges.cloudflare.com/turnstile/v0/siteverify"
        payload = {
            "secret": settings.TURNSTILE_SECRET,
            "response": turnstile_token,
        }
        response = requests.post(turnstile_url, data=payload).json()
        if not response["success"]:
            raise forms.ValidationError("Invalid captcha. Please try again.")

        return turnstile_token


class CustomUserChangeForm(UserChangeForm):
    email = forms.EmailField(label=gettext("Email"), required=True)

    class Meta:
        model = CustomUser
        fields = ("email", "first_name", "last_name")


class UploadAvatarForm(forms.Form):
    avatar = forms.FileField(validators=[validate_profile_picture])


class CustomSocialSignupForm(SocialSignupForm):
    """Custom social signup form to work around this issue:
    https://github.com/pennersr/django-allauth/issues/3266."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.prevent_enumeration = False
