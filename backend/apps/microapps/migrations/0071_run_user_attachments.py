from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("microapps", "0070_microapp_promotion_fields"),
    ]

    operations = [
        migrations.AddField(
            model_name="run",
            name="user_attachments",
            field=models.JSONField(blank=True, default=list),
        ),
    ]
