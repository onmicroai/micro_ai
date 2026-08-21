from django.test import TestCase
from django.urls import reverse


class TestBasicViews(TestCase):
    def test_landing_page(self):
        self._assert_200(reverse("web:home"))

    def test_signup(self):
        # Self-registration happens in Keycloak now (PR 12 cutover) —
        # account_signup redirects to account_login instead of rendering.
        response = self.client.get(reverse("account_signup"))
        self.assertRedirects(response, reverse("account_login"))

    def test_login(self):
        self._assert_200(reverse("account_login"))

    def test_terms(self):
        self._assert_200(reverse("web:terms"))

    def test_robots(self):
        self._assert_200(reverse("web:robots.txt"))

    def _assert_200(self, url):
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
