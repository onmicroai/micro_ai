from django.contrib import admin
from .models import AiModelConfig, MicroAppUserJoin, Microapp, Asset, AssetsMaJoin, KnowledgeBase, Run

# Register your models here.

admin.site.register(MicroAppUserJoin)
admin.site.register(Microapp)
admin.site.register(AiModelConfig)
admin.site.register(Run)
