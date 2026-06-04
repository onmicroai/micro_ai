from datetime import timedelta

from django.conf import settings
from django.test import TestCase
from django.utils import timezone

from apps.subscriptions.constants import tier_for_price
from apps.subscriptions.credits import get_or_create_wallet
from apps.subscriptions.models import CreditWallet, StripeCustomer, Subscription
from apps.subscriptions.webhooks import (
    handle_invoice_paid,
    handle_subscription_created_or_updated,
    handle_subscription_deleted,
)
from apps.users.models import CustomUser

PRO_PRICE_ID = settings.PRO_PLAN_PRICE_ID
PRO_CREDITS = tier_for_price(PRO_PRICE_ID).monthly_credits
FREE_CREDITS = tier_for_price(None).monthly_credits


class WebhookWalletSyncTest(TestCase):
    def setUp(self):
        self.user = CustomUser.objects.create_user(
            username="webhook@example.com", email="webhook@example.com", password="x"
        )
        self.customer = StripeCustomer.objects.create(
            user=self.user, customer_id="cus_test123"
        )

    def _make_subscription(self, price_id, status="active", subscription_id="sub_test"):
        return Subscription.objects.create(
            user=self.user,
            customer=self.customer,
            subscription_id=subscription_id,
            price_id=price_id,
            status=status,
            source="stripe",
        )

    def _ts(self, days=0):
        return int((timezone.now() + timedelta(days=days)).timestamp())

    def test_invoice_paid_subscription_cycle_resets_subscription_credits(self):
        self._make_subscription(PRO_PRICE_ID)
        wallet = get_or_create_wallet(self.user)
        wallet.subscription_credits = 5
        wallet.topup_credits = 250
        wallet.save()

        event = {
            "data": {
                "object": {
                    "billing_reason": "subscription_cycle",
                    "customer": "cus_test123",
                    "lines": {"data": [{"period": {"end": self._ts(days=30)}}]},
                }
            }
        }
        handle_invoice_paid(event)

        wallet.refresh_from_db()
        # Subscription credits reset to the tier allotment; top-ups are preserved.
        self.assertEqual(wallet.subscription_credits, PRO_CREDITS)
        self.assertEqual(wallet.topup_credits, 250)

    def test_invoice_paid_non_cycle_does_not_reset(self):
        self._make_subscription(PRO_PRICE_ID)
        wallet = get_or_create_wallet(self.user)
        wallet.subscription_credits = 5
        wallet.save()

        event = {
            "data": {
                "object": {
                    "billing_reason": "subscription_create",
                    "customer": "cus_test123",
                    "lines": {"data": []},
                }
            }
        }
        handle_invoice_paid(event)

        wallet.refresh_from_db()
        self.assertEqual(wallet.subscription_credits, 5)

    def test_subscription_updated_syncs_wallet_to_new_tier(self):
        # Start on Free, then receive an update moving the customer to Pro.
        self._make_subscription(price_id=None, status="active")
        wallet = get_or_create_wallet(self.user)
        wallet.subscription_credits = 0
        wallet.save()

        event = {
            "data": {
                "object": {
                    "id": "sub_test",
                    "customer": "cus_test123",
                    "status": "active",
                    "cancel_at_period_end": False,
                    "current_period_start": self._ts(),
                    "current_period_end": self._ts(days=30),
                    "canceled_at": None,
                    "items": {"data": [{"id": "si_1", "price": {"id": PRO_PRICE_ID}}]},
                }
            }
        }
        handle_subscription_created_or_updated(event)

        wallet.refresh_from_db()
        self.assertEqual(wallet.subscription_credits, PRO_CREDITS)
        self.assertEqual(Subscription.objects.get(subscription_id="sub_test").price_id, PRO_PRICE_ID)

    def test_subscription_deleted_reverts_wallet_to_free(self):
        self._make_subscription(PRO_PRICE_ID)
        wallet = get_or_create_wallet(self.user)
        wallet.subscription_credits = PRO_CREDITS
        wallet.save()

        event = {
            "data": {
                "object": {
                    "id": "sub_test",
                    "customer": "cus_test123",
                    "status": "canceled",
                    "canceled_at": self._ts(),
                    "items": {"data": [{"id": "si_1", "price": {"id": PRO_PRICE_ID}}]},
                }
            }
        }
        handle_subscription_deleted(event)

        wallet.refresh_from_db()
        self.assertEqual(wallet.subscription_credits, FREE_CREDITS)
