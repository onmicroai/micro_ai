#!/bin/bash

set -o errexit
set -o pipefail
set -o nounset

PORT=${PORT:-8000}

echo "Running Django migrations..."
python manage.py migrate --noinput --settings=micro_ai.settings_production

echo "Collecting static files..."
python manage.py collectstatic --noinput --settings=micro_ai.settings_production

echo "Starting Gunicorn..."
export DJANGO_SETTINGS_MODULE=micro_ai.settings_production
exec gunicorn --bind 0.0.0.0:$PORT --workers 1 --worker-class uvicorn.workers.UvicornWorker --timeout 0 --access-logfile - --error-logfile - micro_ai.asgi:application
