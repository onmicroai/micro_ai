from django.contrib import admin
from .models import AIModelConfig, MicroAppUserJoin, Microapp, Asset, AssetsMaJoin, KnowledgeBase, Run

# Register your models here.

admin.site.register(MicroAppUserJoin)
admin.site.register(Microapp)
admin.site.register(AIModelConfig)
admin.site.register(Run)
