import logging
from django.core.mail import mail_admins
from djstripe import webhooks
from djstripe.models import Customer, Subscription, Price
from django.utils import timezone
from django.db import transaction
from .models import BillingCycle

from apps.teams.models import Team
from .helpers import provision_subscription
import time
from django.db.models import Q

log = logging.getLogger("micro_ai.subscription")

@webhooks.handler("checkout.session.completed")
@transaction.atomic
def checkout_session_completed(event, **kwargs):
    """
    This webhook is called when a customer signs up for a subscription via Stripe Checkout.
    We must then provision the subscription and assign it to the appropriate user/team.
    """
    log.info(f"Received checkout.session.completed webhook: {event.id}")
    session = event.data["object"]
    # only process subscriptions created by this module
    if session["metadata"].get("source") == "subscriptions":
        client_reference_id = session.get("client_reference_id")
        subscription_id = session.get("subscription")
        log.info(f"Processing subscription {subscription_id} for client {client_reference_id}")
        with transaction.atomic():
            subscription_holder = Team.objects.select_for_update().get(id=client_reference_id)
            provision_subscription(subscription_holder, subscription_id)

@webhooks.handler("customer.subscription.updated")
def handle_subscription_updated(event, **kwargs):
    """Handle subscription updates and manage billing cycles"""
    log.info(f"Received customer.subscription.updated webhook: {event.id}")
    subscription = event.data.object
    djstripe_subscription = Subscription.objects.filter(id=subscription.id).first()
    
    if not djstripe_subscription:
        log.error(f"Subscription not found: {subscription.id}")
        return

    try:
        # Get subscription details
        period_start = timezone.datetime.fromtimestamp(subscription.current_period_start)
        period_end = timezone.datetime.fromtimestamp(subscription.current_period_end)
        subscription_item = subscription.items.data[0]  # Assuming one item per subscription
        
        log.info(f"Processing subscription update for {subscription.id} from {period_start} to {period_end}")
        
        # Get the team and its primary user
        team = djstripe_subscription.customer.subscriber
        if not team:
            log.error(f"No team found for subscription: {subscription.id}")
            return
            
        user = team.members.first()  # Get the team owner/first member
        if not user:
            log.error(f"No user found for team: {team.id}")
            return
        
        log.info(f"Found team {team.id} and user {user.email}")
        
        # Get or create active billing cycle
        active_cycle = BillingCycle.objects.filter(
            subscription=djstripe_subscription,
            status='open'
        ).first()

        if active_cycle:
            log.info(f"Found active billing cycle {active_cycle.id}")
            # If dates have changed, update the cycle
            if active_cycle.end_date != period_end:
                log.info("Dates have changed, creating new cycle")
                # Close current cycle
                active_cycle.close_cycle()
                
                # Create new cycle
                credits_allocated = active_cycle.credits_allocated  # Maintain same allocation
                new_cycle = BillingCycle.get_or_create_active_cycle(
                    user=user,  # Using the team's primary user
                    subscription=djstripe_subscription,
                    period_start=period_start,
                    period_end=period_end,
                    credits_allocated=credits_allocated,
                    subscription_item_id=subscription_item.id
                )
                log.info(f"Created new billing cycle {new_cycle.id}")
        else:
            log.info("No active billing cycle found, creating new one")
            # Create new cycle with default allocation
            # You might want to get this from your subscription plan
            default_credits = 10000  # Example value
            new_cycle = BillingCycle.get_or_create_active_cycle(
                user=user,  # Using the team's primary user
                subscription=djstripe_subscription,
                period_start=period_start,
                period_end=period_end,
                credits_allocated=default_credits,
                subscription_item_id=subscription_item.id
            )
            log.info(f"Created new billing cycle {new_cycle.id}")

    except Exception as e:
        log.error(f"Error handling subscription update: {str(e)}")
        if active_cycle:
            active_cycle.status = 'error'
            active_cycle.save()

@webhooks.handler("customer.subscription.deleted")
def handle_subscription_deleted(event, **kwargs):
    """Handle subscription deletions"""
    log.info(f"Received customer.subscription.deleted webhook: {event.id}")
    subscription = event.data.object
    
    try:
        # Close any open billing cycles for this subscription
        active_cycles = BillingCycle.objects.filter(
            subscription__id=subscription.id,
            status='open'
        )
        log.info(f"Found {active_cycles.count()} active cycles to close")
        for cycle in active_cycles:
            cycle.close_cycle()
            log.info(f"Closed billing cycle {cycle.id}")
        
        # Notify admins
        try:
            customer_email = Customer.objects.get(id=subscription.customer).email
            log.info(f"Notifying admins about cancellation for {customer_email}")
        except Customer.DoesNotExist:
            customer_email = "unavailable"
            log.warning("Customer not found for subscription cancellation notification")

        mail_admins(
            "Someone just canceled their subscription!",
            f"Their email was {customer_email}",
            fail_silently=True,
        )
    
    except Exception as e:
        log.error(f"Error handling subscription deletion: {str(e)}")

@webhooks.handler("customer.subscription.created")
@transaction.atomic
def handle_subscription_created(event, **kwargs):
    """Handle new subscription creation and set up initial billing cycle"""
    log.info(f"Received customer.subscription.created webhook: {event.id}")
    subscription = event.data["object"]
    
    # Try up to 3 times to find the subscription and team
    max_retries = 3
    retry_delay = 2  # seconds
    
    for attempt in range(max_retries):
        try:
            with transaction.atomic():
                djstripe_subscription = Subscription.objects.select_for_update().filter(id=subscription["id"]).first()
                if not djstripe_subscription:
                    if attempt < max_retries - 1:
                        log.info(f"Subscription not found on attempt {attempt + 1}, waiting {retry_delay} seconds...")
                        time.sleep(retry_delay)
                        continue
                    log.error(f"Subscription not found after {max_retries} attempts: {subscription['id']}")
                    return

                # Get subscription details
                period_start = timezone.datetime.fromtimestamp(subscription["current_period_start"])
                period_end = timezone.datetime.fromtimestamp(subscription["current_period_end"])
                subscription_item = subscription["items"]["data"][0]  # Assuming one item per subscription
                
                log.info(f"Processing new subscription {subscription['id']} from {period_start} to {period_end}")
                
                # Try to find team either through subscriber or customer
                team = None
                if djstripe_subscription.customer and djstripe_subscription.customer.subscriber:
                    team = Team.objects.select_for_update().get(id=djstripe_subscription.customer.subscriber.id)
                
                if not team and djstripe_subscription.customer:
                    # Try to find team through customer relationship
                    team = Team.objects.select_for_update().filter(customer=djstripe_subscription.customer).first()
                
                if not team and djstripe_subscription:
                    # Try to find team through subscription relationship
                    team = Team.objects.select_for_update().filter(subscription=djstripe_subscription).first()
                
                if not team:
                    if attempt < max_retries - 1:
                        log.info(f"Team not found on attempt {attempt + 1}, waiting {retry_delay} seconds...")
                        time.sleep(retry_delay)
                        continue
                    log.error(f"No team found for subscription: {subscription['id']}")
                    return
                    
                user = team.members.first()  # Get the team owner/first member
                if not user:
                    log.error(f"No user found for team: {team.id}")
                    return
                
                log.info(f"Creating initial billing cycle for team {team.id} and user {user.email}")
                
                # Create initial billing cycle with default allocation
                default_credits = 10000  # Example value
                new_cycle = BillingCycle.get_or_create_active_cycle(
                    user=user,
                    subscription=djstripe_subscription,
                    period_start=period_start,
                    period_end=period_end,
                    credits_allocated=default_credits,
                    subscription_item_id=subscription_item["id"]
                )
                log.info(f"Created initial billing cycle {new_cycle.id}")
                return  # Success! Exit the retry loop

        except Exception as e:
            log.error(f"Error handling new subscription: {str(e)}")
            if attempt >= max_retries - 1:
                raise  # Re-raise the exception on the last attempt

def has_multiple_items(stripe_event_data):
    return len(stripe_event_data["object"]["items"]["data"]) > 1

def get_price_data(stripe_event_data):
    return stripe_event_data["object"]["items"]["data"][0]["price"]

def get_subscription_id(stripe_event_data):
    return stripe_event_data["object"]["items"]["data"][0]["subscription"]

def get_cancel_at_period_end(stripe_event_data):
    return stripe_event_data["object"]["cancel_at_period_end"]
