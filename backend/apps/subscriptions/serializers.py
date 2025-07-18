from rest_framework import serializers
from .models import UsageEvent, BillingCycle, SubscriptionConfiguration
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

class SubscriptionConfigurationSerializer(serializers.ModelSerializer):
    subscription_id = serializers.CharField(write_only=True)

    class Meta:
        model = SubscriptionConfiguration
        fields = ['id', 'subscription_id', 'max_apps']

    def create(self, validated_data):
        from .models import Subscription
        subscription_id = validated_data.pop('subscription_id')
        subscription = Subscription.objects.get(subscription_id=subscription_id)
        config, _ = SubscriptionConfiguration.objects.update_or_create(
            subscription=subscription, defaults={'max_apps': validated_data['max_apps']}
        )
        return config

    def update(self, instance, validated_data):
        instance.max_apps = validated_data.get('max_apps', instance.max_apps)
        instance.save()
        return instance