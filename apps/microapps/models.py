from django.db import models
from apps.global_microapps.models import GlobalMicroapps
from micro_ai import settings
# Create your models here.

class Microapps(models.Model):

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
    global_ma_id = models.ForeignKey(GlobalMicroapps)

    class Meta:
        db_table = 'microapp'


class MicroAppUserJoin:

    VIEW = 'view'
    ADMIN = 'admin'

    ROLE_CHOICES = [
        (VIEW, 'View'),
        (ADMIN, 'Admin'),
    ]

    ma_id = models.ForeignKey(Microapps)
    user_id = models.ForeignKey(settings.AUTH_USER_MODEL)
    role = models.CharField(max_length=10, choices=ROLE_CHOICES)

    class Meta:
        db_table = 'ma_user_join'


class KnowledgeBase(models.Model):

    file = models.TextField()

    class Meta:
        db_table = 'knowledge_base'

class Run(models.Model):
    
    ma_id = models.ForeignKey(Microapps)
    user_id = models.ForeignKey(settings.AUTH_USER_MODEL)
    timestamp = models.DateTimeField(auto_now_add=True)
    assistant_id = models.TextField()
    thread_id = models.TextField()
    satisfaction = models.IntegerField()
    prompt = models.TextField()
    response = models.TextField()
    credits = models.FloatField()
    cost = models.FloatField()

    class Meta:
        db_table = "run"

