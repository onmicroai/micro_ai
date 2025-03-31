from rest_framework import serializers
from .models import UsageEvent, BillingCycle
from apps.subscriptions.models import Subscription as CustomSubscription

class SpendCreditsSerializer(serializers.Serializer):
    amount = serializers.IntegerField(min_value=1)

class CustomSubscriptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomSubscription
        fields = [
            'id', 'user', 'customer', 'subscription_id', 'price_id',
            'status', 'period_start', 'period_end', 'cancel_at_period_end',
            'canceled_at', 'created_at', 'updated_at'
        ]
class UsageEventSerializer(serializers.ModelSerializer):

    class Meta:
        model = UsageEvent
        fields = '__all__'

class BillingDetailsSerializer(serializers.ModelSerializer):

    class Meta:
        model = BillingCycle
        fields = '__all__'