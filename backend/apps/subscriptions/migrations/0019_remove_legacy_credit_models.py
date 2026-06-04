# Generated manually for Phase 6 of the subscriptions/credits migration.

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("subscriptions", "0018_backfill_credit_wallets"),
    ]

    operations = [
        migrations.DeleteModel(
            name="UsageEvent",
        ),
        migrations.DeleteModel(
            name="BillingCycle",
        ),
        migrations.DeleteModel(
            name="TopUpToSubscription",
        ),
    ]
