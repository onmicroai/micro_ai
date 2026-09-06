from unittest.mock import patch

from django.core.exceptions import SuspiciousOperation
from django.test import RequestFactory, TestCase
from rest_framework.exceptions import AuthenticationFailed

from apps.authentication.keycloak_auth import KeycloakAuthentication
from apps.authentication.keycloak_resolve import resolve_user
from apps.subscriptions.models import CreditWallet
from apps.users.models import CustomUser

SUB = "11111111-1111-1111-1111-111111111111"
OTHER_SUB = "22222222-2222-2222-2222-222222222222"


def claims(**overrides):
    base = {
        "sub": SUB,
        "email": "person@example.com",
        "email_verified": True,
        "given_name": "Person",
        "family_name": "Example",
    }
    base.update(overrides)
    return base


class ResolveUserAlreadyLinkedTest(TestCase):
    """Branch 1: keycloak_sub already matches — steady state."""

    def test_returns_existing_linked_user_without_touching_email_lookup(self):
        user = CustomUser.objects.create_user(
            username="person", email="different-email@example.com", keycloak_sub=SUB
        )

        resolved = resolve_user(claims(email="person@example.com"))

        self.assertEqual(resolved.pk, user.pk)

    def test_does_not_create_a_new_user(self):
        CustomUser.objects.create_user(username="person", email="p@example.com", keycloak_sub=SUB)

        resolve_user(claims())

        self.assertEqual(CustomUser.objects.count(), 1)


class ResolveUserDjangoUserIdTest(TestCase):
    """Branch 2: migrated user, first login after federation — exact PK match."""

    def test_links_by_django_user_id_and_ignores_email(self):
        user = CustomUser.objects.create_user(
            username="migrated", email="migrated@example.com"
        )
        self.assertIsNone(user.keycloak_sub)

        resolved = resolve_user(
            claims(django_user_id=user.pk, email="unrelated@example.com", email_verified=False)
        )

        self.assertEqual(resolved.pk, user.pk)
        user.refresh_from_db()
        self.assertEqual(user.keycloak_sub, SUB)

    def test_raises_if_django_user_id_already_linked_to_a_different_sub(self):
        user = CustomUser.objects.create_user(
            username="migrated", email="migrated@example.com", keycloak_sub=OTHER_SUB
        )

        with self.assertRaises(SuspiciousOperation):
            resolve_user(claims(django_user_id=user.pk))


class ResolveUserEmailFallbackTest(TestCase):
    """Branch 3: the only place email is ever a matcher."""

    def test_links_by_verified_email(self):
        user = CustomUser.objects.create_user(username="jane", email="jane@example.com")

        resolved = resolve_user(claims(email="JANE@example.com"))

        self.assertEqual(resolved.pk, user.pk)
        user.refresh_from_db()
        self.assertEqual(user.keycloak_sub, SUB)

    def test_raises_on_unverified_email(self):
        CustomUser.objects.create_user(username="jane", email="jane@example.com")

        with self.assertRaises(SuspiciousOperation):
            resolve_user(claims(email="jane@example.com", email_verified=False))

    def test_raises_on_missing_email(self):
        with self.assertRaises(SuspiciousOperation):
            resolve_user(claims(email="", email_verified=True))

    def test_raises_if_matched_row_already_linked_to_a_different_sub(self):
        CustomUser.objects.create_user(
            username="jane", email="jane@example.com", keycloak_sub=OTHER_SUB
        )

        with self.assertRaises(SuspiciousOperation):
            resolve_user(claims(email="jane@example.com"))


class JitCreateTest(TestCase):
    """No lookup matched — provision a new user and fund its wallet."""

    def test_creates_user_with_unusable_password_and_keycloak_sub(self):
        user = resolve_user(claims(email="brand.new@example.com"))

        self.assertEqual(user.email, "brand.new@example.com")
        self.assertEqual(user.keycloak_sub, SUB)
        self.assertFalse(user.has_usable_password())

    def test_funds_wallet_via_user_signed_up_signal(self):
        user = resolve_user(claims(email="brand.new@example.com"))

        self.assertTrue(CreditWallet.objects.filter(user=user).exists())

    def test_marks_email_verified(self):
        user = resolve_user(claims(email="brand.new@example.com"))

        self.assertTrue(user.has_verified_email)

    def test_raises_on_unverified_email(self):
        with self.assertRaises(SuspiciousOperation):
            resolve_user(claims(email="brand.new@example.com", email_verified=False))

    def test_disambiguates_username_collision(self):
        CustomUser.objects.create_user(username="brand.new", email="taken@example.com")

        user = resolve_user(claims(email="brand.new@example.com"))

        self.assertNotEqual(user.username, "brand.new")
        self.assertTrue(user.username.startswith("brand.new"))

    def test_recovers_from_a_username_race_not_just_a_keycloak_sub_race(self):
        # _unique_username_for()'s check-then-use lookup isn't atomic — a
        # parallel request can take the checked-available username before
        # this one's create() runs. Forcing it to (incorrectly, as a stand-in
        # for that race) hand back an already-taken username first, then a
        # free one, exercises the retry path rather than the keycloak_sub
        # recovery path (no other row holds this claim's sub).
        CustomUser.objects.create_user(username="brand.new", email="taken@example.com")

        with patch(
            "apps.authentication.keycloak_resolve._unique_username_for",
            side_effect=["brand.new", "brand.new1"],
        ):
            user = resolve_user(claims(email="brand.new@example.com"))

        self.assertEqual(user.username, "brand.new1")
        self.assertEqual(user.keycloak_sub, SUB)


class KeycloakAuthenticationTest(TestCase):
    """authenticate() itself, not just resolve_user() — is_active
    enforcement and the DRF-native error shape for SuspiciousOperation both
    live at this layer."""

    def _request(self):
        return RequestFactory().get("/", HTTP_AUTHORIZATION="Bearer dummy-token")

    @patch("apps.authentication.keycloak_auth._claims_from_our_issuer", return_value=True)
    @patch("apps.authentication.keycloak_auth.verify")
    def test_deactivated_user_is_rejected(self, mock_verify, _mock_issuer):
        CustomUser.objects.create_user(
            username="disabled", email="disabled@example.com",
            keycloak_sub=SUB, is_active=False,
        )
        mock_verify.return_value = claims(email="disabled@example.com")

        with self.assertRaises(AuthenticationFailed):
            KeycloakAuthentication().authenticate(self._request())

    @patch("apps.authentication.keycloak_auth._claims_from_our_issuer", return_value=True)
    @patch("apps.authentication.keycloak_auth.verify")
    def test_suspicious_operation_becomes_authentication_failed(self, mock_verify, _mock_issuer):
        # Matches an existing row by email, but that row is already linked
        # to a different sub — resolve_user raises SuspiciousOperation here.
        CustomUser.objects.create_user(
            username="jane", email="jane@example.com", keycloak_sub=OTHER_SUB
        )
        mock_verify.return_value = claims(email="jane@example.com")

        # Django's SuspiciousOperation must never propagate past this
        # authenticator — DRF's exception_handler doesn't special-case it,
        # so it would otherwise fall through to Django's core handler and
        # come back as an HTML 400 instead of a JSON error.
        with self.assertRaises(AuthenticationFailed):
            KeycloakAuthentication().authenticate(self._request())
