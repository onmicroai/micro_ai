from django.db import migrations, models
import django.db.models.deletion

def remove_null_microapps(apps, schema_editor):
    LTIConfig = apps.get_model('lti', 'LTIConfig')
    # Delete any LTIConfig records that have null microapp
    LTIConfig.objects.filter(microapp__isnull=True).delete()

class Migration(migrations.Migration):

    dependencies = [
        ('lti', '0003_lticonfig_microapp'),
    ]

    operations = [
        # First run the function to remove null microapps
        migrations.RunPython(remove_null_microapps),
        # Then alter the field to be non-nullable
        migrations.AlterField(
            model_name='lticonfig',
            name='microapp',
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name='lti_configs',
                to='microapps.microapp'
            ),
        ),
    ] 