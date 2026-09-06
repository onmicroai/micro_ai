from unittest.mock import MagicMock, patch

from django.test import TestCase
from django.urls import reverse

from apps.microapps.models import Microapp, MicroAppUserJoin
from apps.subscriptions.models import CreditWallet
from apps.users.models import CustomUser


def _mock_deep_link_launch(email, given_name="", family_name=""):
    """
    Stands in for a pylti1p3 DjangoMessageLaunch restored from cache.
    deep_link_picker only ever calls .is_deep_link_launch() and
    .get_launch_data() on it, so that's all this needs to fake.
    """
    launch = MagicMock()
    launch.is_deep_link_launch.return_value = True
    launch.get_launch_data.return_value = {
        "email": email,
        "given_name": given_name,
        "family_name": family_name,
    }
    return launch


class DeepLinkPickerTest(TestCase):
    def setUp(self):
        self.url = reverse("app-deep-link-picker")
        # get_tool_conf() reads real LTI key files off disk — irrelevant to
        # what this view does with the (mocked) restored launch, so patched
        # out rather than depending on filesystem key material in tests.
        patcher = patch("apps.lti.views.get_tool_conf", return_value=None)
        patcher.start()
        self.addCleanup(patcher.stop)

    def _get(self, launch):
        with patch("apps.lti.views._restore_message_launch_from_cache", return_value=launch):
            return self.client.get(self.url, {"launch_id": "fake-launch-id"})

    def test_existing_user_with_microapps_unchanged(self):
        user = CustomUser.objects.create_user(username="instructor", email="instructor@example.com")
        app = Microapp.objects.create(title="My App", app_json={})
        MicroAppUserJoin.objects.create(user_id=user, ma_id=app, role=MicroAppUserJoin.OWNER)

        response = self._get(_mock_deep_link_launch("instructor@example.com"))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "My App")
        self.assertNotContains(response, "No MicroAI account found")

    def test_missing_email_shows_unchanged_error(self):
        response = self._get(_mock_deep_link_launch(""))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Your LMS did not provide an email address")

    def test_unknown_email_jit_provisions_new_user(self):
        self.assertFalse(CustomUser.objects.filter(email__iexact="new-instructor@example.com").exists())

        response = self._get(
            _mock_deep_link_launch("new-instructor@example.com", given_name="New", family_name="Instructor")
        )

        self.assertEqual(response.status_code, 200)
        # No hard-fail — the old "No MicroAI account found" message is gone.
        self.assertNotContains(response, "No MicroAI account found")
        # A brand-new account has zero microapps, which is the expected
        # (non-error) empty state, not a failure.
        self.assertContains(response, "don&#x27;t have any microapps yet")

        user = CustomUser.objects.get(email__iexact="new-instructor@example.com")
        self.assertEqual(user.first_name, "New")
        self.assertEqual(user.last_name, "Instructor")
        self.assertFalse(user.has_usable_password())

    def test_jit_provisioned_user_has_no_keycloak_sub(self):
        # The load-bearing part of this feature: an LTI launch's own `sub`
        # must never land in keycloak_sub, or this user's real future
        # Keycloak login would be permanently unable to link (see
        # jit_create()'s docstring in apps/authentication/keycloak_resolve.py).
        self._get(_mock_deep_link_launch("no-keycloak-sub@example.com"))

        user = CustomUser.objects.get(email__iexact="no-keycloak-sub@example.com")
        self.assertIsNone(user.keycloak_sub)

    def test_jit_provisioned_user_gets_a_funded_wallet(self):
        self._get(_mock_deep_link_launch("wallet-check@example.com"))

        user = CustomUser.objects.get(email__iexact="wallet-check@example.com")
        self.assertTrue(CreditWallet.objects.filter(user=user).exists())

    def test_second_launch_reuses_the_same_provisioned_user(self):
        self._get(_mock_deep_link_launch("repeat-instructor@example.com"))
        first_count = CustomUser.objects.filter(email__iexact="repeat-instructor@example.com").count()

        self._get(_mock_deep_link_launch("repeat-instructor@example.com"))
        second_count = CustomUser.objects.filter(email__iexact="repeat-instructor@example.com").count()

        self.assertEqual(first_count, 1)
        self.assertEqual(second_count, 1)
