from django.db import migrations, models


BACKFILL_CHUNK_INDEX = """
UPDATE microapps_documentchunk AS c
SET chunk_index = numbered.position
FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY file_source_id ORDER BY id) - 1 AS position
    FROM microapps_documentchunk
) AS numbered
WHERE c.id = numbered.id;
"""


class Migration(migrations.Migration):

    dependencies = [
        ('microapps', '0072_rename_microapps_d_file_so_idx_microapps_d_file_so_039d5d_idx_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='filesource',
            name='source_type',
            field=models.CharField(
                choices=[('file', 'File'), ('webpage', 'Web page'), ('website', 'Website'), ('text', 'Text')],
                default='file',
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name='filesource',
            name='url',
            field=models.CharField(blank=True, max_length=2048, null=True),
        ),
        migrations.AddField(
            model_name='filesource',
            name='raw_text',
            field=models.TextField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='filesource',
            name='metadata',
            field=models.JSONField(blank=True, default=dict),
        ),
        migrations.AddField(
            model_name='filesource',
            name='last_fetched_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='documentchunk',
            name='chunk_index',
            field=models.IntegerField(default=0),
        ),
        migrations.AddField(
            model_name='documentchunk',
            name='metadata',
            field=models.JSONField(blank=True, default=dict),
        ),
        migrations.AlterModelOptions(
            name='documentchunk',
            options={'ordering': ['file_source', 'chunk_index', 'id']},
        ),
        migrations.RunSQL(BACKFILL_CHUNK_INDEX, reverse_sql=migrations.RunSQL.noop),
    ]
