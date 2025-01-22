import rest_framework.serializers
from django.utils.decorators import method_decorator
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework.response import Response
from rest_framework.views import APIView
from djstripe.models import Product, Price

from apps.api.permissions import IsAuthenticatedOrHasUserAPIKey
from apps.teams.decorators import team_admin_required
from django.conf import settings

from ..exceptions import SubscriptionConfigError
from ..helpers import create_stripe_checkout_session, create_stripe_portal_session
from ..metadata import get_active_products_with_metadata, ProductWithMetadata


class ProductWithPriceSerializer(rest_framework.serializers.Serializer):
    id = rest_framework.serializers.CharField(source='default_price.id', default=None)
    name = rest_framework.serializers.CharField()
    description = rest_framework.serializers.CharField()
    price = rest_framework.serializers.IntegerField(source='default_price.unit_amount', default=0)
    currency = rest_framework.serializers.CharField(source='default_price.currency', default='usd')
    interval = rest_framework.serializers.SerializerMethodField()
    features = rest_framework.serializers.SerializerMethodField()

    def get_interval(self, obj):
        if not obj.default_price or not obj.default_price.recurring:
            return 'month'  # default interval
        return obj.default_price.recurring.get('interval', 'month')

    def get_features(self, obj):
        if obj.name == settings.FREE_PLAN_NAME:
            return settings.FREE_PLAN_FEATURES
        elif obj.name == settings.INDIVIDUAL_PLAN_NAME:
            return settings.INDIVIDUAL_PLAN_FEATURES
        elif obj.name == settings.ENTERPRISE_PLAN_NAME:
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

        products = Product.objects.filter(active=True).prefetch_related('prices')
        for product in products:
            # Set the default price for each product (only considering active prices)
            active_prices = [p for p in product.prices.all() if p.active]
            product.default_price = active_prices[0] if active_prices else None
        
        # Only return products that have at least one active price
        products = [p for p in products if p.default_price]
        serializer = self.serializer_class(products, many=True)
        return Response(serializer.data)


@extend_schema(tags=["subscriptions"], exclude=True)
class CreateCheckoutSession(APIView):
    permission_classes = (IsAuthenticatedOrHasUserAPIKey,)

    @extend_schema(
        operation_id="create_checkout_session",
        request=inline_serializer("CreateCheckout", {"priceId": rest_framework.serializers.CharField()}),
        responses={
            200: OpenApiTypes.URI,
        },
    )
    def post(self, request):
        if not request.user.is_authenticated:
            return Response({"detail": "Authentication required"}, status=401)
        
        if not request.team:
            return Response({"detail": "Team not found"}, status=404)

        subscription_holder = request.team
        price_id = request.data.get("priceId")
        
        if not price_id:
            return Response({"detail": "Price ID is required"}, status=400)

        checkout_session = create_stripe_checkout_session(
            subscription_holder,
            price_id,
            request.user,
        )
        return Response({"url": checkout_session.url})


@extend_schema(tags=["subscriptions"], exclude=True)
class CreatePortalSession(APIView):
    @extend_schema(
        operation_id="create_portal_session",
        request=None,
        responses={
            200: OpenApiTypes.URI,
        },
    )
    @method_decorator(team_admin_required)
    def post(self, request, team_slug):
        subscription_holder = request.team
        try:
            portal_session = create_stripe_portal_session(subscription_holder)
            return Response(portal_session.url)
        except SubscriptionConfigError as e:
            return Response(str(e), status=500)
