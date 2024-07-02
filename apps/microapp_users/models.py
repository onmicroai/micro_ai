from datetime import timezone
from django.conf import settings
from django.db import models
from apps.microapp_templates.models import MicroAppTemplate

class MicroAppUser(models.Model):

    template_id = models.ForeignKey(MicroAppTemplate, null=True, blank=True)
    user_id = models.ForeignKey(settings.AUTH_USER_MODEL)
    app_name = models.CharField(max_length=50, unique=True, help_text="micro app name")
    app_json = models.JSONField(help_text="json for app")
    created_at = models.DateTimeField(default=timezone.now, help_text="time when app was created")

    def __str__(self) -> str:
        return self.app_name
