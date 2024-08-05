from django.contrib import admin
from .models import Collection, CollectionUserJoin, CollectionMaJoin

admin.site.register(Collection)
admin.site.register(CollectionUserJoin)
admin.site.register(CollectionMaJoin)
