from django.db import models

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

    def __str__(self):
        return self.title

class GlobalAsset(models.Model):
    file = models.TextField()
    label = models.TextField()

class AssetsGaJoin(models.Model):
    global_app_id = models.ForeignKey(GlobalMicroapps, on_delete=models.CASCADE)
    asset_id = models.ForeignKey(GlobalAsset, on_delete=models.CASCADE)
