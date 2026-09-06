from django.contrib.auth.models import AnonymousUser
from django.test import TestCase
from rest_framework.test import APIRequestFactory
from rest_framework.views import APIView

from apps.api.models import UserAPIKey
from apps.api.permissions import HasUserAPIKey
from apps.users.models import CustomUser


class HasUserAPIKeyActiveUserTest(TestCase):
    def setUp(self):
        self.user = CustomUser.objects.create_user(username="keyholder", email="keyholder@example.com")
        self.api_key, self.key = UserAPIKey.objects.create_key(name="test-key", user=self.user)
        self.factory = APIRequestFactory()
        self.permission = HasUserAPIKey()
        self.view = APIView()

    def _request(self):
        # get_user_from_request() reads request.user.is_anonymous, which
        # AuthenticationMiddleware normally populates before permission
        # checks run — APIRequestFactory builds a bare WSGIRequest without it.
        request = self.factory.get("/", HTTP_AUTHORIZATION=f"Api-Key {self.key}")
        request.user = AnonymousUser()
        return request

    def test_active_user_with_valid_unrevoked_key_is_allowed(self):
        self.assertTrue(self.permission.has_permission(self._request(), self.view))

    def test_deactivated_user_is_denied_even_with_a_valid_unrevoked_key(self):
        # The key itself was never revoked — is_active is what must gate this.
        self.user.is_active = False
        self.user.save(update_fields=["is_active"])

        self.assertFalse(self.permission.has_permission(self._request(), self.view))

    def test_revoked_key_is_denied_regardless_of_user_state(self):
        self.api_key.revoked = True
        self.api_key.save(update_fields=["revoked"])

        self.assertFalse(self.permission.has_permission(self._request(), self.view))

    def test_allowed_request_populates_request_user(self):
        request = self._request()
        self.permission.has_permission(request, self.view)

        self.assertEqual(request.user, self.user)
