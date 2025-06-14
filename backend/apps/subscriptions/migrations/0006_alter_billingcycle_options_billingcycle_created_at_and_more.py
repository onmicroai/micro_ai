# Generated by Django 5.0.6 on 2025-01-23 01:05

import django.db.models.deletion
import django.utils.timezone
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('subscriptions', '0005_delete_subscription_detail'),
    ]

    operations = [
        migrations.AlterModelOptions(
            name='billingcycle',
            options={'ordering': ['-start_date']},
        ),
        migrations.AddField(
            model_name='billingcycle',
            name='created_at',
            field=models.DateTimeField(default=django.utils.timezone.now),
        ),
        migrations.AddField(
            model_name='billingcycle',
            name='is_prorated',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='billingcycle',
            name='last_usage_record_timestamp',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='billingcycle',
            name='previous_cycle',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to='subscriptions.billingcycle'),
        ),
        migrations.AddField(
            model_name='billingcycle',
            name='stripe_subscription_item_id',
            field=models.CharField(blank=True, max_length=255, null=True),
        ),
        migrations.AddField(
            model_name='billingcycle',
            name='updated_at',
            field=models.DateTimeField(auto_now=True),
        ),
        migrations.AlterField(
            model_name='billingcycle',
            name='credits_allocated',
            field=models.IntegerField(default=0),
        ),
        migrations.AlterField(
            model_name='billingcycle',
            name='credits_remaining',
            field=models.IntegerField(default=0),
        ),
        migrations.AlterField(
            model_name='billingcycle',
            name='credits_used',
            field=models.IntegerField(default=0),
        ),
        migrations.AlterField(
            model_name='billingcycle',
            name='status',
            field=models.CharField(choices=[('open', 'Open'), ('closed', 'Closed'), ('error', 'Error')], default='open', max_length=10),
        ),
    ]
