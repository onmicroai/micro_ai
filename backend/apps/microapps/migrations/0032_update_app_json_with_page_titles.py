from django.db import migrations
import re

def extract_number(text):
    match = re.search(r'\d+$', text)
    return int(match.group()) if match else 0

def get_biggest_page_number(pages):
    max_page_number = 0
    for page in pages:
        page_num = extract_number(page.get('name', ''))
        max_page_number = max(max_page_number, page_num)
    return max_page_number if max_page_number > 0 else 1

def update_page_titles(apps, schema_editor):
    Microapp = apps.get_model('microapps', 'Microapp')
    
    for microapp in Microapp.objects.all():
        if microapp.app_json:
            app_json = microapp.app_json
            
            if 'pages' in app_json:
                # Get the biggest page number
                biggest_page_number = get_biggest_page_number(app_json['pages'])
                
                # Assign unique numbers to pages without titles
                for page in app_json['pages']:
                    if not page.get('title'):
                        page_num = extract_number(page.get('name', ''))
                        if page_num == 0:
                            biggest_page_number += 1
                            page['title'] = f"Phase {biggest_page_number}"
                        else:
                            page['title'] = f"Phase {page_num}"
            
            microapp.app_json = app_json
            microapp.save()

class Migration(migrations.Migration):

    dependencies = [
        ('microapps', '0031_alter_run_minimum_score_alter_run_no_submission_and_more'),
    ]

    operations = [
        migrations.RunPython(update_page_titles),
    ]