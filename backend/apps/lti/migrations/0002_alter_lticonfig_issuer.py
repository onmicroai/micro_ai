# Generated by Django 5.1.6 on 2025-04-24 07:55

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('lti', '0001_initial'),
    ]

    operations = [
        migrations.AlterField(
            model_name='lticonfig',
            name='issuer',
            field=models.CharField(max_length=255),
        ),
    ]
