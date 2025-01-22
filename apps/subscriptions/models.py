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
from apps.utils.global_varibales import SubscriptionVariables

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
    Status_Choice = [
        ("open", "open"),
        ("closed", "closed")
    ]
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    start_date = models.DateTimeField()
    end_date = models.DateTimeField()
    credits_allocated = models.FloatField()
    credits_used = models.FloatField()
    credits_remaining = models.FloatField()
    status = models.CharField(max_length = 8, choices = Status_Choice, default = SubscriptionVariables.DEFAULT_BILLING_CYCLE_STATUS)

class UsageEvent(models.Model):
    billing_cycle = models.ForeignKey(BillingCycle, on_delete = models.CASCADE)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete = models.CASCADE)
    run_id = models.ForeignKey(Run, on_delete = models.CASCADE)
    credits_charged = models.FloatField()
    timestamp = models.DateTimeField(auto_now_add = True)