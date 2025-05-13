from django.db import migrations

class Migration(migrations.Migration):

    dependencies = [
        ('lti', '0004_remove_null_microapp'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='lticonfig',
            name='redirect_url',
        ),
    ] 