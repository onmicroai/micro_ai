from django.test import TestCase

from apps.api.models import UserAPIKey
from apps.users.deactivation import deactivate_user_and_keys
from apps.users.models import CustomUser


class DeactivateUserAndKeysTest(TestCase):
    def setUp(self):
        self.user = CustomUser.objects.create_user(username="deactivate-me", email="deactivate-me@example.com")

    def test_sets_is_active_false(self):
        deactivate_user_and_keys(self.user)

        self.user.refresh_from_db()
        self.assertFalse(self.user.is_active)

    def test_revokes_live_api_keys(self):
        key, _ = UserAPIKey.objects.create_key(name="live", user=self.user)

        deactivate_user_and_keys(self.user)

        key.refresh_from_db()
        self.assertTrue(key.revoked)

    def test_leaves_already_revoked_keys_alone(self):
        key, _ = UserAPIKey.objects.create_key(name="already-revoked", user=self.user, revoked=True)

        deactivate_user_and_keys(self.user)  # must not raise on a no-op update

        key.refresh_from_db()
        self.assertTrue(key.revoked)

    def test_does_not_touch_other_users_keys(self):
        other_user = CustomUser.objects.create_user(username="unrelated", email="unrelated@example.com")
        other_key, _ = UserAPIKey.objects.create_key(name="unrelated-key", user=other_user)

        deactivate_user_and_keys(self.user)

        other_key.refresh_from_db()
        self.assertFalse(other_key.revoked)
