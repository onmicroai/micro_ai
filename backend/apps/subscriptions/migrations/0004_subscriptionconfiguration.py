# Generated by Django 5.0.6 on 2025-01-22 21:56

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('subscriptions', '0003_rename_subscriptiondetails_subscriptiondetail'),
    ]

    operations = [
        migrations.CreateModel(
            name='SubscriptionConfiguration',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('max_apps', models.IntegerField(help_text='Maximum number of apps allowed for this subscription')),
                ('subscription', models.CharField(blank=True, max_length=255, null=True)),
            ],
        ),
    ]
