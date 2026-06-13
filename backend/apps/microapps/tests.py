from django.test import TestCase
from django.urls import reverse

from apps.microapps.models import Microapp


def _make_microapp(**kwargs):
    defaults = {
        "title": "Test App",
        "explanation": "Test description",
        "privacy": Microapp.PUBLIC,
        "app_json": {},
    }
    defaults.update(kwargs)
    return Microapp.objects.create(**defaults)


class PromotedMicroAppsListTest(TestCase):
    url = reverse("promoted_microapps")

    def test_returns_promoted_public_apps_ordered_by_priority(self):
        second = _make_microapp(
            title="Second Priority",
            hash_id="promo-second-001",
            is_promoted=True,
            promo_priority=2,
        )
        first = _make_microapp(
            title="First Priority",
            hash_id="promo-first-001",
            is_promoted=True,
            promo_priority=1,
        )
        _make_microapp(
            title="Not Promoted",
            hash_id="promo-none-001",
            is_promoted=False,
            promo_priority=1,
        )

        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 200)

        data = response.json()["data"]
        self.assertEqual(len(data), 2)
        self.assertEqual(data[0]["hash_id"], first.hash_id)
        self.assertEqual(data[1]["hash_id"], second.hash_id)
        self.assertEqual(data[0]["title"], "First Priority")
        self.assertEqual(data[0]["description"], "Test description")
        self.assertEqual(data[0]["app_url"], f"/app/{first.hash_id}")

    def test_priority_zero_sorts_last(self):
        unset = _make_microapp(
            title="Unset Priority",
            hash_id="promo-unset-001",
            is_promoted=True,
            promo_priority=0,
        )
        first = _make_microapp(
            title="First Priority",
            hash_id="promo-first-002",
            is_promoted=True,
            promo_priority=1,
        )
        second = _make_microapp(
            title="Second Priority",
            hash_id="promo-second-002",
            is_promoted=True,
            promo_priority=2,
        )

        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 200)

        data = response.json()["data"]
        self.assertEqual(len(data), 3)
        self.assertEqual(data[0]["hash_id"], first.hash_id)
        self.assertEqual(data[1]["hash_id"], second.hash_id)
        self.assertEqual(data[2]["hash_id"], unset.hash_id)

    def test_excludes_private_archived_and_non_promoted(self):
        _make_microapp(
            title="Private Promoted",
            hash_id="promo-private-01",
            privacy=Microapp.PRIVATE,
            is_promoted=True,
            promo_priority=1,
        )
        _make_microapp(
            title="Archived Promoted",
            hash_id="promo-archived-1",
            is_promoted=True,
            promo_priority=1,
            is_archived=True,
        )
        _make_microapp(
            title="Restricted Promoted",
            hash_id="promo-restrict-01",
            privacy=Microapp.RESTRICTED,
            is_promoted=True,
            promo_priority=1,
        )

        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["data"], [])

    def test_limit_query_param(self):
        for i, priority in enumerate([1, 2, 3], start=1):
            _make_microapp(
                title=f"App {i}",
                hash_id=f"promo-limit-{i:02d}",
                is_promoted=True,
                promo_priority=priority,
            )

        response = self.client.get(f"{self.url}?limit=2")
        self.assertEqual(response.status_code, 200)
        data = response.json()["data"]
        self.assertEqual(len(data), 2)
        self.assertEqual(data[0]["title"], "App 1")
        self.assertEqual(data[1]["title"], "App 2")

    def test_no_authentication_required(self):
        _make_microapp(
            title="Public Promoted",
            hash_id="promo-public-01",
            is_promoted=True,
            promo_priority=1,
        )

        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()["data"]), 1)

    def test_invalid_limit_is_ignored(self):
        _make_microapp(
            title="Only App",
            hash_id="promo-invalid-lim",
            is_promoted=True,
            promo_priority=1,
        )

        response = self.client.get(f"{self.url}?limit=abc")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()["data"]), 1)
