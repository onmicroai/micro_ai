#!/usr/bin/env bash

set -euo pipefail

PORT=${PORT:-8000}
SETTINGS_MODULE="${DJANGO_SETTINGS_MODULE:-micro_ai.settings_production}"

echo "Running Django migrations (${SETTINGS_MODULE})..."
python manage.py migrate --noinput --settings="${SETTINGS_MODULE}"

if [ "${SETTINGS_MODULE}" = "micro_ai.settings_production" ]; then
  echo "Collecting static files..."
  python manage.py collectstatic --noinput --settings="${SETTINGS_MODULE}"
fi

echo "Starting Gunicorn..."
export DJANGO_SETTINGS_MODULE="${SETTINGS_MODULE}"
exec gunicorn --bind "0.0.0.0:${PORT}" --workers 1 --worker-class uvicorn.workers.UvicornWorker --timeout 0 --access-logfile - --error-logfile - micro_ai.asgi:application
