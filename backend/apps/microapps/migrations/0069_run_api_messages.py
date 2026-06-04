from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("microapps", "0068_score_analysis_snapshot"),
    ]

    operations = [
        migrations.AddField(
            model_name="run",
            name="api_messages",
            field=models.JSONField(blank=True, default=list),
        ),
    ]
