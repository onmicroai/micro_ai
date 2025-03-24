from djstripe.models import Product, Subscription, Price, SubscriptionItem, Plan
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers
from .models import UsageEvent, BillingCycle
from apps.subscriptions.models import Subscription as CustomSubscription

class SpendCreditsSerializer(serializers.Serializer):
    amount = serializers.IntegerField(min_value=1)

class PriceSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name")
    human_readable_price = serializers.SerializerMethodField()
    payment_amount = serializers.SerializerMethodField()

    @extend_schema_field(OpenApiTypes.STR)
    def get_human_readable_price(self, obj):
        # this needs to be here because djstripe can return a proxy object which can't be serialized
        return str(obj.human_readable_price)

    @extend_schema_field(OpenApiTypes.STR)
    def get_payment_amount(self, obj):
        if self.context.get("product_metadata", None):
            return self.context["product_metadata"].get_price_display(obj)
        return str(obj.human_readable_price)

    class Meta:
        model = Price
        fields = ("id", "product_name", "human_readable_price", "payment_amount", "nickname", "unit_amount")


class SubscriptionItemSerializer(serializers.ModelSerializer):
    price = PriceSerializer()

    class Meta:
        model = SubscriptionItem
        fields = ("id", "price", "quantity")


class SubscriptionSerializer(serializers.ModelSerializer):
    """
    A serializer for Subscriptions which uses the SubscriptionWrapper object under the hood
    """

    items = SubscriptionItemSerializer(many=True)
    display_name = serializers.CharField()
    billing_interval = serializers.CharField()

    class Meta:
        # we use Subscription instead of SubscriptionWrapper so DRF can infer the model-based fields automatically
        model = Subscription
        fields = (
            "id",
            "display_name",
            "start_date",
            "billing_interval",
            "current_period_start",
            "current_period_end",
            "cancel_at_period_end",
            "start_date",
            "status",
            "quantity",
            "items",
        )


class ProductSerializer(serializers.ModelSerializer):
    class Meta:
        model = Product
        fields = ("id", "name")


class CustomSubscriptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomSubscription
        fields = [
            'id', 'user', 'customer', 'subscription_id', 'price_id',
            'status', 'period_start', 'period_end', 'cancel_at_period_end',
            'canceled_at', 'created_at', 'updated_at'
        ]

class PlansSerializer(serializers.ModelSerializer):

    class Meta:
        model = Plan
        fields = '__all__'

class UsageEventSerializer(serializers.ModelSerializer):

    class Meta:
        model = UsageEvent
        fields = '__all__'

class BillingDetailsSerializer(serializers.ModelSerializer):

    class Meta:
        model = BillingCycle
        fields = '__all__'