from django.db import models
from apps.microapps.models import Microapps
from micro_ai import settings


class Collection(models.Model):
    name = models.CharField(max_length=100)
    # user_id = models.ForeignKey(settings.AUTH_USER_MODEL)

    class Meta:
        db_table = 'collection'

class CollectionMaJoin(models.Model):
    collection_id = models.ForeignKey(Collection)
    ma_id = models.ForeignKey(Microapps)

    class Meta:
        db_table = 'collection_ma_join'

class CollectionUserJoin:

    VIEW = 'view'
    ADMIN = 'admin'

    ROLE_CHOICES = [
        (VIEW, 'View'),
        (ADMIN, 'Admin'),
    ]

    collection_id = models.ForeignKey(Collection)
    user_id = models.ForeignKey(settings.AUTH_USER_MODEL)
    role = models.CharField(max_length=10, choices=ROLE_CHOICES, default=VIEW)

    class Meta:
        db_table = 'collection_user_join'

