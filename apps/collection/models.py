from django.db import models

from micro_ai import settings


class Collection(models.Model):
    name = models.CharField(max_length=100)

    class Meta:
        db_table = 'collection'

class CollectionMAJoin(models.Model):
    collection_id = models.ForeignKey(Collection, on_delete=models.CASCADE, related_name='collection_joins')
    ma_id = models.ForeignKey(related_name="ma_joins")

    class Meta:
        db_table = 'collection_ma_join'

class CollectionUserJoin:

    VIEW = 'view'
    ADMIN = 'admin'

    ROLE_CHOICES = [
        (VIEW, 'View'),
        (ADMIN, 'Admin'),
    ]

    collection_id = models.ForeignKey(Collection, on_delete=models.CASCADE, related_name= 'user_joins')
    user_id = models.ForeignKey(settings.AUTH_USER_MODEL)
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default=VIEW)

    class Meta:
        db_table = 'collection_user_join'

