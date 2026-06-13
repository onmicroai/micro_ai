from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("microapps", "0069_run_api_messages"),
    ]

    operations = [
        migrations.AddField(
            model_name="microapp",
            name="is_promoted",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="microapp",
            name="promo_priority",
            field=models.PositiveIntegerField(default=0),
        ),
    ]
