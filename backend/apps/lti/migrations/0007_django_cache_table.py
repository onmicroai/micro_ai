# LTI launch state uses Django's DatabaseCache (see settings.CACHES). That backend
# requires a DB table; createcachetable is not run by migrate, so we create it here.

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('lti', '0006_make_microapp_nullable'),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
                CREATE TABLE IF NOT EXISTS "micro_ai_django_cache" (
                    "cache_key" varchar(255) NOT NULL PRIMARY KEY,
                    "value" text NOT NULL,
                    "expires" timestamptz NOT NULL
                );
                CREATE INDEX IF NOT EXISTS "micro_ai_django_cache_expires"
                    ON "micro_ai_django_cache" ("expires");
            """,
            reverse_sql='DROP TABLE IF EXISTS "micro_ai_django_cache" CASCADE;',
        ),
    ]
