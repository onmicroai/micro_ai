from datetime import datetime, timezone
from django.contrib import admin
from .models import (
    CreditTransaction,
    CreditWallet,
    StripeCustomer,
    Subscription,
    SubscriptionConfiguration,
    Coupon,
    CouponUsage,
)

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
        'id', 'get_email', 'subscription_id', 'price_id', 'source', 'get_status_display', 'get_period_start',
        'get_current_period_end', 'canceled_at', 'cancel_at_period_end', 'created_at', 'updated_at'
    )
    list_filter = ('source', 'status', 'created_at', 'updated_at')
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


@admin.register(CreditWallet)
class CreditWalletAdmin(admin.ModelAdmin):
    list_display = (
        'get_email', 'subscription_credits', 'topup_credits', 'total_available', 'reset_at', 'updated_at'
    )
    list_filter = ('updated_at',)
    search_fields = ('user__email',)
    ordering = ('-updated_at',)
    readonly_fields = ('updated_at',)

    def get_email(self, obj):
        return obj.user.email if obj.user else '-'
    get_email.short_description = 'Email'
    get_email.admin_order_field = 'user__email'

    def total_available(self, obj):
        return obj.total_available
    total_available.short_description = 'Total available'


@admin.register(CreditTransaction)
class CreditTransactionAdmin(admin.ModelAdmin):
    list_display = ('get_email', 'amount', 'reason', 'run', 'consumer', 'created_at')
    list_filter = ('reason', 'created_at')
    search_fields = ('user__email',)
    ordering = ('-created_at',)
    readonly_fields = ('created_at',)

    def get_email(self, obj):
        return obj.user.email if obj.user else '-'
    get_email.short_description = 'Email'
    get_email.admin_order_field = 'user__email'


@admin.register(SubscriptionConfiguration)
class SubscriptionConfigurationAdmin(admin.ModelAdmin):
    list_display = ('id', 'max_apps', 'get_subscription_id')
    search_fields = ('subscription__subscription_id',)
    
    def get_subscription_id(self, obj):
        return obj.subscription.subscription_id if obj.subscription else '-'
    get_subscription_id.short_description = 'Subscription ID'
    get_subscription_id.admin_order_field = 'subscription__subscription_id'

@admin.register(Coupon)
class CouponAdmin(admin.ModelAdmin):
    list_display = ('code', 'action', 'is_active', 'created_at', 'usage_count')
    list_filter = ('action', 'is_active', 'created_at')
    search_fields = ('code',)
    ordering = ('-created_at',)
    readonly_fields = ('created_at', 'updated_at')
    
    fieldsets = (
        (None, {
            'fields': ('code', 'action', 'is_active')
        }),
        ('Action Data', {
            'fields': ('additional_data',),
            'description': 'Enter JSON data for the action. For increase_max_apps, use: {"max_apps": 10}. For increase_max_apps_and_credits, use: {"max_apps": 10, "credits": 100000}'
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )

    def usage_count(self, obj):
        return obj.usages.count()
    usage_count.short_description = 'Times Used'

@admin.register(CouponUsage)
class CouponUsageAdmin(admin.ModelAdmin):
    list_display = ('coupon', 'user', 'used_at')
    list_filter = ('used_at', 'coupon__action')
    search_fields = ('coupon__code', 'user__email')
    ordering = ('-used_at',)
    readonly_fields = ('used_at',)
