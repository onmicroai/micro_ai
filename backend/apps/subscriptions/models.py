from django.db import models
from django.utils import timezone
from django.utils.translation import gettext_lazy as _
from micro_ai import settings

from apps.microapps.models import Run

class TopUpToSubscription(models.Model):
    """
    Model for additional credits purchased by the user within a subscription.
    """
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="top_ups"
    )
    allocated_credits = models.IntegerField(
        default=0,
        help_text="Total additional credits allocated to this subscription"
    )
    used_credits = models.IntegerField(
        default=0,
        help_text="Number of top-up credits used"
    )
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Top Up to Subscription"
        verbose_name_plural = "Top Ups to Subscriptions"

    def __str__(self):
        return f"Top-Up {self.id} - {self.user.email}: {self.allocated_credits} credits"

    @property
    def remaining_credits(self):
        """
        Returns the number of remaining top-up credits.
        """
        return max(0, self.allocated_credits - self.used_credits)

    def record_usage(self, credits: int):
        """
        Deducts the specified amount of credits from the top-up.
        Raises an error if there are not enough credits available.
        """
        if credits > self.remaining_credits:
            raise ValueError("Insufficient top-up credits remaining")

        self.used_credits += credits
        self.save()


class StripeCustomer(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='stripe_customers'
    )
    customer_id = models.CharField(
        max_length=255,
        unique=True,
        help_text="ID of the Stripe customer"
    )
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"StripeCustomer {self.customer_id} for {self.user.email}"

class SubscriptionStatus(models.TextChoices):
    ACTIVE = 'active', 'Active'
    CANCELED = 'canceled', 'Canceled'
    INCOMPLETE = 'incomplete', 'Incomplete'
    INCOMPLETE_EXPIRED = 'incomplete_expired', 'Incomplete Expired'
    PAST_DUE = 'past_due', 'Past Due'
    TRIALING = 'trialing', 'Trialing'
    UNPAID = 'unpaid', 'Unpaid'

class Subscription(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='subscriptions'
    )
    customer = models.ForeignKey(
        StripeCustomer,
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name='subscriptions'
    )
    subscription_id = models.CharField(
        max_length=255,
        unique=True,
        null=True,
        blank=True,
        help_text="ID of the Stripe subscription (only required for Stripe subscriptions)"
    )
    price_id = models.CharField(
        max_length=255,
        null=True,
        blank=True,
        help_text="ID of the price associated with the subscription"
    )
    status = models.CharField(
        max_length=20,
        choices=SubscriptionStatus.choices,
        null=True,
        blank=True
    )
    source = models.CharField(
        max_length=20,
        choices=[('stripe', 'Stripe'), ('internal', 'Internal')],
        default='internal'
    )
    period_start = models.BigIntegerField(
        null=True,
        blank=True,
        help_text="Unix timestamp for the start of the period"
    )
    period_end = models.BigIntegerField(
        null=True,
        blank=True,
        help_text="Unix timestamp for the end of the period"
    )
    cancel_at_period_end = models.BooleanField(default=False)
    canceled_at = models.BigIntegerField(
        null=True,
        blank=True,
        help_text="Unix timestamp when the subscription was canceled"
    )
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Subscription {self.subscription_id} ({self.status})"

class SubscriptionModelBase(models.Model):
    subscription = models.ForeignKey(
        Subscription,
        null=True,
        blank=True,
        on_delete=models.SET_NULL
    )
    customer = models.ForeignKey(
        StripeCustomer,
        null=True,
        blank=True,
        on_delete=models.SET_NULL
    )
    billing_details_last_changed = models.DateTimeField(
        default=timezone.now,
        help_text=_("Updated every time an event that might trigger billing happens.")
    )
    last_synced_with_stripe = models.DateTimeField(
        null=True,
        blank=True,
        help_text=_("Used for determining when to next sync with Stripe.")
    )

    class Meta:
        abstract = True

    def get_quantity(self) -> int:
        return 1

class SubscriptionConfiguration(models.Model):
    subscription = models.OneToOneField(
        Subscription,
        on_delete=models.CASCADE,
        related_name='configuration'
    )
    max_apps = models.IntegerField(
        help_text="Maximum number of apps allowed for this subscription"
    )

    def __str__(self):
        return f"Configuration for {self.subscription.subscription_id}"

    @classmethod
    def get_max_apps(cls, subscription):
        try:
            config = cls.objects.get(subscription=subscription)
            return config.max_apps
        except cls.DoesNotExist:
            return 0

class BillingCycle(models.Model):
    CYCLE_STATUS = (
        ('open', 'Open'),
        ('closed', 'Closed'),
        ('error', 'Error'),
    )

    user = models.ForeignKey('users.CustomUser', on_delete=models.CASCADE)
    subscription = models.ForeignKey(
        Subscription,
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )
    status = models.CharField(max_length=10, choices=CYCLE_STATUS, default='open')

    credits_allocated = models.IntegerField(default=0)
    credits_used = models.IntegerField(default=0)
    credits_remaining = models.IntegerField(default=0)

    start_date = models.DateTimeField()
    end_date = models.DateTimeField()

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
        if self.status != 'open':
            raise ValueError("Cannot record usage on a closed or error billing cycle")

        if credits > self.credits_remaining:
            raise ValueError("Insufficient credits remaining")

        self.credits_used += credits
        self.credits_remaining -= credits
        self.save()

    def close_cycle(self):
        if self.status == 'open':
            self.status = 'closed'
            self.save()

    @classmethod
    def create_next_cycle(cls, previous_cycle, new_period_end):
        return cls.objects.create(
            user=previous_cycle.user,
            subscription=previous_cycle.subscription,
            credits_allocated=previous_cycle.credits_allocated,
            credits_remaining=previous_cycle.credits_allocated,
            credits_used=0,
            start_date=previous_cycle.end_date,
            end_date=new_period_end,
            stripe_subscription_item_id=previous_cycle.stripe_subscription_item_id,
            previous_cycle=previous_cycle
        )

    @classmethod
    def get_or_create_active_cycle(cls, user, subscription, period_start, period_end, credits_allocated, subscription_item_id):
        active_cycle = cls.objects.filter(
            user=user,
            status='open',
            start_date__lte=timezone.now(),
            end_date__gte=timezone.now()
        ).first()

        if active_cycle:
            return active_cycle

        return cls.objects.create(
            user=user,
            subscription=subscription,
            credits_allocated=credits_allocated,
            credits_remaining=credits_allocated,
            start_date=period_start,
            end_date=period_end,
            stripe_subscription_item_id=subscription_item_id
        )

class UsageEvent(models.Model):
    billing_cycle = models.ForeignKey(BillingCycle, on_delete=models.CASCADE)
    top_up = models.ForeignKey(TopUpToSubscription, on_delete=models.CASCADE, null=True, blank=True)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    consumer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='consumed_usage_events'
    )
    run_id = models.ForeignKey(Run, on_delete=models.CASCADE)
    credits_charged = models.FloatField()
    timestamp = models.DateTimeField(auto_now_add=True)
