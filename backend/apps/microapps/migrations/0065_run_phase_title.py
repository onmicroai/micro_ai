from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("microapps", "0064_appthemesnapshot"),
    ]

    operations = [
        migrations.AddField(
            model_name="run",
            name="phase_title",
            field=models.CharField(blank=True, default="", max_length=255),
        ),
        migrations.AddField(
            model_name="run",
            name="is_chat_run",
            field=models.BooleanField(default=False),
        ),
    ]
