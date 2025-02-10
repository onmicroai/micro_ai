from typing import Optional

from django.db import models
from django.db.models import F, Q
from django.utils import timezone
from django.utils.functional import cached_property
from django.utils.translation import gettext_lazy as _
from djstripe.enums import SubscriptionStatus
from djstripe.models import Customer, Subscription
from micro_ai import settings

from apps.subscriptions.wrappers import SubscriptionWrapper
from apps.microapps.models import Run

class SubscriptionModelBase(models.Model):
    """
    Helper class to be used with Stripe Subscriptions.

    Assumes that the associated subclass is a django model containing a
    subscription field that is a ForeignKey to a djstripe.Subscription object.
    """

    # subclass should override with appropriate foreign keys as needed
    subscription = models.ForeignKey(
        "djstripe.Subscription",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        help_text=_("The associated Stripe Subscription object, if it exists"),
    )
    customer = models.ForeignKey(Customer, null=True, blank=True, on_delete=models.SET_NULL)
    billing_details_last_changed = models.DateTimeField(
        default=timezone.now, help_text=_("Updated every time an event that might trigger billing happens.")
    )
    last_synced_with_stripe = models.DateTimeField(
        null=True, blank=True, help_text=_("Used for determining when to next sync with Stripe.")
    )

    class Meta:
        abstract = True

    @cached_property
    def active_stripe_subscription(self) -> Optional[Subscription]:
        from apps.subscriptions.helpers import subscription_is_active

        if self.subscription and subscription_is_active(self.subscription):
            return self.subscription
        return None

    @cached_property
    def wrapped_subscription(self) -> Optional[SubscriptionWrapper]:
        """
        Returns the current subscription as a SubscriptionWrapper
        """
        if self.subscription:
            return SubscriptionWrapper(self.subscription)
        return None

    def clear_cached_subscription(self):
        """
        Clear the cached subscription object (in case it has changed since the model was created)
        """
        try:
            del self.active_stripe_subscription
        except AttributeError:
            pass
        try:
            del self.wrapped_subscription
        except AttributeError:
            pass

    def has_active_subscription(self) -> bool:
        return self.active_stripe_subscription is not None

    @classmethod
    def get_items_needing_sync(cls):
        return cls.objects.filter(
            Q(last_synced_with_stripe__isnull=True) | Q(last_synced_with_stripe__lt=F("billing_details_last_changed")),
            subscription__status=SubscriptionStatus.active,
        )

    def get_quantity(self) -> int:
        # if you use "per-seat" billing, override this accordingly
        return 1
    
class SubscriptionConfiguration(models.Model):
    """
    Extends djstripe's Subscription model with additional configuration fields.
    """
    subscription = models.OneToOneField(
        Subscription,
        on_delete=models.CASCADE,
        related_name='configuration'
    )
    max_apps = models.IntegerField(
        help_text="Maximum number of apps allowed for this subscription"
    )

    def __str__(self):
        return f"Configuration for {self.subscription.id}"

    @classmethod
    def get_max_apps(cls, subscription):
        """
        Helper method to get max_apps for a subscription, with fallback to default.
        """
        try:
            return subscription.configuration.max_apps
        except (AttributeError, cls.DoesNotExist):
            return 0  # or whatever your default should be

class BillingCycle(models.Model):
    CYCLE_STATUS = (
        ('open', 'Open'),
        ('closed', 'Closed'),
        ('error', 'Error'),
    )

    user = models.ForeignKey('users.CustomUser', on_delete=models.CASCADE)
    team = models.ForeignKey('teams.Team', on_delete=models.CASCADE, null=True)
    subscription = models.ForeignKey(Subscription, on_delete=models.SET_NULL, null=True)
    status = models.CharField(max_length=10, choices=CYCLE_STATUS, default='open')
    
    # Credit tracking
    credits_allocated = models.IntegerField(default=0)
    credits_used = models.IntegerField(default=0)
    credits_remaining = models.IntegerField(default=0)
    
    # Period tracking
    start_date = models.DateTimeField()
    end_date = models.DateTimeField()
    
    # New fields
    stripe_subscription_item_id = models.CharField(max_length=255, null=True, blank=True)
    last_usage_record_timestamp = models.DateTimeField(null=True, blank=True)
    is_prorated = models.BooleanField(default=False)
    previous_cycle = models.ForeignKey('self', null=True, blank=True, on_delete=models.SET_NULL)
    
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-start_date']

    def __str__(self):
        return f"{self.user.email} - {self.start_date.strftime('%Y-%m-%d')} to {self.end_date.strftime('%Y-%m-%d')}"

    @property
    def is_active(self):
        now = timezone.now()
        return (
            self.status == 'open' and 
            self.start_date <= now <= self.end_date
        )

    @property
    def usage_percentage(self):
        if self.credits_allocated == 0:
            return 0
        return (self.credits_used / self.credits_allocated) * 100

    def record_usage(self, credits):
        """Record credit usage and update remaining credits"""
        if self.status != 'open':
            raise ValueError("Cannot record usage on a closed or error billing cycle")
        
        if credits > self.credits_remaining:
            raise ValueError("Insufficient credits remaining")
        
        self.credits_used += credits
        self.credits_remaining -= credits
        self.save()

    def close_cycle(self):
        """Close the current billing cycle"""
        if self.status == 'open':
            self.status = 'closed'
            self.save()

    @classmethod
    def create_next_cycle(cls, previous_cycle, new_period_end):
        """Create a new billing cycle based on the previous one"""
        return cls.objects.create(
            user=previous_cycle.user,
            subscription=previous_cycle.subscription,
            credits_allocated=previous_cycle.credits_allocated,  # Maintain same allocation
            credits_remaining=previous_cycle.credits_allocated,  # Reset remaining to full
            credits_used=0,  # Start fresh
            start_date=previous_cycle.end_date,
            end_date=new_period_end,
            stripe_subscription_item_id=previous_cycle.stripe_subscription_item_id,
            previous_cycle=previous_cycle
        )

    @classmethod
    def get_or_create_active_cycle(cls, user, subscription, period_start, period_end, credits_allocated, subscription_item_id):
        """Get the active billing cycle or create a new one"""
        # Get the team from the subscription
        team = subscription.customer.subscriber if subscription and subscription.customer else None
        
        active_cycle = cls.objects.filter(
            user=user,
            team=team,
            status='open',
            start_date__lte=timezone.now(),
            end_date__gte=timezone.now()
        ).first()

        if active_cycle:
            return active_cycle

        return cls.objects.create(
            user=user,
            team=team,
            subscription=subscription,
            credits_allocated=credits_allocated,
            credits_remaining=credits_allocated,
            start_date=period_start,
            end_date=period_end,
            stripe_subscription_item_id=subscription_item_id
        )

class UsageEvent(models.Model):
    billing_cycle = models.ForeignKey(BillingCycle, on_delete = models.CASCADE)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete = models.CASCADE)
    run_id = models.ForeignKey(Run, on_delete = models.CASCADE)
    credits_charged = models.FloatField()
    timestamp = models.DateTimeField(auto_now_add = True)