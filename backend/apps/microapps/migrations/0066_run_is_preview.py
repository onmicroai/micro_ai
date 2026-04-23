from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("microapps", "0065_run_phase_title"),
    ]

    operations = [
        migrations.AddField(
            model_name="run",
            name="is_preview",
            field=models.BooleanField(default=False),
        ),
    ]
