# \micro_ai\apps\users\models.py

import hashlib
import uuid
from functools import cached_property
from django.conf import settings

from allauth.account.models import EmailAddress
from django.contrib.auth.models import AbstractUser
from django.db import models
from django.core.files.storage import default_storage
from apps.users.helpers import validate_profile_picture


def _get_avatar_filename(instance, filename):
    """Use random filename prevent overwriting existing files & to fix caching issues."""
    return f'profile-pictures/{uuid.uuid4()}.{filename.split(".")[-1]}'


class CustomUser(AbstractUser):
    """
    Add additional fields to the user model here.
    """

    avatar = models.FileField(upload_to=_get_avatar_filename, blank=True, validators=[validate_profile_picture])

    def __str__(self):
        return f"{self.get_full_name()} <{self.email or self.username}>"

    def get_display_name(self) -> str:
        if self.get_full_name().strip():
            return self.get_full_name()
        return self.email or self.username

    @property
    def avatar_url(self) -> str:
        if self.avatar and default_storage.exists(self.avatar.name):
            return f"{settings.DOMAIN}{self.avatar.url}"
        return f"{settings.STATIC_URL}images/web/default_avatar.jpg"

    @property
    def gravatar_id(self) -> str:
        # https://en.gravatar.com/site/implement/hash/
        return hashlib.md5(self.email.lower().strip().encode("utf-8")).hexdigest()

    @cached_property
    def has_verified_email(self):
        return EmailAddress.objects.filter(user=self, verified=True).exists()
