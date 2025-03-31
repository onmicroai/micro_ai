from django.db import migrations

def add_ids_to_app_json(apps, schema_editor):
    Microapp = apps.get_model('microapps', 'Microapp')
    
    for app in Microapp.objects.all():
        if not app.app_json or 'pages' not in app.app_json:
            continue
            
        # Add IDs to pages
        for page_index, page in enumerate(app.app_json['pages'], start=1):
            page['id'] = page_index
            
            # Add IDs to elements if they exist
            if 'elements' in page:
                for element_index, element in enumerate(page['elements'], start=1):
                    element['id'] = element_index
        
        app.save()

def remove_ids_from_app_json(apps, schema_editor):
    Microapp = apps.get_model('microapps', 'Microapp')
    
    for app in Microapp.objects.all():
        if not app.app_json or 'pages' not in app.app_json:
            continue
            
        # Remove IDs from pages
        for page in app.app_json['pages']:
            if 'id' in page:
                del page['id']
            
            # Remove IDs from elements if they exist
            if 'elements' in page:
                for element in page['elements']:
                    if 'id' in element:
                        del element['id']
        
        app.save()

class Migration(migrations.Migration):

    dependencies = [
        ('microapps', '0039_microapp_hash_id_unique'),
    ]

    operations = [
        migrations.RunPython(add_ids_to_app_json, remove_ids_from_app_json),
    ] 