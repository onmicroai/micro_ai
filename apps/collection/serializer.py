from rest_framework import serializers
from .models import Collection, CollectionMaJoin, CollectionUserJoin
from apps.microapps.serializer import MicroAppSerializer

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

class CollectionMicroAppSwaggerGetSerializer(serializers.ModelSerializer):
    microapps = MicroAppSerializer(many=True)
    collection_id = serializers.IntegerField(source='id')
    collection_name = serializers.IntegerField(source='name')

    class Meta:
        model = Collection
        fields = ['collection_id', 'collection_name', 'microapps']
