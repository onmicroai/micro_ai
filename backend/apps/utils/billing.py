import stripe
from django.conf import settings

def get_stripe_module():
    stripe.api_key = settings.STRIPE_SECRET_KEY
    return stripe
