from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone


class Migration(migrations.Migration):

    dependencies = [
        ("microapps", "0062_add_permitted_domains"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="AppUsageSession",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("session_id", models.UUIDField(db_index=True)),
                ("source", models.CharField(choices=[("app", "app"), ("preview", "preview"), ("embed", "embed")], default="app", max_length=20)),
                ("started_at", models.DateTimeField(auto_now_add=True)),
                ("last_seen_at", models.DateTimeField(default=django.utils.timezone.now)),
                ("ended_at", models.DateTimeField(blank=True, null=True)),
                ("user_ip", models.CharField(blank=True, default="", max_length=64)),
                ("ma_id", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="usage_sessions", to="microapps.microapp")),
                ("user_id", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="app_usage_sessions", to=settings.AUTH_USER_MODEL)),
            ],
        ),
        migrations.AddIndex(
            model_name="appusagesession",
            index=models.Index(fields=["ma_id", "session_id"], name="usage_ma_session_idx"),
        ),
        migrations.AddIndex(
            model_name="appusagesession",
            index=models.Index(fields=["ma_id", "started_at"], name="usage_ma_started_idx"),
        ),
    ]
