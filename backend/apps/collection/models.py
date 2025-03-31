# \micro_ai\apps\collection\models.py

from django.db import models
from apps.microapps.models import Microapp
from micro_ai import settings


class Collection(models.Model):
    name = models.CharField(max_length=100)

    def __str__(self):
        return self.name

class CollectionMaJoin(models.Model):
    collection_id = models.ForeignKey(Collection, on_delete=models.CASCADE)
    ma_id = models.ForeignKey(Microapp, on_delete=models.CASCADE)

    def __str__(self):
        return f"Collection: {self.collection_id}, Microapp: {self.ma_id}"
    
class CollectionUserJoin(models.Model):
    VIEW = 'view'
    ADMIN = 'admin'
    ROLE_CHOICES = [
        (VIEW, 'View'),
        (ADMIN, 'Admin'),
    ]
    collection_id = models.ForeignKey(Collection, on_delete=models.CASCADE)
    user_id = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    role = models.CharField(max_length=10, choices=ROLE_CHOICES, default=VIEW)

    def __str__(self):
        return f"{self.user_id} {self.role}"
    

