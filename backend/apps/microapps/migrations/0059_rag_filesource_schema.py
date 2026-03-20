from django.db import migrations, models
import django.db.models.deletion
from pgvector.django import VectorField


class Migration(migrations.Migration):

    dependencies = [
        ('microapps', '0058_rubricbuild'),
    ]

    operations = [
        migrations.RunSQL("CREATE EXTENSION IF NOT EXISTS vector;", reverse_sql=migrations.RunSQL.noop),
        # 1. Create FileSource
        migrations.CreateModel(
            name='FileSource',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('file_name', models.CharField(max_length=255)),
                ('status', models.CharField(
                    choices=[('pending', 'Pending'), ('processing', 'Processing'), ('ready', 'Ready'), ('failed', 'Failed')],
                    default='pending',
                    max_length=20,
                )),
                ('error', models.TextField(blank=True, null=True)),
                ('chunk_count', models.IntegerField(blank=True, null=True)),
                ('word_count', models.IntegerField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('file_owner', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='owned_sources',
                    to='microapps.microapp',
                )),
            ],
        ),

        # 2. Create AppFileReference
        migrations.CreateModel(
            name='AppFileReference',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('added_at', models.DateTimeField(auto_now_add=True)),
                ('app', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='file_references',
                    to='microapps.microapp',
                )),
                ('file_source', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='app_references',
                    to='microapps.filesource',
                )),
            ],
            options={
                'unique_together': {('app', 'file_source')},
            },
        ),

        # 3. Create DocumentChunk with file_source FK and embedding inline
        migrations.CreateModel(
            name='DocumentChunk',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('content', models.TextField()),
                ('embedding', VectorField(dimensions=1536, null=True, blank=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('file_source', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='chunks',
                    to='microapps.filesource',
                )),
            ],
            options={
                'ordering': ['file_source', 'id'],
                'indexes': [models.Index(fields=['file_source'], name='microapps_d_file_so_idx')],
            },
        ),
    ]
