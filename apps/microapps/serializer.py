from rest_framework import serializers
from .models import Microapp, MicroAppUserJoin, Asset, AssetsMaJoin, Run

class MicroAppSerializer(serializers.ModelSerializer):
    class Meta:
        model = Microapp
        fields = '__all__'
        extra_kwargs = {'is_archived': {'write_only': True}, 'hash_id': {'allow_null': True}} #We allow the hash_id to be null because it is generated when the microapp is created

class MicroAppSwaggerPostSerializer(serializers.ModelSerializer):
    collection_id = serializers.IntegerField(write_only=True)
    class Meta:
        model = Microapp
        fields = ["collection_id", "app_json"]

class MicroAppSwaggerPutSerializer(serializers.ModelSerializer):
    class Meta:
        model = Microapp
        fields = ["app_json"]

class MicroappUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = MicroAppUserJoin
        fields = '__all__'
        extra_kwargs = {'is_archived': {'write_only': True}}
        
class AssetsSerializer(serializers.ModelSerializer):
    class Meta:
        model = Asset
        fields = '__all__'

class AssetsMicroappSerializer(serializers.ModelSerializer):
    class Meta:
        model = AssetsMaJoin
        fields = '__all__'

class RunPostSerializer(serializers.ModelSerializer):
    class Meta:
        model = Run
        fields = ['ma_id', 'user_id', 'session_id', 'ai_model', 'no_submission', 'request_skip', 'scored_run', 'minimum_score', 'rubric','frequency_penalty', 'presence_penalty', 'top_p', 'temperature', 'max_tokens', 'satisfaction', 'response']

class RunGetSerializer(serializers.ModelSerializer):
    class Meta:
        model = Run
        fields = '__all__'

class RunPatchSerializer(serializers.ModelSerializer):
    class Meta:
        model = Run
        exclude = ["user_id", "ma_id", "owner_id", "user_ip"]
    
