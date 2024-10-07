from rest_framework import serializers
from .models import Microapp, MicroAppUserJoin, Asset, AssetsMaJoin, Run, AIModelConfig

class MicroAppSerializer(serializers.ModelSerializer):
    class Meta:
        model = Microapp
        fields = '__all__'

    def to_internal_value(self, data):
        # If app_json is not provided or is empty, set the default pages
        if 'app_json' not in data or not data['app_json']:
            data['app_json'] = {
                "pages": [
                    {
                        "name": "page1",
                        "elements": [
                            {
                                "name": "AI Prompt 1",
                                "type": "ai-prompt",
                                "title": "AI Prompt 1",
                                "aiPromptProperty": "Say hello to {Name} {Surname} "
                            },
                            {
                                "name": "Name",
                                "type": "text",
                                "title": "Name"
                            },
                            {
                                "name": "Surname",
                                "type": "text",
                                "title": "Surname"
                            }
                        ]
                    }
                ]
            }
        return super().to_internal_value(data)

class MicroappUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = MicroAppUserJoin
        fields = '__all__'

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
        fields = ['ma_id', 'user_id', 'session_id', 'ai_model', 'prompt', 'no_submission', 'request_skip', 'scored_run', 'minimum_score', 'rubric','frequency_penalty', 'presence_penalty', 'top_p', 'temperature', 'max_tokens', 'satisfaction', 'response']

class RunGetSerializer(serializers.ModelSerializer):
    class Meta:
        model = Run
        fields = '__all__'


class AiModelConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = AIModelConfig
        fields = '__all__'
    
