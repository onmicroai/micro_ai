from django.db import models

# Create your models here.

class GlobalMicroapps(models.Model):
    
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

    class Meta:
        db_table = 'global_microapp'


