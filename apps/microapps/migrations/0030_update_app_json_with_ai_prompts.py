from django.db import migrations
import re
import json

def extract_number(text):
    match = re.search(r'\d+$', text)
    return int(match.group()) if match else 0

def update_app_json(apps, schema_editor):
    Microapp = apps.get_model('microapps', 'Microapp')
    
    for microapp in Microapp.objects.all():
        if microapp.app_json:
            app_json = microapp.app_json
            
            if 'pages' in app_json:
                max_ai_prompt_number = 0
                
                for page in app_json['pages']:
                    if 'elements' in page:
                        ai_prompt_exists = False
                        for element in page['elements']:
                            if element['type'] == 'ai-prompt':
                                ai_prompt_exists = True
                                name_number = extract_number(element.get('name', ''))
                                title_number = extract_number(element.get('title', ''))
                                prompt_number = max(name_number, title_number)
                                max_ai_prompt_number = max(max_ai_prompt_number, prompt_number)
                        
                        if not ai_prompt_exists:
                            new_ai_prompt_number = max_ai_prompt_number + 1
                            new_ai_prompt = {
                                "name": f"AI Prompt {new_ai_prompt_number}",
                                "type": "ai-prompt",
                                "title": f"AI Prompt {new_ai_prompt_number}"
                            }
                            page['elements'].insert(0, new_ai_prompt)
                            max_ai_prompt_number = new_ai_prompt_number
            
            microapp.app_json = app_json
            microapp.save()

class Migration(migrations.Migration):

    dependencies = [
        ('microapps', '0029_alter_run_minimum_score_alter_run_no_submission_and_more'), 
    ]

    operations = [
        migrations.RunPython(update_app_json),
    ]