from django.contrib import admin
from django.conf import settings
from .models import BillingCycle, Subscription, UsageEvent, SubscriptionConfiguration
from django.contrib.admin.sites import site

@admin.register(Subscription)
class CustomSubscriptionAdmin(admin.ModelAdmin):
    list_display = (
        'id', 'get_username', 'get_plan', 'status', 'get_start_date', 'get_ended_at', 'get_current_period_end'
    )
    list_filter = ('status',)
    search_fields = ('customer__email', 'subscription_id', 'price_id')
    ordering = ('-period_start',)

    def get_username(self, obj):
        if obj.customer:
            return obj.customer.email
        return '-'
    get_username.short_description = 'Email'
    get_username.admin_order_field = 'customer__email'

    def get_plan(self, obj):
        return obj.price_id if obj.price_id else '-'
    get_plan.short_description = 'Plan'
    get_plan.admin_order_field = 'price_id'

    def get_start_date(self, obj):
        return obj.period_start if obj.period_start else '-'
    get_start_date.short_description = 'Start Date'
    get_start_date.admin_order_field = 'period_start'

    def get_ended_at(self, obj):
        return obj.canceled_at if obj.canceled_at else '-'
    get_ended_at.short_description = 'Ended At'
    get_ended_at.admin_order_field = 'canceled_at'

    def get_current_period_end(self, obj):
        return obj.period_end if obj.period_end else '-'
    get_current_period_end.short_description = 'Period End'
    get_current_period_end.admin_order_field = 'period_end'

@admin.register(SubscriptionConfiguration)
class SubscriptionConfigurationAdmin(admin.ModelAdmin):
    list_display = ('get_email', 'get_plan', 'max_apps', 'get_status', 'get_period_end')
    list_filter = ('subscription__status', 'max_apps')
    search_fields = ('subscription__customer__email', 'subscription__subscription_id', 'subscription__price_id')
    ordering = ('-subscription__period_start',)

    def get_email(self, obj):
        if obj.subscription and obj.subscription.customer:
            return obj.subscription.customer.email
        return '-'
    get_email.short_description = 'Email'
    get_email.admin_order_field = 'subscription__customer__email'

    def get_plan(self, obj):
        if obj.subscription and obj.subscription.price_id:
            return obj.subscription.price_id
        return '-'
    get_plan.short_description = 'Plan'
    get_plan.admin_order_field = 'subscription__price_id'

    def get_status(self, obj):
        return obj.subscription.status if obj.subscription else '-'
    get_status.short_description = 'Status'
    get_status.admin_order_field = 'subscription__status'

    def get_period_end(self, obj):
        return obj.subscription.period_end if obj.subscription and obj.subscription.period_end else '-'
    get_period_end.short_description = 'Period End'
    get_period_end.admin_order_field = 'subscription__period_end'

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
