from datetime import datetime, timezone
from django.contrib import admin
from django.conf import settings
from .models import BillingCycle, StripeCustomer, Subscription, TopUpToSubscription, UsageEvent, SubscriptionConfiguration
from django.contrib.admin.sites import site

@admin.register(TopUpToSubscription)
class TopUpToSubscriptionAdmin(admin.ModelAdmin):
    list_display = ('id', 'get_email', 'allocated_credits', 'used_credits', 'remaining_credits', 'created_at', 'updated_at')
    list_filter = ('created_at', 'updated_at')
    search_fields = ('user__email',)
    ordering = ('-created_at',)

    def get_email(self, obj):
        return obj.user.email if obj.user else '-'
    get_email.short_description = 'Email'
    get_email.admin_order_field = 'user__email'

    def remaining_credits(self, obj):
        return obj.remaining_credits
    remaining_credits.short_description = 'Remaining Credits'


@admin.register(StripeCustomer)
class StripeCustomerAdmin(admin.ModelAdmin):
    list_display = ('id', 'get_email', 'customer_id', 'created_at', 'updated_at')
    search_fields = ('user__email', 'customer_id')
    ordering = ('-created_at',)

    def get_email(self, obj):
        return obj.user.email if obj.user else '-'
    get_email.short_description = 'Email'
    get_email.admin_order_field = 'user__email'

@admin.register(Subscription)
class CustomSubscriptionAdmin(admin.ModelAdmin):
    list_display = (
        'id', 'get_email', 'subscription_id', 'price_id', 'get_status_display', 'get_period_start',
        'get_current_period_end', 'canceled_at', 'cancel_at_period_end', 'created_at', 'updated_at'
    )
    list_filter = ('status', 'created_at', 'updated_at')
    search_fields = ('user__email', 'subscription_id', 'price_id')
    ordering = ('-period_start',)

    def get_email(self, obj):
        return obj.user.email if obj.user else '-'
    get_email.short_description = 'Email'
    get_email.admin_order_field = 'user__email'

    def get_status_display(self, obj):
        return obj.get_status_display() if obj.status else '-'
    get_status_display.short_description = 'Status'
    get_status_display.admin_order_field = 'status'

    def format_unix_timestamp(self, timestamp):
        """ Converts Unix timestamp to human-readable date-time (UTC) """
        if timestamp:
            return datetime.fromtimestamp(timestamp, tz=timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')
        return '-'

    def get_period_start(self, obj):
        return self.format_unix_timestamp(obj.period_start)
    get_period_start.short_description = 'Period start'
    get_period_start.admin_order_field = 'period_start'

    def get_current_period_end(self, obj):
        return self.format_unix_timestamp(obj.period_end)
    get_current_period_end.short_description = 'Period End'
    get_current_period_end.admin_order_field = 'period_end'


@admin.register(BillingCycle)
class BillingCycleAdmin(admin.ModelAdmin):
    list_display = (
        'get_email', 'status', 'credits_allocated', 'credits_used', 'credits_remaining', 'start_date', 'end_date'
    )
    list_filter = ('status', 'start_date', 'end_date')
    search_fields = ('user__email',)
    ordering = ('-start_date',)

    def get_email(self, obj):
        return obj.user.email if obj.user else '-'
    get_email.short_description = 'Email'
    get_email.admin_order_field = 'user__email'

@admin.register(UsageEvent)
class UsageEventAdmin(admin.ModelAdmin):
    list_display = ('get_email', 'credits_charged', 'timestamp', 'get_billing_cycle_status', 'get_run_id')
    list_filter = ('billing_cycle__status', 'timestamp')
    search_fields = ('user__email', 'run_id')
    ordering = ('-timestamp',)

    def get_email(self, obj):
        return obj.user.email if obj.user else '-'
    get_email.short_description = 'Email'
    get_email.admin_order_field = 'user__email'

    def get_billing_cycle_status(self, obj):
        return obj.billing_cycle.status if obj.billing_cycle else '-'
    get_billing_cycle_status.short_description = 'Billing Cycle Status'
    get_billing_cycle_status.admin_order_field = 'billing_cycle__status'

    def get_run_id(self, obj):
        return obj.run_id if obj.run_id else '-'
    get_run_id.short_description = 'Run ID'
