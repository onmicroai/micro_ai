from django.contrib import admin
from .models import BillingCycle, UsageEvent

admin.site.register(BillingCycle)
admin.site.register(UsageEvent)
