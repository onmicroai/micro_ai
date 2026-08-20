from unittest.mock import patch

from django.test import TestCase, override_settings
from django.urls import reverse

from apps.users.models import CustomUser
from apps.utils.throttles import FederationPasswordCheckThrottle

SECRET = "test-shared-secret"


@override_settings(KEYCLOAK_FEDERATION_SHARED_SECRET=SECRET)
class FederationAuthTest(TestCase):
    def setUp(self):
        self.user = CustomUser.objects.create_user(
            username="legacy", email="legacy@example.com", password="correct-horse"
        )
        self.url = reverse("authentication:federation", args=["legacy"])

    def _auth(self, token=SECRET):
        return {"HTTP_AUTHORIZATION": f"Bearer {token}"}

    def test_get_without_bearer_token_is_rejected(self):
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 403)

    def test_get_with_wrong_token_is_rejected(self):
        response = self.client.get(self.url, **self._auth("wrong-secret"))
        self.assertEqual(response.status_code, 403)

    def test_post_without_bearer_token_is_rejected(self):
        response = self.client.post(self.url, data={"password": "correct-horse"}, content_type="application/json")
        self.assertEqual(response.status_code, 403)

    @override_settings(KEYCLOAK_FEDERATION_SHARED_SECRET="")
    def test_empty_secret_fails_closed(self):
        response = self.client.get(self.url, HTTP_AUTHORIZATION="Bearer anything")
        self.assertEqual(response.status_code, 403)


@override_settings(KEYCLOAK_FEDERATION_SHARED_SECRET=SECRET)
class FederationLookupTest(TestCase):
    def setUp(self):
        self.user = CustomUser.objects.create_user(
            username="legacy", email="legacy@example.com", password="correct-horse",
            first_name="Legacy", last_name="User",
        )
        self.auth = {"HTTP_AUTHORIZATION": f"Bearer {SECRET}"}

    def test_finds_by_username(self):
        url = reverse("authentication:federation", args=["legacy"])
        response = self.client.get(url, **self.auth)

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["username"], "legacy")
        self.assertEqual(body["email"], "legacy@example.com")
        self.assertEqual(body["firstName"], "Legacy")
        self.assertEqual(body["lastName"], "User")
        self.assertNotIn("id", body)

    def test_finds_by_email_case_insensitive(self):
        url = reverse("authentication:federation", args=["LEGACY@example.com"])
        response = self.client.get(url, **self.auth)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["username"], "legacy")

    def test_django_user_id_attribute_is_a_string_list(self):
        url = reverse("authentication:federation", args=["legacy"])
        response = self.client.get(url, **self.auth)

        self.assertEqual(
            response.json()["attributes"], {"django_user_id": [str(self.user.pk)]}
        )

    def test_reflects_enabled_and_email_verified(self):
        url = reverse("authentication:federation", args=["legacy"])
        response = self.client.get(url, **self.auth)

        body = response.json()
        self.assertEqual(body["enabled"], True)
        self.assertEqual(body["emailVerified"], False)

    def test_unknown_user_returns_non_200(self):
        url = reverse("authentication:federation", args=["nobody"])
        response = self.client.get(url, **self.auth)

        self.assertEqual(response.status_code, 404)


@override_settings(KEYCLOAK_FEDERATION_SHARED_SECRET=SECRET)
class FederationPasswordCheckTest(TestCase):
    def setUp(self):
        self.user = CustomUser.objects.create_user(
            username="legacy", email="legacy@example.com", password="correct-horse"
        )
        self.auth = {"HTTP_AUTHORIZATION": f"Bearer {SECRET}"}
        self.url = reverse("authentication:federation", args=["legacy"])

    def test_correct_password_returns_200(self):
        response = self.client.post(
            self.url, data={"password": "correct-horse"},
            content_type="application/json", **self.auth,
        )
        self.assertEqual(response.status_code, 200)

    def test_wrong_password_returns_non_200(self):
        response = self.client.post(
            self.url, data={"password": "wrong"},
            content_type="application/json", **self.auth,
        )
        self.assertEqual(response.status_code, 400)

    def test_unknown_user_returns_non_200(self):
        url = reverse("authentication:federation", args=["nobody"])
        response = self.client.post(
            url, data={"password": "anything"},
            content_type="application/json", **self.auth,
        )
        self.assertEqual(response.status_code, 400)

    def test_missing_password_returns_non_200(self):
        response = self.client.post(self.url, data={}, content_type="application/json", **self.auth)
        self.assertEqual(response.status_code, 400)

    # DRF's SimpleRateThrottle.THROTTLE_RATES is a snapshot of
    # api_settings.DEFAULT_THROTTLE_RATES taken once at class-definition
    # time (rest_framework/throttling.py) — override_settings on
    # REST_FRAMEWORK doesn't reach already-imported throttle classes, so
    # patch the class's own THROTTLE_RATES dict directly instead.
    @patch.dict(FederationPasswordCheckThrottle.THROTTLE_RATES, {"federation_password_check": "3/hour"})
    def test_repeated_failures_are_throttled(self):
        for _ in range(3):
            response = self.client.post(
                self.url, data={"password": "wrong"},
                content_type="application/json", **self.auth,
            )
            self.assertEqual(response.status_code, 400)

        throttled = self.client.post(
            self.url, data={"password": "wrong"},
            content_type="application/json", **self.auth,
        )
        self.assertEqual(throttled.status_code, 429)

    @patch.dict(FederationPasswordCheckThrottle.THROTTLE_RATES, {"federation_password_check": "1/hour"})
    def test_successful_check_does_not_count_against_the_limit(self):
        for _ in range(5):
            response = self.client.post(
                self.url, data={"password": "correct-horse"},
                content_type="application/json", **self.auth,
            )
            self.assertEqual(response.status_code, 200)
