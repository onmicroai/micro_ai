from rest_framework import serializers
from .models import Collection, CollectionMaJoin, CollectionUserJoin

class CollectionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Collection
        fields = '__all__'

class CollectionMicroappSerializer(serializers.ModelSerializer):
    class Meta:
        model = CollectionMaJoin
        fields = '__all__'

class CollectionUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = CollectionUserJoin
        fields = '__all__'
