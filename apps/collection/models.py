from django.db import models
from apps.microapps.models import Microapp
from micro_ai import settings


class Collection(models.Model):
    name = models.CharField(max_length=100)
    # user_id = models.ForeignKey(settings.AUTH_USER_MODEL)

class CollectionMaJoin(models.Model):
    collection_id = models.ForeignKey(Collection, on_delete=models.CASCADE)
    ma_id = models.ForeignKey(Microapp, on_delete=models.CASCADE)


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

