from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("microapps", "0061_rag_filesource_schema"),
    ]

    operations = [
        migrations.AddField(
            model_name="microapp",
            name="permitted_domains",
            field=models.JSONField(blank=True, default=list),
        ),
    ]
