from django.db import migrations
import uuid

def generate_hash_id(apps, schema_editor):
    # Get historical version of the model
    Microapp = apps.get_model('microapps', 'Microapp')
    
    # Generate hash_id for all existing records that don't have one
    for app in Microapp.objects.filter(hash_id=''):
        app.hash_id = str(uuid.uuid4())[:8]
        app.save()

def reverse_hash_id(apps, schema_editor):
    # Get historical version of the model
    Microapp = apps.get_model('microapps', 'Microapp')
    
    # Clear all hash_ids
    Microapp.objects.all().update(hash_id='')

class Migration(migrations.Migration):

    dependencies = [
        ('microapps', '0037_microapp_hash_id'),
    ]

    operations = [
        migrations.RunPython(generate_hash_id, reverse_hash_id),
    ] 