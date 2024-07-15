from rest_framework import serializers 
from apps.global_microapps.models import GlobalMicroapps, GlobalAsset, AssetsGaJoin

class GlobalMicroAppsSerializer(serializers.ModelSerializer):
    
    class Meta:
        model = GlobalMicroapps
        fields = '__all__'

class AssetsSerializer(serializers.ModelSerializer):
    class Meta:
        model = GlobalAsset
        fields = '__all__'

class AssetsGlobalappSerializer(serializers.ModelSerializer):
    class Meta:
        model = AssetsGaJoin
        fields = '__all__'