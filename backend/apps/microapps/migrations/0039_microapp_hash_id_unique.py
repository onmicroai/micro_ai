from django.db import migrations, models

class Migration(migrations.Migration):

    dependencies = [
        ('microapps', '0038_populate_hash_id'),
    ]

    operations = [
        migrations.AlterField(
            model_name='microapp',
            name='hash_id',
            field=models.CharField(blank=True, max_length=50, unique=True),
        ),
    ] 