from django.db import models

from apps.global_microapps.models import GlobalMicroapps
from apps.microapps.models import Microapps

# Create your models here.

class GAssets(models.Model):
    file = models.TextField()
    label = models.TextField()

    class Meta:
        db_table = 'g_asset'

class AssetsGaJoin(models.Model):
    ma_id = models.ForeignKey(GlobalMicroapps)
    asset_id = models.ForeignKey(GAssets)

    class Meta:
        db_table = 'assets_ga_join'


class Assets:
    file = models.TextField()
    label = models.TextField()

    class Meta:
        db_table = 'asset'

class AssetsMaJoin(models.Model):
    ma_id = models.ForeignKey(Microapps)
    asset_id = models.ForeignKey(Assets)

    class Meta:
        db_table = 'assets_ma_join'