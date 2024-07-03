from datetime import timezone
from django.db import models

class MicroAppTemplate(models.Model):
    
    app_name = models.CharField(max_length=50, unique=True, help_text="micro-app name")
    app_json = models.JSONField(help_text="micro-app json")
    # created_at = models.DateTimeField()

    def __str__(self) -> str:
        return self.app_name
