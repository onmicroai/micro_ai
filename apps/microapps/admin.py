from django.contrib import admin
from .models import MicroAppUserJoin, Microapps, Assets, AssetsMaJoin, KnowledgeBase, Run

# Register your models here.

admin.site.register(MicroAppUserJoin)
admin.site.register(Microapps)
# admin.site.register(Assets)
# admin.site.register(AssetsMaJoin)
# admin.site.register(KnowledgeBase)
admin.site.register(Run)
