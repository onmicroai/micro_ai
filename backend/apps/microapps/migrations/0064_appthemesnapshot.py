from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("microapps", "0063_appusagesession"),
    ]

    operations = [
        migrations.CreateModel(
            name="AppThemeSnapshot",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("generated_at", models.DateTimeField(auto_now_add=True)),
                ("source_window_start", models.DateTimeField(blank=True, null=True)),
                ("source_window_end", models.DateTimeField(blank=True, null=True)),
                ("conversation_count_used", models.IntegerField(default=0)),
                ("themes_json", models.JSONField(blank=True, default=list)),
                ("model_used", models.CharField(default="gpt-4o-mini", max_length=100)),
                ("status", models.CharField(choices=[("success", "success"), ("failed", "failed")], default="success", max_length=20)),
                ("error_message", models.TextField(blank=True, default="")),
                ("ma_id", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="theme_snapshots", to="microapps.microapp")),
            ],
        ),
        migrations.AddIndex(
            model_name="appthemesnapshot",
            index=models.Index(fields=["ma_id", "generated_at"], name="theme_ma_generated_idx"),
        ),
        migrations.AddIndex(
            model_name="appthemesnapshot",
            index=models.Index(fields=["status", "generated_at"], name="theme_status_generated_idx"),
        ),
    ]
