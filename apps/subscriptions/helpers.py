import logging
import os
from django.db import transaction
from django.urls import reverse
from django.utils.translation import gettext_lazy as _
from django.utils import timezone
from django.conf import settings
import stripe

from stripe.error import InvalidRequestError
from stripe.api_resources.billing_portal.session import Session as BillingPortalSession
from stripe.api_resources.checkout import Session as CheckoutSession

from apps.subscriptions.constants import PLANS, PRICE_IDS
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
        "subscription_demo",
        "subscription_gated_page",
        "metered_billing_demo",
        "create_checkout_session",
        "checkout_canceled",
    ]

    def _construct_url(base):
        return reverse(f"subscriptions_team:{base}", args=[subscription_holder.slug])

    return {url_base: _construct_url(url_base) for url_base in url_bases}

def create_stripe_checkout_session(plan, customer_id=None, customer_email=None, 
    success_url=None, cancel_url=None, metadata=None):
    stripe_module = get_stripe_module()

    price_id = get_price_id_from_plan(plan)

    default_success = absolute_url(reverse("subscriptions:subscription_confirm"))
    default_cancel = absolute_url(reverse("subscriptions:subscription_confirm"))

    success_url = success_url or default_success
    cancel_url = cancel_url or default_cancel

    mode = "payment" if plan == settings.TOP_UP_CREDITS_PLAN else "subscription"

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

    except Exception as e:
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
        configuration = getattr(settings, "DEFAULT_PORTAL_CONFIGURATION_ID", None)
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
    Cancels a Stripe subscription.
    Before cancellation, checks for any active subscription schedules attached to the subscription
    and cancels them. Then, if `at_period_end` is True, modifies the subscription to cancel at period end;
    otherwise, deletes the subscription immediately.
    """
    stripe_module = get_stripe_module()
    try:
        # Retrieve the subscription object from the database (assuming Subscription is imported)
        subscription = Subscription.objects.get(subscription_id=subscription_id)
        
        # Cancel any active schedule associated with the subscription
        cancel_active_schedule(subscription)
        
        if at_period_end:
            stripe_module.Subscription.modify(subscription.subscription_id, cancel_at_period_end=True)
        else:
            stripe_module.Subscription.delete(subscription.subscription_id)
    except InvalidRequestError as e:
        if e.code != "resource_missing":
            log.error("Error deleting Stripe subscription: ", e.user_message)

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

    new_subscription_id = data.get("subscription_id")
    stripe_customer = StripeCustomer.objects.filter(customer_id=customer_id).first()

    if stripe_customer is None or new_subscription_id is None:
            return

    subscription = Subscription.objects.filter(
        customer=stripe_customer
    ).first()

    period_start = data.get("period_start")
    period_end = data.get("period_end")
    subscription_item_id = data.get("subscription_item_id")

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
        subscription.last_modified = timezone.now()
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
            price_id=data.get("price_id"),
            status=data.get("status"),
            cancel_at_period_end=data.get("cancel_at_period_end"),
            period_start=int(period_start) if period_start else None,
            period_end=int(period_end) if period_end else None,
        )
        subscription.save()

        log.info(f"Created new subscription {subscription.subscription_id} for user {stripe_customer.user.email}")

    user = subscription.user
    if subscription.status in ['canceled', 'incomplete_expired']:
        plan = PLANS["free"]
    else:
        plan = get_plan_name(data.get("price_id"))
    default_credits = get_default_credits_from_plan(plan)
    period_start = convert_timestamp_to_datetime(period_start) if period_start else None
    period_end = convert_timestamp_to_datetime(period_end) if period_end else None

    billing_cycle = BillingCycle.objects.filter(
        user=user
    ).first()

    if subscription.status in ['active', 'trialing']:
        status_value = 'open'
    elif subscription.status in ['canceled', 'incomplete_expired']:
        status_value = 'closed'
    else:
        status_value = 'error'

    if billing_cycle:
        # Set the billing cycle status based on the subscription status.
        # For example, if the subscription is 'active' or 'trialing', mark as 'open';
        # if the subscription is 'canceled' or 'incomplete_expired', mark as 'closed'; 
        # otherwise('past_due', 'incompleted'), mark as 'error'.
        billing_cycle.subscription = subscription
        if period_start is not None:
            billing_cycle.start_date = period_start
        if period_end is not None:
            billing_cycle.end_date = period_end
        billing_cycle.credits_allocated = default_credits
        billing_cycle.credits_used = 0
        billing_cycle.status = status_value
        billing_cycle.credits_remaining = default_credits
        billing_cycle.save()

        log.info(f"Updated billing cycle {billing_cycle.id} for user {user.email}")
    else:
        status_value = "error" if subscription.status == "incomplete" else "open"
        billing_cycle = BillingCycle.objects.create(
            user=user,
            subscription=subscription,
            status=status_value,
            start_date=period_start,
            end_date=period_end,
            credits_allocated=default_credits,
            credits_remaining=default_credits,
            stripe_subscription_item_id=subscription_item_id,
        )
        log.info(f"Created new billing cycle {billing_cycle.id} for user {user.email}")
    
def get_plan_name(price_id: str | None) -> str:
    """
    Returns the plan name based on the provided price_id.

    If the price_id matches the individual or enterprise plan, 
    it returns the corresponding plan name. Otherwise, it defaults to the Free plan.
    """
    if price_id == PRICE_IDS.get("individual"):
        return PLANS["individual"]
    elif price_id == PRICE_IDS.get("enterprise"):
        return PLANS["enterprise"]
    return PLANS["free"] 

def get_price_id_from_plan(plan_name: str) -> str | None:
    """
    Returns the corresponding price ID for the given plan name.

    Each plan ("Free", "Pro", "Enterprise") is mapped to its respective price ID.
    """
    plan_price_mapping = {
        "Free": None,  # Free plan does not require a price ID
        "Pro": PRICE_IDS["individual"],
        "Enterprise": PRICE_IDS["enterprise"],
        "TopUp": PRICE_IDS["top_up"]
    }

    return plan_price_mapping.get(plan_name)

def get_default_credits_from_plan(plan_name: str) -> int:
    """
    Returns the default number of credits allocated for a given plan.

    The function maps a plan name ("Free", "Pro", "Enterprise") 
    to its respective credit allocation.
    """
    plan_credits_mapping = {
        PLANS["free"]: 10_000,
        PLANS["individual"]: 100_000,
        PLANS["enterprise"]: 400_000,
    }

    return plan_credits_mapping.get(plan_name, 0)  # Defaults to 0 if plan is not recognized

def is_downgrade(current_plan: str, new_plan: str) -> bool:
    """
    Determines if switching from the current plan to the new plan is a downgrade.

    A downgrade occurs when the new plan has a lower priority in the defined order.
    The order of plans is determined by the `PLAN_ORDER` list, ensuring scalability 
    for future plan additions.

    Args:
        current_plan (str): The name of the user's current plan.
        new_plan (str): The name of the new plan the user wants to switch to.

    Returns:
        bool: True if the new plan is a downgrade, False otherwise.
    """
    PLAN_ORDER = [
        PLANS["free"],
        PLANS["individual"],
        PLANS["enterprise"],
    ]

    try:
        current_index = PLAN_ORDER.index(current_plan)
        new_index = PLAN_ORDER.index(new_plan)
        return new_index < current_index
    except ValueError:
        return False

def cancel_active_schedule(subscription):
    """
    Checks for any active subscription schedules attached to the given subscription.
    If a schedule contains downgrade phases, it modifies the schedule to remove them,
    adding a neutral phase if necessary, and then attempts to release the schedule
    (detach it from the subscription) if its status allows.
    """
    stripe_module = get_stripe_module()
    stripe_customer = subscription.customer
    customer_id = stripe_customer.customer_id

    scheduled_updates = stripe_module.SubscriptionSchedule.list(customer=customer_id)
    schedules_for_subscription = [
        schedule for schedule in scheduled_updates.data
        if schedule.subscription == subscription.subscription_id
    ]

    for schedule in schedules_for_subscription:
        current_phases = schedule.phases or []
        filtered_phases = []
        downgrade_phase_removed = False

        for phase in current_phases:
            items = phase.get("items", [])
            if any(item.get("price") != subscription.price_id for item in items):
                downgrade_phase_removed = True
                continue
            filtered_phases.append(phase)

        if downgrade_phase_removed:
            if not filtered_phases:
                neutral_phase = {
                    "items": [{"price": subscription.price_id, "quantity": 1}],
                    "start_date": subscription.period_end,
                    "iterations": 1,
                }
                filtered_phases = [neutral_phase]
                log.info(
                    "No phases left after removal. Added neutral phase for subscription",
                    subscription.subscription_id
                )
            stripe_module.SubscriptionSchedule.modify(
                schedule.id,
                phases=filtered_phases
            )
            log.info(
                "Modified schedule: removed downgrade phase(s), kept %d phase(s)",
                schedule.id, len(filtered_phases)
            )
            if schedule.status in ["not_started", "active"]:
                try:
                    stripe_module.SubscriptionSchedule.release(schedule.id)
                    log.info(
                        "Released schedule %s after modification", schedule.id
                    )
                except Exception as release_error:
                    log.info(
                        "Could not release schedule %s: %s", schedule.id, str(release_error)
                    )
            else:
                log.info(
                    "Schedule %s is in status %s; not releasing.", schedule.id, schedule.status
                )
        else:
            log.info(
                "No downgrade phase found in schedule %s; no modification needed.",
                schedule.id
            )
