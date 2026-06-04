"""
Central credit service.

This module is the single entry point for reading and mutating a user's credit
balance. It is introduced in Phase 1 of the subscriptions/credits migration and is
not yet wired into the request path; see docs/subscriptions-credits-migration-plan.md.

Spending always draws from subscription credits first, then top-up credits.
Subscription credits reset to the tier allotment each period (lazy reset on access,
also triggered by the Stripe `invoice.paid` webhook). Top-up credits never reset.
"""
import logging
from datetime import datetime, timedelta, timezone as dt_timezone

from django.db import transaction
from django.utils import timezone

from apps.subscriptions.constants import Tier, tier_for_price
from apps.subscriptions.exceptions import SubscriptionConfigError
from apps.subscriptions.helpers import subscription_allows_credit_period_reset
from apps.subscriptions.models import CreditTransaction, CreditWallet, Subscription

log = logging.getLogger("micro_ai.subscription")

# Free-tier credits refill on a rolling 30-day window since there is no Stripe
# renewal event to drive the reset.
FREE_PERIOD = timedelta(days=30)


class InsufficientCredits(SubscriptionConfigError):
    """Raised when a spend exceeds the user's available credits."""


def _active_subscription(user) -> Subscription | None:
    return Subscription.objects.filter(user=user).order_by("-created_at").first()


def _tier_for_user(user, subscription: Subscription | None = None) -> Tier:
    subscription = subscription or _active_subscription(user)
    price_id = subscription.price_id if subscription else None
    return tier_for_price(price_id)


def _next_reset_at(subscription: Subscription | None) -> datetime:
    """
    Compute when subscription credits should next refill. For Stripe-backed
    subscriptions this is the end of the current period; otherwise a rolling
    30-day window from now.
    """
    now = timezone.now()
    period_end = getattr(subscription, "period_end", None) if subscription else None
    if period_end:
        candidate = datetime.fromtimestamp(int(period_end), tz=dt_timezone.utc)
        if candidate > now:
            return candidate
    return now + FREE_PERIOD


def get_or_create_wallet(user) -> CreditWallet:
    """Return the user's wallet, creating it (funded with the tier allotment) if absent."""
    wallet = CreditWallet.objects.filter(user=user).first()
    if wallet:
        return wallet

    subscription = _active_subscription(user)
    tier = _tier_for_user(user, subscription)
    wallet = CreditWallet.objects.create(
        user=user,
        subscription_credits=tier.monthly_credits,
        topup_credits=0,
        reset_at=_next_reset_at(subscription),
    )
    CreditTransaction.objects.create(
        user=user, amount=tier.monthly_credits, reason="monthly_grant"
    )
    log.info("Created wallet for %s with %d credits", user.email, tier.monthly_credits)
    return wallet


def ensure_period_fresh(wallet: CreditWallet, subscription: Subscription | None = None) -> CreditWallet:
    """
    Lazily reset subscription credits if the wallet's period has elapsed. Top-up
    credits are untouched. Returns the (possibly refreshed) wallet.
    """
    now = timezone.now()
    if wallet.reset_at and wallet.reset_at > now:
        return wallet

    subscription = subscription or _active_subscription(wallet.user)
    if not subscription_allows_credit_period_reset(subscription):
        return wallet
    tier = _tier_for_user(wallet.user, subscription)
    wallet.subscription_credits = tier.monthly_credits
    wallet.reset_at = _next_reset_at(subscription)
    wallet.save(update_fields=["subscription_credits", "reset_at", "updated_at"])
    CreditTransaction.objects.create(
        user=wallet.user, amount=tier.monthly_credits, reason="monthly_grant"
    )
    log.info("Lazy-reset subscription credits for %s to %d", wallet.user.email, tier.monthly_credits)
    return wallet


def grant_subscription_credits(user, tier: Tier, period_end=None) -> CreditWallet:
    """
    Reset subscription credits to the tier allotment (used on renewal / plan change).
    Top-up credits are preserved.
    """
    with transaction.atomic():
        wallet, _ = CreditWallet.objects.select_for_update().get_or_create(
            user=user,
            defaults={
                "subscription_credits": 0,
                "topup_credits": 0,
                "reset_at": timezone.now() + FREE_PERIOD,
            },
        )
        wallet.subscription_credits = tier.monthly_credits
        if period_end:
            wallet.reset_at = datetime.fromtimestamp(int(period_end), tz=dt_timezone.utc)
        else:
            wallet.reset_at = timezone.now() + FREE_PERIOD
        wallet.save(update_fields=["subscription_credits", "reset_at", "updated_at"])
        CreditTransaction.objects.create(
            user=user, amount=tier.monthly_credits, reason="monthly_grant"
        )
    log.info("Granted %d subscription credits to %s", tier.monthly_credits, user.email)
    return wallet


def grant_topup_credits(user, amount: int, reason: str = "topup") -> CreditWallet:
    """Add roll-over top-up credits to the user's wallet."""
    with transaction.atomic():
        wallet, _ = CreditWallet.objects.select_for_update().get_or_create(
            user=user,
            defaults={
                "subscription_credits": 0,
                "topup_credits": 0,
                "reset_at": timezone.now() + FREE_PERIOD,
            },
        )
        wallet.topup_credits += amount
        wallet.save(update_fields=["topup_credits", "updated_at"])
        CreditTransaction.objects.create(user=user, amount=amount, reason=reason)
    log.info("Granted %d top-up credits to %s (%s)", amount, user.email, reason)
    return wallet


def available_credits(user) -> int:
    """Return the user's total spendable credits, applying a lazy reset first."""
    wallet = get_or_create_wallet(user)
    ensure_period_fresh(wallet)
    return wallet.total_available


def spend_credits(
    user,
    amount: int,
    run=None,
    consumer=None,
    *,
    allow_partial: bool = False,
) -> int:
    """
    Atomically spend credits, drawing from subscription credits first and then
    top-up credits. Returns the wallet's remaining total after the spend.

    By default the full `amount` must be covered or InsufficientCredits is raised.
    With `allow_partial=True` (used after AI runs), up to `amount` is charged —
    never more than the wallet holds — so a costly run still drains the balance.
    """
    if amount < 0:
        raise ValueError("Cannot spend a negative amount of credits")
    if amount == 0:
        wallet = get_or_create_wallet(user)
        ensure_period_fresh(wallet)
        return wallet.total_available

    with transaction.atomic():
        wallet = (
            CreditWallet.objects.select_for_update().filter(user=user).first()
        )
        if wallet is None:
            wallet = get_or_create_wallet(user)
            wallet = CreditWallet.objects.select_for_update().get(pk=wallet.pk)

        ensure_period_fresh(wallet)

        available = wallet.total_available
        if available < amount:
            if allow_partial:
                to_spend = available
            else:
                raise InsufficientCredits(
                    f"User {user.email} has {available} credits, needs {amount}"
                )
        else:
            to_spend = amount

        if to_spend == 0:
            return 0

        from_subscription = min(wallet.subscription_credits, to_spend)
        wallet.subscription_credits -= from_subscription
        wallet.topup_credits -= (to_spend - from_subscription)
        wallet.save(update_fields=["subscription_credits", "topup_credits", "updated_at"])

        CreditTransaction.objects.create(
            user=user,
            amount=-to_spend,
            reason="usage",
            run=run,
            consumer=consumer,
        )

        if allow_partial and to_spend < amount:
            log.warning(
                "Partial credit charge for %s: charged %d of %d (run=%s)",
                user.email,
                to_spend,
                amount,
                getattr(run, "id", None),
            )

        return wallet.total_available
