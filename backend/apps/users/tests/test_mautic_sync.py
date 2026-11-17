from datetime import datetime, timezone as dt_timezone
from unittest.mock import patch

from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import TestCase, override_settings
from apps.subscriptions.constants import PLANS, PRICE_IDS
from apps.subscriptions.models import Subscription
from apps.users.mautic import (
    FIELD_ACTIVE,
    FIELD_LAST_LOGIN,
    FIELD_PLAN,
    FIELD_USER_ID,
    MauticClient,
    MauticSyncError,
    contact_payload,
    sync_contacts,
)
from apps.users.models import CustomUser


ENABLED = {
    "PRODUCTION": True,
    "MAUTIC_SYNC_ENABLED": True,
    "MAUTIC_BASE_URL": "https://mautic.example.com",
    "MAUTIC_API_USER": "api-user",
    "MAUTIC_API_PASSWORD": "secret",
}


class ContactPayloadTest(TestCase):
    def test_active_user_includes_plan_and_last_login(self):
        user = CustomUser.objects.create_user(
            username="ada",
            email="ada@example.com",
            password="x",
            first_name="Ada",
            last_name="Lovelace",
        )
        user.last_login = datetime(2026, 1, 2, 3, 4, 5, tzinfo=dt_timezone.utc)
        user.save(update_fields=["last_login"])

        payload = contact_payload(user, "Pro")

        self.assertEqual(payload["email"], "ada@example.com")
        self.assertEqual(payload["firstname"], "Ada")
        self.assertEqual(payload["lastname"], "Lovelace")
        self.assertEqual(payload[FIELD_USER_ID], str(user.pk))
        self.assertEqual(payload[FIELD_ACTIVE], 1)
        self.assertEqual(payload[FIELD_PLAN], "Pro")
        self.assertEqual(payload[FIELD_LAST_LOGIN], "2026-01-02 03:04:05")
        self.assertNotIn("doNotContact", payload)

    def test_inactive_user_is_marked_inactive_and_omits_blank_names(self):
        user = CustomUser.objects.create_user(username="quiet", email="quiet@example.com", password="x")
        user.is_active = False
        user.save(update_fields=["is_active"])

        payload = contact_payload(user, "Free")

        self.assertEqual(payload[FIELD_ACTIVE], 0)
        self.assertNotIn("firstname", payload)
        self.assertNotIn("lastname", payload)
        self.assertNotIn(FIELD_LAST_LOGIN, payload)

    def test_plan_comes_from_the_latest_subscription(self):
        price_id = PRICE_IDS["pro"]
        if not price_id:
            self.skipTest("Pro price id is not configured")
        user = CustomUser.objects.create_user(username="pro", email="pro@example.com", password="x")
        Subscription.objects.create(user=user, price_id=price_id, status="active", source="stripe")

        with patch("apps.users.mautic.MauticClient.upsert_contacts", return_value={}) as upsert:
            result = sync_contacts(MauticClient("https://mautic.example.com", "u", "p"))

        sent = upsert.call_args.args[0]
        self.assertEqual(sent[0][FIELD_PLAN], PLANS["pro"])
        self.assertEqual(result, 1)


class MauticClientTest(TestCase):
    def test_posts_a_json_batch_with_basic_auth(self):
        client = MauticClient("https://mautic.example.com/", "api-user", "secret")
        response = type("Response", (), {})()
        response.status_code = 201
        response.json = lambda: {"contacts": [{}], "statusCodes": [201]}
        response.text = ""

        with patch("apps.users.mautic.requests.post", return_value=response) as post:
            client.upsert_contacts([{"email": "ada@example.com", FIELD_ACTIVE: 1}])

        post.assert_called_once()
        args, kwargs = post.call_args
        self.assertEqual(args[0], "https://mautic.example.com/api/contacts/batch/new")
        self.assertEqual(kwargs["auth"], ("api-user", "secret"))
        self.assertEqual(kwargs["json"], [{"email": "ada@example.com", FIELD_ACTIVE: 1}])

    def test_raises_when_mautic_rejects_a_contact(self):
        client = MauticClient("https://mautic.example.com", "api-user", "secret")
        response = type("Response", (), {})()
        response.status_code = 201
        response.json = lambda: {"errors": {"0": {"message": "email invalid"}}, "statusCodes": [400]}
        response.text = ""

        with patch("apps.users.mautic.requests.post", return_value=response):
            with self.assertRaises(MauticSyncError):
                client.upsert_contacts([{"email": "not-an-email"}])


class SyncCommandTest(TestCase):
    def setUp(self):
        CustomUser.objects.create_user(username="ada", email="ada@example.com", password="x", first_name="Ada")
        CustomUser.objects.create_user(username="noemail", email="", password="x")

    def test_skips_when_production_is_off(self):
        with override_settings(PRODUCTION=False, MAUTIC_SYNC_ENABLED=True):
            with patch("apps.users.mautic.requests.post") as post:
                call_command("sync_mautic")
        post.assert_not_called()

    def test_skips_when_the_flag_is_off_even_in_production(self):
        with override_settings(PRODUCTION=True, MAUTIC_SYNC_ENABLED=False):
            with patch("apps.users.mautic.requests.post") as post:
                call_command("sync_mautic")
        post.assert_not_called()

    @override_settings(**ENABLED)
    def test_sync_sends_users_with_email_including_inactive(self):
        inactive = CustomUser.objects.create_user(username="gone", email="gone@example.com", password="x")
        inactive.is_active = False
        inactive.save(update_fields=["is_active"])

        response = type("Response", (), {})()
        response.status_code = 201
        response.json = lambda: {"contacts": [], "statusCodes": [200]}
        response.text = ""

        with patch("apps.users.mautic.requests.post", return_value=response) as post:
            call_command("sync_mautic")

        post.assert_called_once()
        live = post.call_args.kwargs["json"]
        by_email = {row["email"]: row for row in live}
        self.assertEqual(set(by_email), {"ada@example.com", "gone@example.com"})
        self.assertEqual(by_email["ada@example.com"][FIELD_ACTIVE], 1)
        self.assertEqual(by_email["gone@example.com"][FIELD_ACTIVE], 0)
        self.assertNotIn("doNotContact", by_email["ada@example.com"])

    def test_dry_run_does_not_call_mautic(self):
        with patch("apps.users.mautic.requests.post") as post:
            call_command("sync_mautic", "--dry-run")
        post.assert_not_called()

    @override_settings(PRODUCTION=True, MAUTIC_SYNC_ENABLED=True, MAUTIC_BASE_URL="", MAUTIC_API_USER="", MAUTIC_API_PASSWORD="")
    def test_missing_credentials_fail_the_command(self):
        with self.assertRaises(CommandError):
            call_command("sync_mautic")
