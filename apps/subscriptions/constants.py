from django.conf import settings

PLANS = {
    "free": "Free",
    "individual": "Pro", # The frontend always refers to the "Individual" plan as "Pro"
    "enterprise": "Enterprise",
}

PRICE_IDS = {
    "individual": settings.INDIVIDUAL_PLAN_PRICE_ID,
    "enterprise": settings.ENTERPRISE_PLAN_PRICE_ID,
    "top_up": settings.TOP_UP_CREDITS_PLAN_ID
}
