from django.test import TestCase

from apps.subscriptions.constants import tier_for_price
from apps.subscriptions.credits import get_or_create_wallet
from apps.subscriptions.helpers import resolve_max_apps_for_user, set_user_max_apps
from apps.subscriptions.models import (
    Coupon,
    StripeCustomer,
    Subscription,
    SubscriptionConfiguration,
    UserEntitlement,
)
from apps.subscriptions.services import CouponActionService
from apps.users.models import CustomUser
from apps.utils.usage_helper import MicroAppUsage


class UserEntitlementTest(TestCase):
    def setUp(self):
        self.user = CustomUser.objects.create_user(
            username="free@example.com", email="free@example.com", password="x"
        )

    def test_resolve_max_apps_defaults_to_free_tier(self):
        free_limit = tier_for_price(None).max_apps
        self.assertEqual(resolve_max_apps_for_user(self.user.id), free_limit)

    def test_user_entitlement_overrides_free_tier_default(self):
        set_user_max_apps(self.user, 25)
        self.assertEqual(resolve_max_apps_for_user(self.user.id), 25)

    def test_user_entitlement_takes_precedence_over_subscription_config(self):
        customer = StripeCustomer.objects.create(
            user=self.user, customer_id="cus_entitlement"
        )
        subscription = Subscription.objects.create(
            user=self.user,
            customer=customer,
            subscription_id="sub_entitlement",
            price_id="price_pro",
            status="active",
            source="stripe",
        )
        SubscriptionConfiguration.objects.create(
            subscription=subscription, max_apps=5
        )
        set_user_max_apps(self.user, 20)

        self.assertEqual(resolve_max_apps_for_user(self.user.id), 20)

    def test_check_max_apps_uses_user_entitlement_for_free_user(self):
        set_user_max_apps(self.user, 15)
        result = MicroAppUsage.check_max_apps(self.user.id)
        self.assertEqual(result["limit"], 15)

    def test_free_user_can_redeem_max_apps_coupon(self):
        coupon = Coupon.objects.create(
            code="MOREAPPS",
            action="increase_max_apps",
            additional_data={"max_apps": 12},
        )
        result = CouponActionService.execute_action(coupon, self.user)

        self.assertTrue(result["success"])
        entitlement = UserEntitlement.objects.get(user=self.user)
        self.assertEqual(entitlement.max_apps, 12)

    def test_free_user_can_redeem_max_apps_and_credits_coupon(self):
        coupon = Coupon.objects.create(
            code="APPSANDCREDITS",
            action="increase_max_apps_and_credits",
            additional_data={"max_apps": 8, "credits": 5000},
        )
        result = CouponActionService.execute_action(coupon, self.user)

        self.assertTrue(result["success"])
        entitlement = UserEntitlement.objects.get(user=self.user)
        self.assertEqual(entitlement.max_apps, 8)

        wallet = get_or_create_wallet(self.user)
        wallet.refresh_from_db()
        self.assertEqual(wallet.topup_credits, 5000)
