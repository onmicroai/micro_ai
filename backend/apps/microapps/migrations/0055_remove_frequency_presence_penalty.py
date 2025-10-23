# Generated manually to remove frequency_penalty and presence_penalty fields

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('microapps', '0054_run_litellm_response_id'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='microapp',
            name='frequency_penalty',
        ),
        migrations.RemoveField(
            model_name='microapp',
            name='presence_penalty',
        ),
        migrations.RemoveField(
            model_name='run',
            name='frequency_penalty',
        ),
        migrations.RemoveField(
            model_name='run',
            name='presence_penalty',
        ),
    ]
