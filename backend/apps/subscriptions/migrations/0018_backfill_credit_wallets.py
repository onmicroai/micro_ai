"""
Phase 2 of the subscriptions/credits migration.

Backfills a CreditWallet for every user who currently holds credits, so the new
wallet-based system starts with balances identical to the legacy
BillingCycle / TopUpToSubscription system.

Per user:
  - subscription_credits = credits_remaining of their most recent open BillingCycle (else 0)
  - topup_credits        = sum of remaining credits across their TopUpToSubscription rows
  - reset_at             = that BillingCycle's end_date (if still in the future), else now + 30d

An opening-balance CreditTransaction (reason="adjustment") is recorded for each
non-zero balance so the audit ledger sums to the wallet balance.

This migration is data-only and reversible (reverse drops the wallets and the
adjustment transactions it created).
"""
from datetime import timedelta

from django.db import migrations
from django.utils import timezone

FREE_PERIOD = timedelta(days=30)


def backfill_wallets(apps, schema_editor):
    CreditWallet = apps.get_model("subscriptions", "CreditWallet")
    CreditTransaction = apps.get_model("subscriptions", "CreditTransaction")
    BillingCycle = apps.get_model("subscriptions", "BillingCycle")
    TopUpToSubscription = apps.get_model("subscriptions", "TopUpToSubscription")

    now = timezone.now()

    # Sum remaining top-up credits per user.
    topup_by_user: dict[int, int] = {}
    for tu in TopUpToSubscription.objects.values("user_id", "allocated_credits", "used_credits"):
        remaining = max(0, (tu["allocated_credits"] or 0) - (tu["used_credits"] or 0))
        if remaining:
            topup_by_user[tu["user_id"]] = topup_by_user.get(tu["user_id"], 0) + remaining

    # Users who currently hold any credits (open cycle and/or top-ups).
    user_ids = set(
        BillingCycle.objects.filter(status="open").values_list("user_id", flat=True)
    )
    user_ids |= set(topup_by_user.keys())

    for user_id in user_ids:
        if CreditWallet.objects.filter(user_id=user_id).exists():
            continue

        cycle = (
            BillingCycle.objects.filter(user_id=user_id, status="open")
            .order_by("-start_date")
            .first()
        )
        subscription_credits = max(0, cycle.credits_remaining) if cycle else 0
        topup_credits = topup_by_user.get(user_id, 0)

        if cycle and cycle.end_date and cycle.end_date > now:
            reset_at = cycle.end_date
        else:
            reset_at = now + FREE_PERIOD

        CreditWallet.objects.create(
            user_id=user_id,
            subscription_credits=subscription_credits,
            topup_credits=topup_credits,
            reset_at=reset_at,
        )

        if subscription_credits:
            CreditTransaction.objects.create(
                user_id=user_id, amount=subscription_credits, reason="adjustment"
            )
        if topup_credits:
            CreditTransaction.objects.create(
                user_id=user_id, amount=topup_credits, reason="adjustment"
            )


def reverse_backfill(apps, schema_editor):
    CreditWallet = apps.get_model("subscriptions", "CreditWallet")
    CreditTransaction = apps.get_model("subscriptions", "CreditTransaction")
    CreditTransaction.objects.filter(reason="adjustment").delete()
    CreditWallet.objects.all().delete()


class Migration(migrations.Migration):

    dependencies = [
        ("subscriptions", "0017_credittransaction_creditwallet"),
    ]

    operations = [
        migrations.RunPython(backfill_wallets, reverse_backfill),
    ]
