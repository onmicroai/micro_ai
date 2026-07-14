from django.db import models
from django.utils import timezone
from django.utils.translation import gettext_lazy as _
from micro_ai import settings

from apps.microapps.models import Run


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


class UserEntitlement(models.Model):
    """
    User-scoped perks that are independent of Stripe subscription state.
    Used for coupon-granted max_apps overrides on free-tier users.
    """
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="entitlement",
    )
    max_apps = models.IntegerField(
        null=True,
        blank=True,
        help_text="Override for the user's max app limit (from coupons or manual grants)",
    )
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Entitlements for {self.user.email}"

class Coupon(models.Model):
    ACTION_CHOICES = [
        ('increase_max_apps', 'Increase Max Apps'),
        ('increase_max_apps_and_credits', 'Increase Max Apps and Credits'),
        # Future actions can be added here:
        # ('add_credits', 'Add Credits'),
        # ('upgrade_plan', 'Upgrade Plan'),
        # ('unlock_feature', 'Unlock Feature'),
    ]
    
    code = models.CharField(max_length=50, unique=True)
    action = models.CharField(max_length=50, choices=ACTION_CHOICES)
    additional_data = models.JSONField(default=dict, help_text="JSON data for the action (e.g., {'max_apps': 10, 'credits': 100000})")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Coupon {self.code} ({self.action})"

    def can_be_used_by(self, user):
        """Check if this coupon can be used by the given user"""
        return (
            self.is_active and 
            not CouponUsage.objects.filter(coupon=self, user=user).exists()
        )

    def get_action_value(self, key):
        """Helper method to get a specific value from additional_data"""
        return self.additional_data.get(key)

class CouponUsage(models.Model):
    coupon = models.ForeignKey(Coupon, on_delete=models.CASCADE, related_name='usages')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    used_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('coupon', 'user')

    def __str__(self):
        return f"{self.user.email} used {self.coupon.code} at {self.used_at}"


class CreditWallet(models.Model):
    """
    Single source of truth for a user's spendable credits.

    `subscription_credits` are granted by the user's tier and reset to the tier
    allotment each billing period. `topup_credits` are purchased one-off and roll
    over indefinitely (never reset). Spending draws from subscription credits first.
    """
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="wallet",
    )
    subscription_credits = models.IntegerField(
        default=0,
        help_text="Tier credits for the current period. Reset to the tier allotment each period.",
    )
    topup_credits = models.IntegerField(
        default=0,
        help_text="Purchased one-off credits. Never reset; roll over across periods.",
    )
    reset_at = models.DateTimeField(
        help_text="When subscription_credits should next be refilled to the tier allotment.",
    )
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Wallet {self.user.email}: {self.total_available} credits"

    @property
    def total_available(self) -> int:
        return self.subscription_credits + self.topup_credits


class CreditTransaction(models.Model):
    """
    Append-only audit log of credit movements. Positive amounts are grants,
    negative amounts are spends.
    """
    REASON_CHOICES = [
        ("monthly_grant", "Monthly grant"),
        ("usage", "Usage"),
        ("topup", "Top-up"),
        ("coupon", "Coupon"),
        ("adjustment", "Manual adjustment"),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="credit_transactions",
    )
    amount = models.IntegerField(help_text="Positive for grants, negative for spends.")
    reason = models.CharField(max_length=32, choices=REASON_CHOICES)
    run = models.ForeignKey(
        Run,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    consumer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="consumed_credit_transactions",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        sign = "+" if self.amount >= 0 else ""
        return f"{self.user.email}: {sign}{self.amount} ({self.reason})"
