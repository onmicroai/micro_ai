from rest_framework import serializers
from .models import MicroAppTemplate

class MicroAppTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = MicroAppTemplate
        fields = ['app_name', 'app_json', 'created_at']
