import time
import stripe
import logging
from django.http import HttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.conf import settings
from django.core.mail import mail_admins

from apps.subscriptions.helpers import upsert_subscription
from apps.subscriptions.constants import tier_for_price
from apps.subscriptions.credits import grant_subscription_credits, grant_topup_credits
from apps.subscriptions.models import StripeCustomer, Subscription
from apps.users.models import CustomUser

log = logging.getLogger("micro_ai.subscription")

@csrf_exempt
def stripe_webhook(request):
    payload = request.body
    sig_header = request.META.get("HTTP_STRIPE_SIGNATURE")
    endpoint_secret = getattr(settings, "STRIPE_WEBHOOK_SECRET", None)

    try:
        event = stripe.Webhook.construct_event(payload, sig_header, endpoint_secret)
    except ValueError as e:
        log.error(f"Invalid payload: {e}")
        return HttpResponse(status=400)
    except stripe.error.SignatureVerificationError as e:
        log.error(f"Signature verification failed: {e}")
        return HttpResponse(status=400)

    log.info(f"Received event: {event['type']} (id: {event['id']})")

    try:
        if event["type"] == "customer.created":
            handle_customer_created(event)
        elif event["type"] == "customer.subscription.created":
            handle_subscription_created_or_updated(event)
        elif event["type"] == "customer.subscription.updated":
            handle_subscription_created_or_updated(event)
        elif event["type"] == "customer.subscription.deleted":
            handle_subscription_deleted(event)
        elif event["type"] == "invoice.paid":
            handle_invoice_paid(event)
        elif event["type"] == "customer.deleted":
            handle_customer_deleted(event)
        elif event["type"] == "checkout.session.completed":
            handle_checkout_session_completed(event) 
        else:
            log.warning(f"Unhandled event type: {event['type']}")
    except Exception as e:
        log.error(f"Error handling event {event['id']}: {e}")
        return HttpResponse(status=500)

    return HttpResponse(status=200)

def handle_checkout_session_completed(event):
    """
    Handles the checkout.session.completed event.
    Verifies that the session metadata contains the correct price_id.
    """
    session = event["data"]["object"]

    customer_email = session.get("customer_details", {}).get("email")
    if not customer_email:
        log.warning("checkout.session.completed: email not found in customer_details")
        return

    received_price_id = session.get("metadata", {}).get("price_id")
    if not received_price_id:
        log.warning("checkout.session.completed: price_id not found in metadata")
        return

    if received_price_id != settings.TOP_UP_CREDITS_PLAN_ID:
        log.warning(f"checkout.session.completed: price_id does not match. Received {received_price_id}")
        return

    try:
        user = CustomUser.objects.get(email=customer_email)
    except CustomUser.DoesNotExist:
        log.error(f"checkout.session.completed: user with email {customer_email} not found in the database")
        return

    grant_topup_credits(user, settings.TOP_UP_CREDITS, reason="topup")

    log.info(f"Added {settings.TOP_UP_CREDITS} credits to user {user.email} (price_id: {received_price_id})")

def handle_customer_created(event):
    """
    Handles customer.created event by saving the new customer in the database.
    """
    customer_data = event["data"]["object"]
    customer_id = customer_data["id"]
    email = customer_data.get("email")

    try:
        user = None
        if email:
            user = CustomUser.objects.filter(email=email).first()

        stripe_customer, created = StripeCustomer.objects.get_or_create(
            customer_id=customer_id,
            user=user
        )

        if created:
            log.info(f"Created new Stripe customer: {customer_id} (user: {user}, email: {email})")
        else:
            log.info(f"Stripe customer already exists: {customer_id}")

    except Exception as e:
        log.error(f"Error creating customer record for {customer_id}: {e}")

def handle_invoice_paid(event):
    """
    Handles invoice.paid. On a recurring renewal (billing_reason ==
    "subscription_cycle") this is the monthly reset: subscription credits are
    refilled to the current tier's allotment. Top-up credits are untouched.

    The first invoice (subscription_create) and plan changes are handled by the
    subscription.created/updated events via upsert_subscription, so they are
    skipped here to avoid a double grant.
    """
    invoice = event["data"]["object"]

    if invoice.get("billing_reason") != "subscription_cycle":
        log.info(
            "invoice.paid: skipping reset for billing_reason=%s",
            invoice.get("billing_reason"),
        )
        return

    customer_id = invoice.get("customer")
    stripe_customer = StripeCustomer.objects.filter(customer_id=customer_id).first()
    if not stripe_customer:
        log.warning(f"invoice.paid: no StripeCustomer for {customer_id}")
        return

    subscription = Subscription.objects.filter(customer=stripe_customer).first()
    price_id = subscription.price_id if subscription else None
    tier = tier_for_price(price_id)

    # Pull the new period end from the invoice line items, if present.
    period_end = None
    lines = invoice.get("lines", {}).get("data", [])
    if lines:
        period_end = lines[-1].get("period", {}).get("end")

    grant_subscription_credits(stripe_customer.user, tier, period_end)
    log.info(
        "invoice.paid: reset %s to %d %s credits",
        stripe_customer.user.email, tier.monthly_credits, tier.name,
    )

def handle_customer_deleted(event):
    """
    Handles customer.deleted event by removing associated billing cycles, 
    subscriptions, and then the Stripe customer record.
    """
    customer = event["data"]["object"]
    customer_id = customer["id"]

    try:
        # Capture the owning user before deleting records so we can reset their wallet.
        existing_customer = StripeCustomer.objects.filter(customer_id=customer_id).first()
        owner = existing_customer.user if existing_customer else None

        subscriptions = Subscription.objects.filter(customer_id=customer_id)
        deleted_subscriptions, _ = subscriptions.delete()
        log.info(f"Deleted {deleted_subscriptions} subscriptions for customer {customer_id}")

        stripe_customer = StripeCustomer.objects.filter(customer_id=customer_id)
        deleted_customers, _ = stripe_customer.delete()
        log.info(f"Deleted Stripe customer {customer_id}")

        # Revert the user to the Free tier allotment now that they have no subscription.
        if owner:
            grant_subscription_credits(owner, tier_for_price(None))

    except Exception as e:
        log.error(f"Error deleting data for customer {customer_id}: {e}")

def handle_subscription_deleted(event):
    """
    Called when a subscription is deleted.
    Builds the subscription data from the Stripe event, closes open billing cycles,
    sends notifications to admins, and calls upsert_subscription(for updating information
    about subscription).
    """
    stripe_subscription = event["data"]["object"]
    subscription_items = stripe_subscription.get("items", {}).get("data", [])
    subscription_item = subscription_items[-1] if subscription_items else {}
    
    data = {
        "subscription_id": stripe_subscription.get("id"),
        "price_id": subscription_item.get("price", {}).get("id"),
        "status": stripe_subscription.get("status"),
        "canceled_at": int(stripe_subscription.get("canceled_at"))
        if stripe_subscription.get("canceled_at")
        else None,
    }

    upsert_subscription(stripe_subscription.get("customer"), data)

    try:
        stripe_customer = StripeCustomer.objects.get(
            customer_id=stripe_subscription.get("customer")
        )
        customer_email = stripe_customer.user.email
        log.info(f"Notifying admins about cancellation for {customer_email}")
    except StripeCustomer.DoesNotExist:
        customer_email = "unavailable"
        log.warning("Stripe customer not found for subscription cancellation notification")

    mail_admins(
        "Someone just canceled their subscription!",
        f"Their email was {customer_email}",
        fail_silently=True,
    )

def handle_subscription_created_or_updated(event):
    """
    Called when a subscription is created or updated.
    Builds the subscription data from the Stripe event and calls upsert_subscription.
    """
    stripe_subscription = event["data"]["object"]

    subscription_items = stripe_subscription.get("items", {}).get("data", [])
    subscription_item = subscription_items[-1] if subscription_items else {}

    data = {
        "subscription_id": stripe_subscription.get("id"),
        "price_id": subscription_item.get("price", {}).get("id"),
        "status": stripe_subscription.get("status"),
        "cancel_at_period_end": stripe_subscription.get("cancel_at_period_end"),
        "period_start": int(stripe_subscription.get("current_period_start"))
        if stripe_subscription.get("current_period_start")
        else None,
        "period_end": int(stripe_subscription.get("current_period_end"))
        if stripe_subscription.get("current_period_end")
        else None,
        "canceled_at": int(stripe_subscription.get("canceled_at"))
        if stripe_subscription.get("canceled_at")
        else None,
        "subscription_item_id": subscription_item.get("id"),
    }

    upsert_subscription(stripe_subscription.get("customer"), data)