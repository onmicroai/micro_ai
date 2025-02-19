import logging
from django.db import transaction
from django.urls import reverse
from django.utils.translation import gettext_lazy as _
from django.utils import timezone
from django.conf import settings
import stripe

from stripe.error import InvalidRequestError
from stripe.api_resources.billing_portal.session import Session as BillingPortalSession
from stripe.api_resources.checkout import Session as CheckoutSession

from apps.subscriptions.models import BillingCycle, StripeCustomer, Subscription

from .exceptions import SubscriptionConfigError
from apps.teams.models import Team
from apps.users.models import CustomUser
from apps.web.meta import absolute_url
from apps.utils.billing import get_stripe_module

log = logging.getLogger("micro_ai.subscription")

CURRENCY_SIGILS = {
    "USD": "$",
    "EUR": "€",
}

def subscription_is_active(subscription) -> bool:
    return subscription.status in ["active", "trialing"]


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


def get_subscription_urls(subscription_holder):
    url_bases = [
        "subscription_details",
        "create_stripe_portal_session",
        "subscription_demo",
        "subscription_gated_page",
        "metered_billing_demo",
        "create_checkout_session",
        "checkout_canceled",
    ]

    def _construct_url(base):
        return reverse(f"subscriptions_team:{base}", args=[subscription_holder.slug])

    return {url_base: _construct_url(url_base) for url_base in url_bases}


def create_stripe_checkout_session(customer_id, stripe_price_id, slug):
    stripe_module = get_stripe_module()
    success_url = absolute_url(reverse("subscriptions:subscription_confirm"))
    cancel_url = absolute_url(reverse("subscriptions_team:checkout_canceled", args=[slug]))

    try:
        checkout_session = stripe_module.checkout.Session.create(
            success_url=success_url + "?session_id={CHECKOUT_SESSION_ID}",
            cancel_url=cancel_url,
            payment_method_types=["card"],
            mode="subscription",
            line_items=[
                {
                    "price": stripe_price_id,
                    "quantity": 1,
                }
            ],
            allow_promotion_codes=True,
            metadata={"source": "subscriptions"},
            customer=customer_id,
        )

        return checkout_session

    except Exception as e:
        raise

def create_stripe_portal_session(subscription_holder: Team) -> BillingPortalSession:
    stripe_module = get_stripe_module()
    if not getattr(subscription_holder, "subscription", None) or not getattr(subscription_holder, "customer", None):
        raise SubscriptionConfigError(
            _("Whoops, we couldn't find a subscription associated with your account!")
        )
    subscription_urls = get_subscription_urls(subscription_holder)
    portal_session = stripe_module.billing_portal.Session.create(
        customer=subscription_holder.subscription.customer.customer_id,
        return_url=absolute_url(subscription_urls["subscription_details"]),
    )
    return portal_session


def cancel_subscription(subscription_id: str):
    stripe_module = get_stripe_module()
    try:
        deleted_subscription = stripe_module.Subscription.delete(subscription_id)
    except InvalidRequestError as e:
        if e.code != "resource_missing":
            log.error("Error deleting Stripe subscription: %s", e.user_message)
    else:
        update_local_subscription_from_stripe_data(deleted_subscription) # type: ignore


def set_subscription_max_apps(subscription, max_apps: int) -> None:
    from .models import SubscriptionConfiguration
    config, _ = SubscriptionConfiguration.objects.get_or_create(
        subscription=subscription, defaults={"max_apps": max_apps}
    )
    if config.max_apps != max_apps:
        config.max_apps = max_apps
        config.save()


def get_subscription_max_apps(subscription) -> int:
    from .models import SubscriptionConfiguration
    return SubscriptionConfiguration.get_max_apps(subscription)

def upsert_subscription(customer_id, data):
    from apps.utils.usage_helper import convert_timestamp_to_datetime
    subscription = Subscription.objects.filter(customer__customer_id=customer_id).first()

    if subscription:
        subscription.subscription_id = data.get("subscription_id")
        subscription.price_id = data.get("price_id")
        if data.get("status") is not None:
            subscription.status = data.get("status")
        subscription.cancel_at_period_end = data.get("cancel_at_period_end", False)
        if data.get("period_start") is not None:
            subscription.period_start = data.get("period_start")
        if data.get("period_end") is not None:
            subscription.period_end = data.get("period_end")
        subscription.canceled_at = data.get("canceled_at")
        subscription.last_modified = timezone.now()
        subscription.save()
    else:
        stripe_customer = (
            StripeCustomer.objects.select_related("user")
            .filter(customer_id=customer_id)
            .first()
        )
        if stripe_customer is None:
            return
        if data.get("subscription_id") is None:
            return

        existing_subscription = stripe_customer.user.subscriptions.first()
        if existing_subscription:
            existing_subscription.delete()

        new_subscription = Subscription(
            user=stripe_customer.user,
            customer=stripe_customer,
            subscription_id=data.get("subscription_id"),
            price_id=data.get("price_id"),
            status=data.get("status"),
            cancel_at_period_end=data.get("cancel_at_period_end"),
            period_start=int(data.get("period_start")),
            period_end=int(data.get("period_end")),
        )
        new_subscription.save()

        user = stripe_customer.user
        period_start = data.get("period_start")
        period_end = data.get("period_end")
        subscription_item_id = data.get("subscription_item_id")

        if user and period_start and period_end and subscription_item_id:
            default_credits = 10000
            period_start = convert_timestamp_to_datetime(data.get("period_start"))
            period_end = convert_timestamp_to_datetime(data.get("period_end"))
            new_cycle = BillingCycle.get_or_create_active_cycle(
                user=user,
                subscription=new_subscription,
                period_start=period_start,
                period_end=period_end,
                credits_allocated=default_credits,
                subscription_item_id=subscription_item_id,
            )
            log.info(f"Created initial billing cycle {new_cycle.id} for user {user.email}")

def get_price_id_from_tier(tier_name: str) -> str | None:
    plan_mapping = {
        "Free": None,
        "Pro": getattr(settings, "INDIVIDUAL_PLAN_PRICE_ID", None),
        "Enterprise": None, 
    }

    return plan_mapping.get(tier_name)