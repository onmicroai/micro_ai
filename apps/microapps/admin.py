from django.contrib import admin
from .models import MicroAppUserJoin, Microapp, Asset, AssetsMaJoin, KnowledgeBase, Run

# Register your models here.

admin.site.register(MicroAppUserJoin)
admin.site.register(Microapp)
# admin.site.register(Asset)
# admin.site.register(AssetsMaJoin)
# admin.site.register(KnowledgeBase)
admin.site.register(Run)
