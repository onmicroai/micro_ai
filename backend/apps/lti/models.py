from django.db import models
from django.contrib.postgres.fields import ArrayField
from apps.microapps.models import Microapp  # You'll need to adjust this import path

class LTIConfig(models.Model):
   microapp = models.ForeignKey(
       Microapp,
       on_delete=models.CASCADE,
       related_name='lti_configs'
   )
   issuer = models.CharField(max_length=255)
   client_id = models.CharField(max_length=100)
   auth_login_url = models.URLField()
   auth_token_url = models.URLField()
   key_set_url = models.URLField()
   deployment_ids = ArrayField(models.CharField(max_length=50), default=list)

   def __str__(self):
      return f"{self.issuer} ({self.client_id})"

