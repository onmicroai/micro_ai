# Generated by Django 5.1.6 on 2025-05-12 17:23

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('lti', '0002_alter_lticonfig_issuer'),
        ('microapps', '0052_delete_aimodelconfig'),
    ]

    operations = [
        migrations.AddField(
            model_name='lticonfig',
            name='microapp',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='lti_configs', to='microapps.microapp'),
        ),
    ]
