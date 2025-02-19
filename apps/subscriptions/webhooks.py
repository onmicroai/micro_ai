import stripe
import logging
from django.http import HttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.conf import settings

from apps.subscriptions.helpers import upsert_subscription
from apps.subscriptions.models import Subscription

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
        if event["type"] == "customer.subscription.created":
            handle_subscription_created_or_updated(event)
        elif event["type"] == "customer.subscription.updated":
            handle_subscription_created_or_updated(event)
        elif event["type"] == "customer.subscription.deleted":
            handle_subscription_deleted(event)
        elif event["type"] == "payment_method.attached":
            handle_payment_method_attachment(event)
        elif event["type"] == "customer.deleted":
            handle_customer_deleted(event)
        else:
            log.warning(f"Unhandled event type: {event['type']}")
    except Exception as e:
        log.error(f"Error handling event {event['id']}: {e}")
        return HttpResponse(status=500)

    return HttpResponse(status=200)

def handle_payment_method_attachment(event):
    payment_method = event["data"]["object"]

    if not payment_method.get("customer"):
        log.info("Payment method has no associated customer, skipping.")
        return

    customer_id = payment_method["customer"]

    try:
        # Update customer's default payment method
        stripe.Customer.modify(
            customer_id,
            invoice_settings={"default_payment_method": payment_method["id"]}
        )
        log.info(f"Updated default payment method for customer {customer_id}")
    except stripe.error.StripeError as e:
        log.error(f"Error updating customer {customer_id}: {e}")
        return

    try:
        # Retrieve active subscriptions for the customer
        subscriptions = stripe.Subscription.list(customer=customer_id, limit=10)
        active_subscription = next(
            (sub for sub in subscriptions.auto_paging_iter() if sub["status"] != "canceled"),
            None
        )

        if not active_subscription:
            log.info(f"No active subscription found for customer {customer_id}.")
            return

        # Update subscription's default payment method
        stripe.Subscription.modify(
            active_subscription["id"],
            default_payment_method=payment_method["id"]
        )
        log.info(f"Updated default payment method for subscription {active_subscription['id']}")
    except stripe.error.StripeError as e:
        log.error(f"Error updating subscription for customer {customer_id}: {e}")

def handle_customer_deleted(event):
    """
    Handles customer.deleted event by removing associated subscriptions from the database.
    """
    customer = event["data"]["object"]
    customer_id = customer["id"]

    try:
        subscriptions = Subscription.objects.filter(customer_id=customer_id)
        deleted_count, _ = subscriptions.delete()
        
        log.info(f"Deleted {deleted_count} subscriptions for customer {customer_id}")

    except Exception as e:
        log.error(f"Error deleting subscriptions for customer {customer_id}: {e}")


def handle_subscription_deleted(event):
    """
    Called when a subscription is deleted.
    Builds the subscription data from the Stripe event and calls upsert_subscription.
    """
    stripe_subscription = event["data"]["object"]

    data = {
        "subscription_id": stripe_subscription.get("id"),
        # For deletion we take the price from the first item
        "price_id": (
            stripe_subscription.get("items", {}).get("data", [])[0]
            .get("price", {})
            .get("id")
            if stripe_subscription.get("items", {}).get("data")
            else None
        ),
        "status": stripe_subscription.get("status"),
        "canceled_at": int(stripe_subscription.get("canceled_at"))
        if stripe_subscription.get("canceled_at")
        else None,
    }

    upsert_subscription(stripe_subscription.get("customer"), data)


def handle_subscription_created_or_updated(event):
    """
    Called when a subscription is created or updated.
    Builds the subscription data from the Stripe event and calls upsert_subscription.
    """
    stripe_subscription = event["data"]["object"]

    subscription_items = stripe_subscription.get("items", {}).get("data", [])
    subscription_item_id = subscription_items[0]["id"] if subscription_items else None 

    data = {
        "subscription_id": stripe_subscription.get("id"),
        # For creation/update, take the price from the last item
        "price_id": (
            stripe_subscription.get("items", {}).get("data", [])[-1]
            .get("price", {})
            .get("id")
            if stripe_subscription.get("items", {}).get("data")
            else None
        ),
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
        "subscription_item_id": subscription_item_id,
    }

    upsert_subscription(stripe_subscription.get("customer"), data)
