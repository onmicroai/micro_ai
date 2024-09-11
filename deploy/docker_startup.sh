#!/bin/bash

set -o errexit  # Exit immediately if a command exits with a non-zero status.
set -o pipefail # Prevent errors in a pipeline from being masked.
set -o nounset  # Treat unset variables as an error.

PORT=${PORT:-8000}

# Run database migrations
echo "Running Django migrations..."
python manage.py migrate --noinput --settings=micro_ai.settings_production
python manage.py migrate django_celery_beat

# Collect static files
echo "Collecting static files..."
python manage.py collectstatic --noinput --settings=micro_ai.settings_production

# Start Gunicorn server
echo "Starting Gunicorn..."
exec gunicorn --bind 0.0.0.0:$PORT --workers 1 --threads 8 --timeout 0 micro_ai.wsgi:application