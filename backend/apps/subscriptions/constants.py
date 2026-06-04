from dataclasses import dataclass

from django.conf import settings

from apps.utils.global_variables import UsageVariables

PLANS = {
    "free": "Free",
    "pro": "Pro", # Pro was once referred to as "Individual". Might still find references to "Individual" in the codebase.
    "enterprise": "Enterprise",
    "top_up": "TopUp",
}

PRICE_IDS = {
    "pro": settings.PRO_PLAN_PRICE_ID,
    "enterprise": settings.ENTERPRISE_PLAN_PRICE_ID,
    "top_up": settings.TOP_UP_CREDITS_PLAN_ID
}


@dataclass(frozen=True)
class Tier:
    """Static definition of a subscription tier's entitlements."""
    name: str
    price_id: str | None  # None for the Free tier (no Stripe price)
    monthly_credits: int
    max_apps: int


# Source of truth for tier entitlements. Credits granted per period and the
# microapp cap are derived from here rather than stored in the database.
TIERS = {
    PLANS["free"]: Tier(
        name=PLANS["free"],
        price_id=None,
        monthly_credits=UsageVariables.FREE_PLAN_CREDIT_LIMIT,
        max_apps=UsageVariables.FREE_PLAN_MICROAPP_LIMIT,
    ),
    PLANS["pro"]: Tier(
        name=PLANS["pro"],
        price_id=PRICE_IDS["pro"],
        monthly_credits=UsageVariables.PRO_PLAN_CREDIT_LIMIT,
        max_apps=9999,
    ),
    PLANS["enterprise"]: Tier(
        name=PLANS["enterprise"],
        price_id=PRICE_IDS["enterprise"],
        monthly_credits=UsageVariables.ENTERPRISE_PLAN_CREDIT_LIMIT,
        max_apps=9999,
    ),
}

# Reverse lookup from a Stripe price_id to its tier.
PRICE_TO_TIER = {tier.price_id: tier for tier in TIERS.values() if tier.price_id}


def tier_for_price(price_id: str | None) -> Tier:
    """Return the Tier for a Stripe price_id, defaulting to the Free tier."""
    return PRICE_TO_TIER.get(price_id, TIERS[PLANS["free"]])
