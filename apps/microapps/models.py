from django.db import models
from apps.global_microapps.models import GlobalMicroapps
from micro_ai import settings

class Microapp(models.Model):
    title = models.CharField(max_length=50)
    explanation = models.TextField()
    shared_assets = models.CharField(max_length=50)
    type = models.CharField(max_length=10)
    knowledge_base = models.CharField(max_length=50)
    max_output = models.IntegerField()
    temperature = models.FloatField()
    top_p = models.FloatField()
    frequency_penalty = models.FloatField()
    presence_penalty = models.FloatField()
    max_prompts = models.IntegerField()
    copy_allowed = models.BooleanField()
    app_json = models.JSONField()
    global_ma_id = models.ForeignKey(GlobalMicroapps, on_delete=models.CASCADE)

class MicroAppUserJoin(models.Model):
    VIEW = 'view'
    ADMIN = 'admin'

    ROLE_CHOICES = [
        (VIEW, 'View'),
        (ADMIN, 'Admin'),
    ]

    ma_id = models.ForeignKey(Microapp, on_delete=models.CASCADE)
    user_id = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    role = models.CharField(max_length=10, choices=ROLE_CHOICES)

class Asset(models.Model):
    file = models.TextField()
    label = models.TextField()

class AssetsMaJoin(models.Model):
    ma_id = models.ForeignKey(Microapp, on_delete=models.CASCADE)
    asset_id = models.ForeignKey(Asset, on_delete=models.CASCADE)


class KnowledgeBase(models.Model):

    file = models.TextField()

class Run(models.Model):
    
    ma_id = models.ForeignKey(Microapp, on_delete=models.CASCADE)
    user_id = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    timestamp = models.DateTimeField(auto_now_add=True)
    session_id = models.TextField(blank=True)
    satisfaction = models.IntegerField()
    prompt = models.JSONField()
    response = models.TextField()
    credits = models.FloatField()
    cost = models.DecimalField(max_digits=20, decimal_places=6)


