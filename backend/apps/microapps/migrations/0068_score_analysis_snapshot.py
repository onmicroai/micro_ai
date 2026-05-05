import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("microapps", "0067_rubric_version_and_run_fk"),
    ]

    operations = [
        migrations.CreateModel(
            name="ScoreAnalysisSnapshot",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("source_fingerprint", models.CharField(max_length=512)),
                ("payload_json", models.JSONField()),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "rubric_version",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="score_analysis_snapshot",
                        to="microapps.rubricversion",
                    ),
                ),
            ],
        ),
    ]
