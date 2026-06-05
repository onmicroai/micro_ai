import logging
from django.urls import reverse
from django.utils import timezone
from django.conf import settings
import stripe

from stripe.error import InvalidRequestError
from apps.subscriptions.constants import PLANS, PRICE_IDS, tier_for_price
from apps.subscriptions.models import StripeCustomer, Subscription

from apps.web.meta import absolute_url
from apps.utils.billing import get_stripe_module

log = logging.getLogger("micro_ai.subscription")

CURRENCY_SIGILS = {
    "USD": "$",
    "EUR": "€",
}

def subscription_is_active(subscription) -> bool:
    return subscription.status in ["active", "trialing"]


# Stripe statuses where paid subscription credits must not refresh or display as usable.
SUBSCRIPTION_BILLING_BLOCKED_STATUSES = frozenset(
    {"incomplete", "incomplete_expired", "past_due", "unpaid"}
)


def is_free_tier_subscription(subscription: Subscription | None) -> bool:
    """True when the user has no paid Stripe plan (wallet-only Free tier)."""
    if subscription is None:
        return True
    # Legacy internal free rows may still exist until cleaned up.
    if subscription.source == "internal" or subscription.price_id in (None, "id_free"):
        return True
    return tier_for_price(subscription.price_id).name == PLANS["free"]


def subscription_allows_credit_period_reset(subscription: Subscription | None) -> bool:
    """
    Lazy monthly resets (and invoice.paid-style refills on access) apply only to
    active paid subs or Free-tier users. Past-due/unpaid subs keep the last paid
    wallet balance frozen until billing is fixed.
    """
    if is_free_tier_subscription(subscription):
        return True
    return subscription_is_active(subscription)


def subscription_billing_blocked(subscription: Subscription | None) -> bool:
    if is_free_tier_subscription(subscription):
        return False
    return subscription.status in SUBSCRIPTION_BILLING_BLOCKED_STATUSES


def subscription_is_trialing(subscription) -> bool:
    return subscription.status == "trialing" and subscription.trial_end > timezone.now()

def get_friendly_currency_amount(price: dict, currency: str = None):
    if not currency:
        currency = price.get("currency")
    if currency != price.get("currency"):
        amount = get_price_for_secondary_currency(price, currency)
    elif price.get("unit_amount") is None:
        return "Unknown"
    else:
        amount = price.get("unit_amount")
    return get_price_display_with_currency(amount / 100, currency)


def get_price_for_secondary_currency(price: dict, currency: str):
    stripe_module = get_stripe_module()
    stripe_price = stripe_module.Price.retrieve(price.get("id"), expand=["currency_options"])
    unit_amount_decimal = (
        stripe_price.get("currency_options", {})
        .get(currency, {})
        .get("unit_amount_decimal")
    )
    return int(float(unit_amount_decimal))


def get_price_display_with_currency(amount: float, currency: str) -> str:
    currency = currency.upper()
    sigil = CURRENCY_SIGILS.get(currency, "")
    if sigil:
        return f"{sigil}{amount:.2f}"
    else:
        return f"{amount:.2f} {currency}"


def get_subscription_urls():
    url_bases = [
        "subscription_details",
        "subscription_demo",
        "subscription_gated_page",
        "metered_billing_demo",
        "create_checkout_session",
        "checkout_canceled",
    ]

    def _construct_url(base):
        return reverse(f"subscriptions:{base}")

    return {url_base: _construct_url(url_base) for url_base in url_bases}

def create_stripe_checkout_session(plan, customer_id=None, customer_email=None, 
    success_url=None, cancel_url=None, metadata=None):
    stripe_module = get_stripe_module()

    price_id = get_price_id_from_plan(plan)

    default_success = absolute_url(reverse("subscriptions:subscription_confirm"))
    default_cancel = absolute_url(reverse("subscriptions:subscription_confirm"))

    success_url = success_url or default_success
    cancel_url = cancel_url or default_cancel

    mode = "payment" if plan == PLANS["top_up"] else "subscription"

    try:
        checkout_session_data = {
            "success_url": success_url,
            "cancel_url": cancel_url,
            "payment_method_types": ["card"],
            "mode": mode,
            "line_items": [
                {
                    "price": price_id,
                    "quantity": 1,
                }
            ],
            "allow_promotion_codes": True,
        }

        if customer_id:
            checkout_session_data["customer"] = customer_id
        elif customer_email:
            checkout_session_data["customer_email"] = customer_email

        if metadata:
            checkout_session_data["metadata"] = metadata

        checkout_session = stripe_module.checkout.Session.create(**checkout_session_data)

        return checkout_session

    except:
        raise

def get_subscription_details(subscription_id: str) -> dict:
    """
    Retrieves subscription details from Stripe API.
    """
    stripe_module = get_stripe_module()
    try:
        # Fetch subscription details from Stripe
        subscription = stripe_module.Subscription.retrieve(subscription_id)

        # Ensure there are subscription items
        if not subscription.get("items") or not subscription["items"]["data"]:
            raise ValueError(f"Subscription {subscription_id} has no associated items.")

        # Extract the first item in the subscription
        first_item = subscription["items"]["data"][0]

        return {
            "latest_invoice_id": subscription.get("latest_invoice"),
            "price_id": first_item["price"]["id"],
            "data_id": first_item["id"],
            "quantity": first_item.get("quantity", 1),
            "customer_id": subscription["customer"],
            "status": subscription["status"],
            "cancel_at_period_end": subscription["cancel_at_period_end"],
            "current_period_start": int(subscription["current_period_start"]),
            "current_period_end": int(subscription["current_period_end"]),
        }
    
    except stripe.error.StripeError as e:
        raise Exception(f"Failed to retrieve subscription {subscription_id}: {str(e)}")

def create_customer_portal_session(
    user,
    customer_portal_flow_type: str = None,
    plan: str = None,
    success_url: str = None
) -> str:
    """
    Creates a Stripe customer portal session for the current user.

    Args:
        user: The current user.
        customer_portal_flow_type (str, optional): The flow type for the customer portal.
        plan (str, optional): The subscription plan.
        success_url (str, optional): The URL to redirect to after completion.
    """
    stripe_module = get_stripe_module()

    subscription = Subscription.objects.filter(user_id=user.id).first()
    if not subscription:
        raise Exception(f"Subscription for user {user.id} not found.")

    price_id = get_price_id_from_plan(plan)

    # URL to which the customer will be redirected after completing the portal flow
    options = {
        "customer": subscription.customer.customer_id,
        "return_url": success_url,
    }

    if customer_portal_flow_type == "subscription_update_confirm":
        if not subscription.subscription_id or not price_id:
            raise Exception("For subscription update, subscription_id and price_id must be provided.")
        stripe_subscription = get_subscription_details(subscription.subscription_id)
        configuration = (getattr(settings, "DEFAULT_PORTAL_CONFIGURATION_ID", None) or "").strip()
        if configuration:
            options["configuration"] = configuration
        options["flow_data"] = {
            "after_completion": {
                "redirect": {
                    "return_url": success_url,
                },
                "type": "redirect",
            },
            "type": customer_portal_flow_type,
            "subscription_update_confirm": {
                "subscription": subscription.subscription_id,
                "items": [{
                    "id": stripe_subscription["data_id"],
                    "price": price_id,
                    "quantity": 1,
                }]
            }
        }

    portal_session = stripe_module.billing_portal.Session.create(**options)
    return portal_session.url

def cancel_subscription(subscription_id: str, at_period_end: bool = False):
    """
    Cancels a Stripe subscription. If `at_period_end` is True, the subscription is
    set to cancel at the end of the current period; otherwise it is deleted
    immediately.
    """
    stripe_module = get_stripe_module()
    try:
        if at_period_end:
            stripe_module.Subscription.modify(subscription_id, cancel_at_period_end=True)
        else:
            stripe_module.Subscription.delete(subscription_id)
    except InvalidRequestError as e:
        if e.code != "resource_missing":
            log.error("Error canceling Stripe subscription: %s", e.user_message)

def set_subscription_max_apps(subscription, max_apps: int) -> None:
    from .models import SubscriptionConfiguration
    config, _ = SubscriptionConfiguration.objects.get_or_create(
        subscription=subscription, defaults={"max_apps": max_apps}
    )
    if config.max_apps != max_apps:
        config.max_apps = max_apps
        config.save()

def upsert_subscription(customer_id, data):
    """
    Update the local Subscription mirror from a Stripe event and sync the credit
    wallet's tier when subscription membership materially changes.

    Routine updates that don't change the tier leave the mid-period balance
    untouched; the monthly reset is driven by the invoice.paid webhook.
    """
    from apps.subscriptions.credits import grant_subscription_credits

    new_subscription_id = data.get("subscription_id")
    stripe_customer = StripeCustomer.objects.filter(customer_id=customer_id).first()

    if stripe_customer is None or new_subscription_id is None:
        return

    subscription = Subscription.objects.filter(customer=stripe_customer).first()
    was_existing = subscription is not None
    old_price_id = subscription.price_id if subscription else None

    period_start = data.get("period_start")
    period_end = data.get("period_end")

    if subscription:
        subscription.subscription_id = data.get("subscription_id")
        subscription.price_id = data.get("price_id")
        if data.get("status") is not None:
            subscription.status = data.get("status")
        subscription.cancel_at_period_end = data.get("cancel_at_period_end", False)
        if period_start is not None:
            subscription.period_start = period_start
        if period_end is not None:
            subscription.period_end = period_end
        subscription.canceled_at = data.get("canceled_at")
        subscription.save()

        log.info(f"Updated subscription {subscription.subscription_id} for customer {customer_id}")
    else:
        existing_subscription = stripe_customer.user.subscriptions.first()
        if existing_subscription:
            existing_subscription.delete()

        subscription = Subscription(
            user=stripe_customer.user,
            customer=stripe_customer,
            subscription_id=new_subscription_id,
            source="stripe",
            price_id=data.get("price_id"),
            status=data.get("status"),
            cancel_at_period_end=data.get("cancel_at_period_end"),
            period_start=int(period_start) if period_start else None,
            period_end=int(period_end) if period_end else None,
        )
        subscription.save()

        log.info(f"Created new subscription {subscription.subscription_id} for user {stripe_customer.user.email}")

    # Sync the wallet's tier credits when membership materially changes:
    # a brand-new subscription, a plan change, or a downgrade to Free (cancellation).
    new_price_id = data.get("price_id")
    downgraded_to_free = subscription.status in ("canceled", "incomplete_expired")
    effective_tier = tier_for_price(None) if downgraded_to_free else tier_for_price(new_price_id)
    tier_changed = old_price_id != new_price_id

    if (not was_existing) or tier_changed or downgraded_to_free:
        grant_subscription_credits(subscription.user, effective_tier, period_end)
        log.info(
            "Synced wallet for %s to tier %s", subscription.user.email, effective_tier.name
        )
    
def get_plan_name(price_id: str | None) -> str:
    """
    Returns the plan name based on the provided price_id.

    If the price_id matches the pro or enterprise plan, 
    it returns the corresponding plan name. Otherwise, it defaults to the Free plan.
    """
    if price_id == PRICE_IDS.get("pro"):
        return PLANS["pro"]
    elif price_id == PRICE_IDS.get("enterprise"):
        return PLANS["enterprise"]
    elif price_id == PRICE_IDS.get("top_up"):
        return PLANS["top_up"]
    return PLANS["free"] 

def get_price_id_from_plan(plan_name: str) -> str | None:
    """
    Returns the corresponding price ID for the given plan name.

    Each plan ("Free", "Pro", "Enterprise") is mapped to its respective price ID.
    """
    plan_price_mapping = {
        "Free": None,  # Free plan does not require a price ID
        "Pro": PRICE_IDS["pro"],
        "Enterprise": PRICE_IDS["enterprise"],
        "TopUp": PRICE_IDS["top_up"]
    }

    return plan_price_mapping.get(plan_name)

