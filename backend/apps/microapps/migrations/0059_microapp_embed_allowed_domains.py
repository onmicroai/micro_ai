from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("microapps", "0058_rubricbuild"),
    ]

    operations = [
        migrations.AddField(
            model_name="microapp",
            name="embed_allowed_domains",
            field=models.JSONField(blank=True, default=list),
        ),
    ]

