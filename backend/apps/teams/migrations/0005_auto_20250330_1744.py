from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ('teams', '0004_alter_team_customer_alter_team_subscription'),  # Update this to your latest migration
    ]

    operations = [
        migrations.RemoveField(
            model_name='flag',
            name='teams',
        ),
        migrations.RemoveField(
            model_name='invitation',
            name='accepted_by',
        ),
        migrations.RemoveField(
            model_name='invitation',
            name='invited_by',
        ),
        migrations.RemoveField(
            model_name='invitation',
            name='team',
        ),
        migrations.RemoveField(
            model_name='membership',
            name='team',
        ),
        migrations.RemoveField(
            model_name='membership',
            name='user',
        ),
        migrations.RemoveField(
            model_name='team',
            name='customer',
        ),
        migrations.RemoveField(
            model_name='team',
            name='members',
        ),
        migrations.RemoveField(
            model_name='team',
            name='subscription',
        ),
        migrations.DeleteModel(
            name='Flag',
        ),
        migrations.DeleteModel(
            name='Invitation',
        ),
        migrations.DeleteModel(
            name='Membership',
        ),
        migrations.DeleteModel(
            name='Team',
        ),
    ]