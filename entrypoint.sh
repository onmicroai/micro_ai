#!/bin/sh

# Check if the environment variable DEBUG is set to True
if [ "$DEBUG" = "True" ]; then
    # Start the Django development server with debugpy
    python -Xfrozen_modules=off -m debugpy --wait-for-client --listen 0.0.0.0:5678 manage.py runserver 0.0.0.0:8000 --nothreading
else
    # Start the Django development server normally with auto-reloading
    python manage.py runserver 0.0.0.0:8000
fi