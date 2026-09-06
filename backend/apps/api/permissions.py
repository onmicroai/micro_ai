import typing

from django.http import HttpRequest
from rest_framework.permissions import IsAuthenticated
from rest_framework_api_key.permissions import BaseHasAPIKey

from .helpers import get_user_from_request
from .models import UserAPIKey


class HasUserAPIKey(BaseHasAPIKey):
    model = UserAPIKey

    def has_permission(self, request: HttpRequest, view: typing.Any) -> bool:
        has_perm = super().has_permission(request, view)
        if not has_perm:
            return False

        user = get_user_from_request(request)
        # A deactivated user's API keys must stop working immediately, not
        # just their session — the key itself might still show `revoked=False`
        # if it was never explicitly revoked (see deactivate_user_and_keys()).
        if user is None or not user.is_active:
            return False

        # if they have permission, also populate the request.user object for convenience
        request.user = user
        return True


# hybrid permission class that can check for API keys or authentication
IsAuthenticatedOrHasUserAPIKey = IsAuthenticated | HasUserAPIKey
