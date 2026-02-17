import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('lti', '0005_remove_redirect_url'),
        ('microapps', '0001_initial'),
    ]

    operations = [
        migrations.AlterField(
            model_name='lticonfig',
            name='microapp',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='lti_configs',
                to='microapps.microapp',
            ),
        ),
    ]
