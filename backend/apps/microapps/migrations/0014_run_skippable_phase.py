# Generated by Django 5.0.6 on 2024-07-25 05:04

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('microapps', '0013_alter_run_run_score'),
    ]

    operations = [
        migrations.AddField(
            model_name='run',
            name='skippable_phase',
            field=models.BooleanField(default=False),
        ),
    ]
