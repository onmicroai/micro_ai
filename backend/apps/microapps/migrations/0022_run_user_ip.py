# Generated by Django 5.0.6 on 2024-09-12 05:53

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('microapps', '0021_alter_run_ma_id_alter_run_owner_id_alter_run_user_id'),
    ]

    operations = [
        migrations.AddField(
            model_name='run',
            name='user_ip',
            field=models.CharField(blank=True, max_length=20),
        ),
    ]
