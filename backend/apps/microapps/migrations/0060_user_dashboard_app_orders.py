from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("collection", "0001_initial"),
        ("microapps", "0059_run_session_id_index"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="UserDashboardAppOrder",
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
                ("sort_index", models.PositiveIntegerField()),
                (
                    "ma",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        to="microapps.microapp",
                    ),
                ),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ["sort_index", "ma_id"],
            },
        ),
        migrations.CreateModel(
            name="UserCollectionAppOrder",
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
                ("sort_index", models.PositiveIntegerField()),
                (
                    "collection",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        to="collection.collection",
                    ),
                ),
                (
                    "ma",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        to="microapps.microapp",
                    ),
                ),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ["sort_index", "ma_id"],
            },
        ),
        migrations.AddConstraint(
            model_name="userdashboardapporder",
            constraint=models.UniqueConstraint(
                fields=("user", "ma"),
                name="uniq_user_dashboard_app_order",
            ),
        ),
        migrations.AddConstraint(
            model_name="usercollectionapporder",
            constraint=models.UniqueConstraint(
                fields=("user", "collection", "ma"),
                name="uniq_user_collection_dashboard_app_order",
            ),
        ),
    ]
