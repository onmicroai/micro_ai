from rest_framework import serializers
from .models import Microapps, MicroAppUserJoin, Assets, AssetsMaJoin, Run

class MicroAppSerializer(serializers.ModelSerializer):
    class Meta:
        model = Microapps
        fields = '__all__'

class MicroappUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = MicroAppUserJoin
        fields = '__all__'

class AssetsSerializer(serializers.ModelSerializer):
    class Meta:
        model = Assets
        fields = '__all__'

class AssetsMicroappSerializer(serializers.ModelSerializer):
    class Meta:
        model = AssetsMaJoin
        fields = '__all__'

class RunSerializer(serializers.ModelSerializer):
    class Meta:
        model = Run
        fields = '__all__'
    
