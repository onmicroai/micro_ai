import stripe
from django.conf import settings

def get_stripe_module():
    stripe_secret_key = getattr(settings, "STRIPE_TEST_SECRET_KEY", None)
    stripe.api_key = stripe_secret_key
    return stripe
