from django.contrib import admin
from .models import BillingCycle, UsageEvent, SubscriptionDetail

admin.site.register(BillingCycle)
admin.site.register(UsageEvent)
admin.site.register(SubscriptionDetail)