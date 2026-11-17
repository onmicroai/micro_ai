"""
Push Django users to Mautic. Mautic stays the source of truth for unsubscribes:
this module never sends do-not-contact data and never deletes contacts.
"""

import logging

import requests
from django.utils import timezone

from apps.subscriptions.constants import tier_for_price
from apps.subscriptions.models import Subscription
from apps.users.models import CustomUser

log = logging.getLogger("micro_ai.mautic")

BATCH_SIZE = 200

# Aliases must match the custom fields created in Mautic.
FIELD_USER_ID = "onmicro_user_id"
FIELD_ACTIVE = "onmicro_active"
FIELD_JOINED = "onmicro_joined"
FIELD_PLAN = "onmicro_plan"
FIELD_LAST_LOGIN = "onmicro_last_login"


class MauticSyncError(Exception):
    pass


def contact_payload(user: CustomUser, plan: str) -> dict:
    """Fields for one live user. Empty names are omitted so a sync cannot blank them."""
    payload = {
        "email": user.email,
        FIELD_USER_ID: str(user.pk),
        FIELD_ACTIVE: 1 if user.is_active else 0,
        FIELD_JOINED: timezone.localtime(user.date_joined).strftime("%Y-%m-%d"),
        FIELD_PLAN: plan,
    }
    if user.first_name:
        payload["firstname"] = user.first_name
    if user.last_name:
        payload["lastname"] = user.last_name
    if user.last_login:
        payload[FIELD_LAST_LOGIN] = timezone.localtime(user.last_login).strftime("%Y-%m-%d %H:%M:%S")
    return payload


def plans_by_user_id(user_ids) -> dict[int, str]:
    """Latest subscription's tier name. Users with no subscription are Free."""
    plans: dict[int, str] = {}
    rows = (
        Subscription.objects.filter(user_id__in=user_ids)
        .order_by("user_id", "-created_at")
        .values_list("user_id", "price_id")
    )
    for user_id, price_id in rows:
        if user_id not in plans:
            plans[user_id] = tier_for_price(price_id).name
    return plans


class MauticClient:
    def __init__(self, base_url: str, username: str, password: str, timeout: int = 60):
        self.base_url = base_url.rstrip("/")
        self.auth = (username, password)
        self.timeout = timeout

    def upsert_contacts(self, contacts: list[dict]) -> dict:
        """
        Create or update contacts. Mautic matches on unique-identifier fields
        (email and onmicro_user_id), so an existing contact is updated.
        """
        if not contacts:
            return {"contacts": [], "statusCodes": []}
        url = f"{self.base_url}/api/contacts/batch/new"
        try:
            response = requests.post(
                url,
                json=contacts,
                auth=self.auth,
                timeout=self.timeout,
                headers={"Accept": "application/json"},
            )
        except requests.RequestException as exc:
            raise MauticSyncError(f"Mautic request failed: {exc}") from exc

        if response.status_code == 401:
            raise MauticSyncError(
                "Mautic rejected the API credentials (401). "
                "Enable HTTP basic authentication and confirm this user can create and edit contacts."
            )
        if response.status_code >= 400:
            raise MauticSyncError(
                f"Mautic batch failed: HTTP {response.status_code} {response.text[:500]}"
            )

        try:
            data = response.json()
        except ValueError as exc:
            raise MauticSyncError(f"Mautic returned a non-JSON response: {response.text[:500]}") from exc

        errors = data.get("errors") or {}
        failed = _failed_status_codes(data.get("statusCodes"))
        if errors or failed:
            raise MauticSyncError(
                f"Mautic rejected {len(errors) or len(failed)} contact(s): {_summarize_errors(errors)}"
            )
        return data


def _failed_status_codes(status_codes) -> list:
    if isinstance(status_codes, dict):
        values = status_codes.values()
    elif isinstance(status_codes, list):
        values = status_codes
    else:
        return []
    failed = []
    for code in values:
        try:
            if int(code) >= 400:
                failed.append(code)
        except (TypeError, ValueError):
            continue
    return failed


def _summarize_errors(errors) -> str:
    if not errors:
        return "see Mautic status codes"
    if isinstance(errors, dict):
        items = list(errors.items())
    else:
        items = list(enumerate(errors))
    parts = []
    for key, err in items[:5]:
        message = err.get("message") if isinstance(err, dict) else err
        parts.append(f"{key}: {message}")
    if len(items) > 5:
        parts.append(f"+{len(items) - 5} more")
    return "; ".join(parts)


def iter_user_batches(limit: int | None = None):
    qs = (
        CustomUser.objects.exclude(email="")
        .order_by("id")
        .only("id", "email", "first_name", "last_name", "is_active", "date_joined", "last_login")
    )
    remaining = limit
    last_id = 0
    while True:
        size = BATCH_SIZE if remaining is None else min(BATCH_SIZE, remaining)
        if size <= 0:
            return
        batch = list(qs.filter(id__gt=last_id)[:size])
        if not batch:
            return
        yield batch
        last_id = batch[-1].id
        if remaining is not None:
            remaining -= len(batch)


def sync_contacts(client: MauticClient, limit: int | None = None) -> int:
    """Upsert every user that has an email. Inactive users are sent with onmicro_active = 0."""
    synced = 0
    for batch in iter_user_batches(limit=limit):
        plans = plans_by_user_id([user.id for user in batch])
        payloads = [contact_payload(user, plans.get(user.id, "Free")) for user in batch]
        client.upsert_contacts(payloads)
        synced += len(payloads)
        log.info("Upserted %s Mautic contacts", len(payloads))
    return synced
