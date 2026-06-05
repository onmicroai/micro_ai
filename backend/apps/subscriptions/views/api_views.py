import logging
from functools import wraps
from rest_framework import serializers
from apps.subscriptions.constants import PLANS
from apps.subscriptions.serializers import SpendCreditsSerializer
import rest_framework.serializers
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework.response import Response
from rest_framework.views import APIView
from django.conf import settings
from apps.subscriptions.models import StripeCustomer, SubscriptionConfiguration, Subscription, Coupon, CouponUsage

from apps.api.permissions import IsAuthenticatedOrHasUserAPIKey
from rest_framework.permissions import IsAdminUser

from ..helpers import (
    cancel_subscription,
    create_customer_portal_session,
    create_stripe_checkout_session,
    get_plan_name,
)
from apps.utils.billing import get_stripe_module
from apps.subscriptions.credits import spend_credits, InsufficientCredits
from apps.subscriptions.serializers import SubscriptionConfigurationSerializer, CouponSerializer, CouponUsageSerializer
from apps.subscriptions.services import CouponActionService

log = logging.getLogger("micro_ai.subscription")

def _stripe_disabled():
    log.warning("Stripe endpoint called but STRIPE_ENABLED=False - set STRIPE_SECRET_KEY to enable.")
    return Response({"detail": "Stripe is not configured on this deployment."}, status=501)

def require_stripe(func):
    @wraps(func)
    def wrapper(self, request, *args, **kwargs):
        if not settings.STRIPE_ENABLED:
            return _stripe_disabled()
        return func(self, request, *args, **kwargs)
    return wrapper

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
        }

@extend_schema(tags=["subscriptions"])
class ProductsListAPI(APIView):
    permission_classes = (IsAuthenticatedOrHasUserAPIKey,)
    serializer_class = ProductWithPriceSerializer

    @extend_schema(responses={200: ProductWithPriceSerializer(many=True)})
    @require_stripe
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
        request=inline_serializer(
            name="CreateCheckout",
            fields={
                "plan": serializers.CharField(),
                "successUrl": serializers.CharField(required=False),
                "cancelUrl": serializers.CharField(required=False),
            }
        ),
        responses={200: OpenApiTypes.URI},
    )
    @require_stripe
    def post(self, request):
        user = request.user
        plan = request.data.get("plan")

        stripe_customer = StripeCustomer.objects.filter(user=user).first()
        customer_id = stripe_customer.customer_id if stripe_customer else None
        customer_email = user.email if not customer_id else None

        success_url = request.data.get("successUrl")
        cancel_url = request.data.get("cancelUrl")

        metadata = {}
        if plan == PLANS["top_up"]:
            metadata = {'price_id': settings.TOP_UP_CREDITS_PLAN_ID}

        try:
            checkout_session = create_stripe_checkout_session(
                plan=plan,
                customer_id=customer_id,
                customer_email=customer_email,
                success_url=success_url,
                cancel_url=cancel_url,
                metadata=metadata
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
    @require_stripe
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
    @require_stripe
    def post(self, request):
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

            if plan == "Free":
                cancel_subscription(subscription.subscription_id, at_period_end=True)
                return Response({"detail": "Subscription canceled. Switched to Free plan."})

            if plan in (PLANS["top_up"], "TopUp"):
                checkout_session = create_stripe_checkout_session(
                    plan=PLANS["top_up"],
                    customer_id=stripe_customer.customer_id,
                    customer_email=user.email,
                    success_url=f"{settings.DOMAIN}/settings/subscription?updated=success",
                    cancel_url=f"{settings.DOMAIN}/settings/subscription?updated=failure",
                    metadata={"price_id": settings.TOP_UP_CREDITS_PLAN_ID},
                )
                return Response({"url": checkout_session.url})

            # All upgrades and downgrades are handled by Stripe's Customer Portal,
            # which manages proration, scheduling, and confirmation. The local mirror
            # is then updated by the resulting subscription webhooks.
            portal_url = create_customer_portal_session(
                user,
                customer_portal_flow_type="subscription_update_confirm",
                plan=plan,
                success_url=f"{settings.DOMAIN}/settings/subscription?updated=success",
            )
            return Response({"url": portal_url})
        except Exception as e:
            log.error("Error updating subscription: %s", str(e))
            return Response({"detail": f"Internal server error: {str(e)}"}, status=500)

@extend_schema(tags=["subscriptions"])
class SpendCredits(APIView):
    permission_classes = (IsAuthenticatedOrHasUserAPIKey,)
    serializer_class = SpendCreditsSerializer

    @extend_schema(
        operation_id="spend_credits",
        request=SpendCreditsSerializer,
        responses={200: inline_serializer("SpendCreditsResponse", {
            "detail": serializers.CharField(),
            "remaining_credits": serializers.IntegerField(),
        })},
    )
    def post(self, request):
        serializer = self.serializer_class(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)
        
        amount = serializer.validated_data["amount"]
        user = request.user
        stripe_customer = StripeCustomer.objects.filter(user=user).first()

        try:
            new_combined_remaining = spend_credits(user, amount)
            return Response({
                "detail": "Credits spent successfully",
                "remaining_credits": new_combined_remaining
            })
        except InsufficientCredits:
            if not stripe_customer:
                return Response({"detail": "Stripe customer not found"}, status=404)
            plan = get_plan_name(settings.TOP_UP_CREDITS_PLAN_ID)
            checkout_session = create_stripe_checkout_session(
                plan=plan,
                customer_id=stripe_customer.customer_id,
                customer_email=user.email,
                success_url=f"{settings.DOMAIN}/settings/subscription?updated=success",
                cancel_url=f"{settings.DOMAIN}/settings/subscription?updated=failure",
                metadata={'price_id': settings.TOP_UP_CREDITS_PLAN_ID},
            )
            return Response({
                "detail": "Insufficient credits. Redirect to checkout.",
                "checkout_url": checkout_session.url
            }, status=402)
        except Exception as e:
            return Response({"detail": str(e)}, status=400)

@extend_schema(tags=["subscriptions"])
class SubscriptionConfigurationAPI(APIView):
    permission_classes = [IsAdminUser]
    serializer_class = SubscriptionConfigurationSerializer

    @extend_schema(request=SubscriptionConfigurationSerializer, responses={200: SubscriptionConfigurationSerializer})
    def post(self, request):
        serializer = self.serializer_class(data=request.data)
        if serializer.is_valid():
            config = serializer.save()
            return Response(self.serializer_class(config).data)
        return Response(serializer.errors, status=400)

    @extend_schema(request=SubscriptionConfigurationSerializer, responses={200: SubscriptionConfigurationSerializer})
    def put(self, request):
        subscription_id = request.data.get('subscription_id')
        if not subscription_id:
            return Response({'error': 'subscription_id is required'}, status=400)
        try:
            subscription = Subscription.objects.get(subscription_id=subscription_id)
            config = SubscriptionConfiguration.objects.get(subscription=subscription)
        except (Subscription.DoesNotExist, SubscriptionConfiguration.DoesNotExist):
            return Response({'error': 'Subscription or configuration not found'}, status=404)
        serializer = self.serializer_class(config, data=request.data, partial=True)
        if serializer.is_valid():
            config = serializer.save()
            return Response(self.serializer_class(config).data)
        return Response(serializer.errors, status=400)

@extend_schema(tags=["subscriptions"])
class RedeemCouponAPI(APIView):
    permission_classes = [IsAuthenticatedOrHasUserAPIKey]

    @extend_schema(
        request=inline_serializer(
            "RedeemCoupon",
            fields={
                "coupon_code": serializers.CharField(),
            }
        ),
        responses={200: inline_serializer(
            "RedeemCouponResponse",
            fields={
                "success": serializers.BooleanField(),
                "message": serializers.CharField(),
                "action": serializers.CharField(),
                "additional_data": serializers.DictField(),
            }
        )}
    )
    def post(self, request):
        code = request.data.get('coupon_code')
        if not code:
            return Response({'error': 'Coupon code required'}, status=400)
        
        try:
            coupon = Coupon.objects.get(code=code, is_active=True)
        except Coupon.DoesNotExist:
            return Response({'error': 'Invalid or inactive coupon code'}, status=400)
        
        # Check if user has already used this coupon
        if not coupon.can_be_used_by(request.user):
            return Response({'error': 'You have already used this coupon'}, status=400)
        
        # Execute the coupon action
        result = CouponActionService.execute_action(coupon, request.user)
        
        if result['success']:
            # Record the usage
            CouponUsage.objects.create(coupon=coupon, user=request.user)
            
            return Response({
                'success': True,
                'message': result['message'],
                'action': coupon.action,
                'additional_data': coupon.additional_data,
                **result  # Include any additional data from the action result
            })
        else:
            return Response({
                'success': False,
                'error': result['message']
            }, status=400)

__all__ = [
    'ProductsListAPI',
    'CreateCheckoutSession',
    'CreatePortalSession',
    'UpdateSubscription',
    'SpendCredits',
    'RedeemCouponAPI',
    'SubscriptionConfigurationAPI',
]
