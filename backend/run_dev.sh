#!/bin/bash
# Development server with ASGI and hot reload

echo "Starting ASGI development server with hot reload..."
echo "Make sure you have activated your virtual environment and installed requirements:"
echo "  pip install -r requirements/dev-requirements.txt"
echo ""

# Run migrations first (optional, comment out if not needed)
echo "Running migrations..."
python manage.py migrate

# Start the ASGI development server
python run_dev.py
