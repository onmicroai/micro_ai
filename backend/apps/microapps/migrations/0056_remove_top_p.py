# Generated manually to remove top_p fields

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('microapps', '0055_remove_frequency_presence_penalty'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='microapp',
            name='top_p',
        ),
        migrations.RemoveField(
            model_name='run',
            name='top_p',
        ),
    ]
