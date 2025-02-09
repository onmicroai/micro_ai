from django.contrib import admin
from .models import MicroAppUserJoin, Microapp, Run

# Register your models here.

admin.site.register(MicroAppUserJoin)
admin.site.register(Microapp)
admin.site.register(Run)
