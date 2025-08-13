#!/usr/bin/env python
"""
Development server script using uvicorn with hot reload.
Run this instead of manage.py runserver for ASGI support.

Usage:
    python run_dev.py
    
Or make it executable:
    chmod +x run_dev.py
    ./run_dev.py
"""

import os
import uvicorn

if __name__ == "__main__":
    # Set Django settings module
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "micro_ai.settings")
    
    # Default development settings
    host = os.getenv("HOST", "127.0.0.1")
    port = int(os.getenv("PORT", "8000"))
    
    print(f"Starting ASGI development server on {host}:{port}")
    print("Hot reload is enabled - the server will restart on code changes")
    print("Press CTRL+C to stop")
    
    # Run uvicorn with hot reload
    uvicorn.run(
        "micro_ai.asgi:application",
        host=host,
        port=port,
        reload=True,
        reload_dirs=["apps", "micro_ai"],  # Watch these directories for changes
        log_level="info",
        access_log=True,
        use_colors=True,
        # Disable buffering for SSE/streaming responses
        server_header=False,
        date_header=False,
    )
