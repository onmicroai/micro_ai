from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('microapps', '0058_rubricbuild'),
    ]

    operations = [
        migrations.AlterField(
            model_name='run',
            name='session_id',
            field=models.TextField(blank=True, db_index=True),
        ),
        migrations.AddIndex(
            model_name='run',
            index=models.Index(fields=['ma_id', 'session_id'], name='run_ma_session_idx'),
        ),
    ]
