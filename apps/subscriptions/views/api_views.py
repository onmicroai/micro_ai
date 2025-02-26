import logging
from apps.subscriptions.constants import PLANS
import rest_framework.serializers
from django.utils.decorators import method_decorator
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework.response import Response
from rest_framework.views import APIView
from django.conf import settings
from apps.subscriptions.models import StripeCustomer
from rest_framework.permissions import AllowAny

from apps.api.permissions import IsAuthenticatedOrHasUserAPIKey
from apps.teams.decorators import team_admin_required

from ..exceptions import SubscriptionConfigError
from ..helpers import (
    cancel_subscription,
    create_customer_portal_session,
    create_stripe_checkout_session,
    get_plan_name,
    get_price_id_from_plan,
    is_downgrade,
)
from apps.utils.billing import get_stripe_module

log = logging.getLogger("micro_ai.subscription")

# Serializer for products and their default price
class ProductWithPriceSerializer(rest_framework.serializers.Serializer):
    id = rest_framework.serializers.CharField()
    name = rest_framework.serializers.CharField()
    description = rest_framework.serializers.CharField(allow_blank=True, required=False)
    price = rest_framework.serializers.IntegerField()
    currency = rest_framework.serializers.CharField()
    interval = rest_framework.serializers.CharField()
    features = rest_framework.serializers.ListField(child=rest_framework.serializers.CharField())

    def to_representation(self, obj):
        # obj is a dict returned from stripe.Product.list() with a "default_price" attached.
        return {
            "id": obj.get("id"),
            "name": obj.get("name"),
            "description": obj.get("description", ""),
            "price": int(obj.get("default_price", {}).get("unit_amount", 0)),
            "currency": obj.get("default_price", {}).get("currency", "usd").upper(),
            "interval": obj.get("default_price", {}).get("recurring", {}).get("interval", "month"),
            "features": self.get_features(obj),
        }

    def get_features(self, obj):
        # Determine features based on the product name
        plan_name = obj.get("name", "")
        if plan_name == settings.FREE_PLAN_NAME:
            return settings.FREE_PLAN_FEATURES
        elif plan_name == settings.INDIVIDUAL_PLAN_NAME:
            return settings.INDIVIDUAL_PLAN_FEATURES
        elif plan_name == settings.ENTERPRISE_PLAN_NAME:
            return settings.ENTERPRISE_PLAN_FEATURES
        return []

@extend_schema(tags=["subscriptions"])
class ProductsListAPI(APIView):
    permission_classes = (IsAuthenticatedOrHasUserAPIKey,)
    serializer_class = ProductWithPriceSerializer

    @extend_schema(responses={200: ProductWithPriceSerializer(many=True)})
    def get(self, request):
        if not request.user.is_authenticated:
            return Response({"detail": "Authentication credentials were not provided."}, status=401)
        stripe = get_stripe_module()
        try:
            products_response = stripe.Product.list(active=True)
            products = []
            for product in products_response["data"]:
                prices_response = stripe.Price.list(product=product["id"], active=True)
                if prices_response["data"]:
                    product["default_price"] = prices_response["data"][0]
                    products.append(product)
            serializer = self.serializer_class(products, many=True)
            return Response(serializer.data)
        except Exception as e:
            return Response({"detail": str(e)}, status=400)

@extend_schema(tags=["subscriptions"], exclude=True)
class CreateCheckoutSession(APIView):
    permission_classes = (IsAuthenticatedOrHasUserAPIKey,)

    @extend_schema(
        operation_id="create_checkout_session",
        request=inline_serializer("CreateCheckout", {"tierName": rest_framework.serializers.CharField()}),
        responses={200: OpenApiTypes.URI},
    )
    def post(self, request):
        user = request.user
        plan = request.data.get("tierName")

        stripe_customer = StripeCustomer.objects.filter(user=user).first()
        customer_id = stripe_customer.customer_id if stripe_customer else None
        customer_email = user.email if not customer_id else None

        try:
            checkout_session = create_stripe_checkout_session(
                plan=plan,
                customer_id=customer_id, 
                customer_email=customer_email
            )
            return Response({"url": checkout_session.url})
        except Exception as e:
            return Response({"detail": f"Internal server error: {str(e)}"}, status=500)

@extend_schema(tags=["subscriptions"], exclude=True)
class CreatePortalSession(APIView):
    permission_classes = (IsAuthenticatedOrHasUserAPIKey,)

    @extend_schema(
        operation_id="create_portal_session",
        request=None,
        responses={200: OpenApiTypes.URI},
    )
    @method_decorator(team_admin_required)
    def post(self, request):
        user = request.user
        stripe_customer = StripeCustomer.objects.filter(user=user).first()
        if not stripe_customer:
            return Response("Stripe customer not found", status=404)
        try:
            customer_portal_flow_type = request.data.get("customerPortalFlowType")
            plan = request.data.get("plan")
            success_url = request.data.get("successUrl")
            session_url = create_customer_portal_session(
                user,
                customer_portal_flow_type=customer_portal_flow_type,
                plan=plan,
                success_url=success_url,
            )
            return Response({"url": session_url})
        except Exception as e:
            return Response(str(e), status=500)

class ReportUsageSerializer(rest_framework.serializers.Serializer):
    quantity = rest_framework.serializers.IntegerField(min_value=1)
    timestamp = rest_framework.serializers.IntegerField(required=False)  # Unix timestamp
    action = rest_framework.serializers.CharField(required=False)  # Optional metadata

@extend_schema(tags=["subscriptions"])
class ReportUsageAPI(APIView):
    permission_classes = (IsAuthenticatedOrHasUserAPIKey,)
    serializer_class = ReportUsageSerializer

    @extend_schema(
        operation_id="report_usage",
        request=ReportUsageSerializer,
        responses={200: None},
    )
    def post(self, request):
        if not request.user.is_authenticated:
            return Response({"detail": "Authentication required"}, status=401)
        if not request.team or not request.team.subscription:
            return Response({"detail": "No active subscription found"}, status=404)

        serializer = self.serializer_class(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        stripe = get_stripe_module()
        try:
            # Retrieve the subscription from Stripe and expand its items
            stripe_subscription = stripe.Subscription.retrieve(
                request.team.subscription.subscription_id,
                expand=["items.data.price.recurring"]
            )
            metered_item = None
            for item in stripe_subscription["items"]["data"]:
                recurring = item["price"].get("recurring", {})
                if recurring.get("usage_type") == "metered":
                    metered_item = item
                    break
            if not metered_item:
                return Response({"detail": "No metered subscription item found"}, status=404)

            usage_record = stripe.SubscriptionItem.create_usage_record(
                metered_item["id"],
                quantity=serializer.validated_data["quantity"],
                timestamp=serializer.validated_data.get("timestamp"),
                action=serializer.validated_data.get("action", "increment")
            )
            return Response({
                "usage_record": usage_record["id"],
                "quantity": usage_record["quantity"],
                "subscription_item": metered_item["id"]
            })
        except Exception as e:
            return Response({"detail": str(e)}, status=400)

@extend_schema(tags=["subscriptions"])
class ListUsageRecordsAPI(APIView):
    permission_classes = (IsAuthenticatedOrHasUserAPIKey,)

    def get(self, request):
        if not request.user.is_authenticated:
            return Response({"detail": "Authentication required"}, status=401)
        if not request.team or not request.team.subscription:
            return Response({"detail": "No active subscription found"}, status=404)
        try:
            stripe = get_stripe_module()
            stripe_subscription = stripe.Subscription.retrieve(
                request.team.subscription.subscription_id,
                expand=["items.data.price.recurring"]
            )
            metered_item = None
            for item in stripe_subscription["items"]["data"]:
                recurring = item["price"].get("recurring", {})
                if recurring.get("usage_type") == "metered":
                    metered_item = item
                    break
            if not metered_item:
                return Response({"detail": "No metered subscription item found"}, status=404)
            usage_records = stripe.SubscriptionItem.list_usage_record_summaries(
                metered_item["id"],
                limit=100
            )
            return Response({
                "subscription_item": metered_item["id"],
                "usage_records": usage_records["data"]
            })
        except Exception as e:
            return Response({"detail": str(e)}, status=400)

@extend_schema(tags=["subscriptions"])
class UpdateSubscription(APIView):
    permission_classes = (IsAuthenticatedOrHasUserAPIKey,)

    @extend_schema(
        operation_id="update_subscription",
        request=inline_serializer(
            "UpdateSubscription", {"plan": rest_framework.serializers.CharField()}
        ),
        responses={200: OpenApiTypes.OBJECT},
    )
    def post(self, request):
        stripe_module = get_stripe_module()
        plan = request.data.get("plan")
        if not plan:
            return Response({"detail": "Plan parameter is required"}, status=400)

        user = request.user
        stripe_customer = StripeCustomer.objects.filter(user=user).first()
        if not stripe_customer:
            return Response({"detail": "Stripe customer not found"}, status=404)

        try:
            subscription = user.subscriptions.first()
            if not subscription:
                return Response({"detail": "No active subscription found"}, status=404)

            current_plan = get_plan_name(subscription.price_id) if subscription.price_id else PLANS["free"]
            new_price_id = get_price_id_from_plan(plan)

            if plan == "Free":
                cancel_subscription(subscription.subscription_id, at_period_end=True)
                return Response({"detail": "Subscription canceled. Switched to Free plan."})

            if is_downgrade(current_plan, plan):
                stripe_module.Subscription.modify(
                    subscription.subscription_id,
                    cancel_at_period_end=True
                )

                stripe_module.SubscriptionSchedule.create(
                    customer=stripe_customer.customer_id,
                    start_date=subscription.period_end,
                    phases=[
                        {
                            "items": [{"price": new_price_id, "quantity": 1}],
                            "billing_cycle_anchor": "automatic",
                            "proration_behavior": "none"
                        }
                    ],
                    end_behavior="release"
                )

                return Response({
                    "detail": "Downgrade scheduled at period end.",
                    "subscription_id": subscription.subscription_id,
                })
            else:
                portal_url = create_customer_portal_session(
                    user,
                    customer_portal_flow_type="subscription_update_confirm",
                    plan=plan,
                    success_url="http://localhost/settings/subscription"
                )
                return Response({"url": portal_url})
        except Exception as e:
            log.error("Error updating subscription: %s", str(e))
            return Response({"detail": f"Internal server error: {str(e)}"}, status=500)


__all__ = ['ProductsListAPI', 'CreateCheckoutSession', 'CreatePortalSession', 'ReportUsageAPI', 'ListUsageRecordsAPI', 'UpdateSubscription']
