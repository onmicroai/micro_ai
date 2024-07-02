from datetime import timezone
from django.db import models

class MicroAppTemplate(models.Model):
    
    app_name = models.CharField(max_length=50, unique=True, help_text="micro app name")
    app_json = models.JSONField(help_text="json for app")
    # created_at = models.DateTimeField(default=timezone.now, help_text="time when app was created")

    def __str__(self) -> str:
        return self.app_name
