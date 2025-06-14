# Generated by Django 5.0.6 on 2024-07-08 12:04

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('microapps', '0001_initial'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='Collection',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=100)),
            ],
        ),
        migrations.CreateModel(
            name='CollectionMaJoin',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('collection_id', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='collection.collection')),
                ('ma_id', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='microapps.microapps')),
            ],
        ),
        migrations.CreateModel(
            name='CollectionUserJoin',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('role', models.CharField(choices=[('view', 'View'), ('admin', 'Admin')], default='view', max_length=10)),
                ('collection_id', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='collection.collection')),
                ('user_id', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to=settings.AUTH_USER_MODEL)),
            ],
        ),
    ]
