import stripe
from django.conf import settings

def get_stripe_module():
    if settings.STRIPE_LIVE_MODE:
        stripe.api_key = settings.STRIPE_LIVE_SECRET_KEY
    else:
        stripe.api_key = settings.STRIPE_TEST_SECRET_KEY
    return stripe
