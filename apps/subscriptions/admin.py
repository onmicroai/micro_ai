from django.contrib import admin
from .models import BillingCycle, UsageEvent, SubscriptionConfiguration
from djstripe.models import Subscription
from django.contrib.admin.sites import site

# First unregister the default admin if it exists
if Subscription in site._registry:
    site.unregister(Subscription)

@admin.register(Subscription)
class CustomSubscriptionAdmin(admin.ModelAdmin):
    list_display = ('id', 'get_username', 'get_plan', 'status', 'start_date', 'ended_at', 'current_period_end')
    list_filter = ('status',)
    search_fields = ('customer__email', 'id', 'plan__product__name')
    ordering = ('-created',)

    def get_username(self, obj):
        if obj.customer:
            return obj.customer.email
        return '-'
    get_username.short_description = 'Email'
    get_username.admin_order_field = 'customer__email'

    def get_plan(self, obj):
        if obj.plan and obj.plan.product:
            return obj.plan.product.name
        return '-'
    get_plan.short_description = 'Plan'
    get_plan.admin_order_field = 'plan__product__name'

@admin.register(SubscriptionConfiguration)
class SubscriptionConfigurationAdmin(admin.ModelAdmin):
    list_display = ('get_email', 'get_plan', 'max_apps', 'get_status', 'get_period_end')
    list_filter = ('subscription__status', 'max_apps')
    search_fields = ('subscription__customer__email', 'subscription__plan__product__name')
    ordering = ('-subscription__created',)
    
    def get_email(self, obj):
        if obj.subscription and obj.subscription.customer:
            return obj.subscription.customer.email
        return '-'
    get_email.short_description = 'Email'
    get_email.admin_order_field = 'subscription__customer__email'
    
    def get_plan(self, obj):
        if obj.subscription and obj.subscription.plan and obj.subscription.plan.product:
            return obj.subscription.plan.product.name
        return '-'
    get_plan.short_description = 'Plan'
    get_plan.admin_order_field = 'subscription__plan__product__name'
    
    def get_status(self, obj):
        return obj.subscription.status if obj.subscription else '-'
    get_status.short_description = 'Status'
    get_status.admin_order_field = 'subscription__status'
    
    def get_period_end(self, obj):
        return obj.subscription.current_period_end if obj.subscription else '-'
    get_period_end.short_description = 'Period End'
    get_period_end.admin_order_field = 'subscription__current_period_end'

@admin.register(BillingCycle)
class BillingCycleAdmin(admin.ModelAdmin):
    list_display = ('get_email', 'status', 'credits_allocated', 'credits_used', 'credits_remaining', 'start_date', 'end_date')
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