from django.conf import settings

PLANS = {
    "free": "Free",
    "pro": "Pro", # Pro was once referred to as "Individual". Might still find references to "Individual" in the codebase.
    "enterprise": "Enterprise",
    "top_up": "TopUp",
}

PRICE_IDS = {
    "pro": settings.PRO_PLAN_PRICE_ID,
    "enterprise": settings.ENTERPRISE_PLAN_PRICE_ID,
    "top_up": settings.TOP_UP_CREDITS_PLAN_ID
}
