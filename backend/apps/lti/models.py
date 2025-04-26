from django.db import models
from django.contrib.postgres.fields import ArrayField

class LTIConfig(models.Model):
   issuer = models.CharField(max_length=255)
   client_id = models.CharField(max_length=100)
   auth_login_url = models.URLField()
   auth_token_url = models.URLField()
   key_set_url = models.URLField()
   deployment_ids = ArrayField(models.CharField(max_length=50), default=list)
   redirect_url = models.URLField()

   def __str__(self):
      return f"{self.issuer} ({self.client_id})"

