from rest_framework import serializers
from .models import Microapp, MicroAppUserJoin, Asset, AssetsMaJoin, Run
from decimal import Decimal
from apps.microapps.rubric_publish import reconcile_active_rubric_pointer_after_app_json_save


class MicroAppSerializer(serializers.ModelSerializer):
    class Meta:
        model = Microapp
        fields = '__all__'
        extra_kwargs = {
            'is_archived': {'write_only': True},
            'hash_id': {'allow_null': True},
            'is_promoted': {'read_only': True},
            'promo_priority': {'read_only': True},
        }

    def update(self, instance, validated_data):
        instance = super().update(instance, validated_data)
        if "app_json" in validated_data:
            reconcile_active_rubric_pointer_after_app_json_save(instance.pk)
            instance.refresh_from_db()
        return instance

class PromotedMicroAppSerializer(serializers.ModelSerializer):
    description = serializers.CharField(source='explanation')
    app_url = serializers.SerializerMethodField()

    class Meta:
        model = Microapp
        fields = ['hash_id', 'title', 'description', 'app_url']

    def get_app_url(self, obj):
        return f'/app/{obj.hash_id}'

class MicroAppSwaggerPostSerializer(serializers.ModelSerializer):
    collection_id = serializers.IntegerField(write_only=True, required=False, allow_null=True)
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
        fields = [
            "ma_id",
            "user_id",
            "session_id",
            "ai_model",
            "no_submission",
            "request_skip",
            "scored_run",
            "minimum_score",
            "rubric",
            "temperature",
            "max_tokens",
            "satisfaction",
            "response",
            "run_uuid",
            "litellm_response_id",
            "is_preview",
        ]

class RunGetSerializer(serializers.ModelSerializer):
    cost = serializers.DecimalField(max_digits=20, decimal_places=6, coerce_to_string=False)

    class Meta:
        model = Run
        fields = '__all__'

class RunPatchSerializer(serializers.ModelSerializer):
    cost = serializers.DecimalField(max_digits=20, decimal_places=6, coerce_to_string=False)
    
    class Meta:
        model = Run
        exclude = ["user_id", "ma_id", "owner_id", "user_ip"]

class FileUploadSerializer(serializers.Serializer):
    filename = serializers.CharField()
    content_type = serializers.CharField()
    file_type = serializers.CharField(required=False, default='general')  # To distinguish different types of files

class ImageUploadSerializer(serializers.Serializer):
    filename = serializers.CharField()
    content_type = serializers.CharField()

class PresignedUrlResponse(serializers.Serializer):
    url = serializers.CharField()
    fields = serializers.DictField()
