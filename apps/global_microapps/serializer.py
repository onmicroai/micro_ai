from rest_framework import serializers 
from apps.global_microapps.models import GlobalMicroapps, GlobalAssets, AssetsGaJoin

class GlobalMicroAppsSerializer(serializers.ModelSerializer):
    
    class Meta:
        model = GlobalMicroapps
        fields = '__all__'

class AssetsSerializer(serializers.ModelSerializer):
    class Meta:
        model = GlobalAssets
        fields = '__all__'

class AssetsGlobalappSerializer(serializers.ModelSerializer):
    class Meta:
        model = AssetsGaJoin
        fields = '__all__'