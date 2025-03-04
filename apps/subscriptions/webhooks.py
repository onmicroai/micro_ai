import time
import stripe
import logging
from django.http import HttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.conf import settings
from django.core.mail import mail_admins

from apps.subscriptions.helpers import upsert_subscription
from apps.subscriptions.models import BillingCycle, StripeCustomer, Subscription, TopUpToSubscription
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
        elif event["type"] == "payment_method.attached":
            handle_payment_method_attachment(event)
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
    customer_id = session.get("customer")
    
    if not customer_id:
        log.warning("checkout.session.completed: customer_id not found")
        return

    # Retrieve the price_id from metadata.
    # Ensure that when creating the checkout session you include:
    # metadata={'price_id': settings.TOP_UP_CREDITS_PLAN_ID}
    received_price_id = session.get("metadata", {}).get("price_id")
    if not received_price_id:
        log.warning("checkout.session.completed: price_id not found in metadata")
        return

    # Verify that the received price_id matches the expected price_id.
    if received_price_id != settings.TOP_UP_CREDITS_PLAN_ID:
        log.warning(f"checkout.session.completed: price_id does not match. Received {received_price_id}")
        return

    try:
        stripe_customer = StripeCustomer.objects.get(customer_id=customer_id)
        user = stripe_customer.user
    except StripeCustomer.DoesNotExist:
        log.error(f"checkout.session.completed: customer {customer_id} not found in the database")
        return

    TopUpToSubscription.objects.create(
        user=user,
        allocated_credits=20000
    )

    log.info(f"Added 20000 credits to user {user.email} (price_id: {received_price_id})")

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
    Handles customer.deleted event by removing associated billing cycles, 
    subscriptions, and then the Stripe customer record.
    """
    customer = event["data"]["object"]
    customer_id = customer["id"]

    try:
        billing_cycles = BillingCycle.objects.filter(subscription__customer_id=customer_id)
        deleted_billing_cycles, _ = billing_cycles.delete()
        log.info(f"Deleted {deleted_billing_cycles} billing cycles for customer {customer_id}")

        subscriptions = Subscription.objects.filter(customer_id=customer_id)
        deleted_subscriptions, _ = subscriptions.delete()
        log.info(f"Deleted {deleted_subscriptions} subscriptions for customer {customer_id}")

        stripe_customer = StripeCustomer.objects.filter(customer_id=customer_id)
        deleted_customers, _ = stripe_customer.delete()
        log.info(f"Deleted Stripe customer {customer_id}")

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