# Created by Nikita Bragin on 2024-09-25


from django.db import migrations


def populate_type_field(apps, schema_editor):
    Microapp = apps.get_model('microapps', 'Microapp')
    for microapp in Microapp.objects.all():
        app_json = microapp.app_json or {}
        # Get privacySettings from app_json
        privacy_settings = app_json.get('privacySettings')
        if privacy_settings:
            # Populate the type field with privacySettings value
            microapp.type = privacy_settings
        else:
            microapp.type = 'Private'
        microapp.save(update_fields=['type'])

class Migration(migrations.Migration):
    dependencies = [
        ('microapps', '0024_alter_microapp_type'),
    ]

    operations = [
        migrations.RunPython(populate_type_field),
    ]
