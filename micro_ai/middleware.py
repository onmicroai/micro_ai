# \micro_ai\micro_ai\middleware.py

import os
from django.utils.deprecation import MiddlewareMixin
from django.conf import settings
from datetime import timedelta
from rest_framework_simplejwt.tokens import RefreshToken

class JWTRefreshTokenMiddleware(MiddlewareMixin):
    def process_response(self, request, response):
        if hasattr(request, 'user') and request.user.is_authenticated:
            refresh = RefreshToken.for_user(request.user)
            response.set_cookie(
                'refresh_token',
                str(refresh),
                max_age=timedelta(days=7).total_seconds(),
                httponly=True,
                secure=os.getenv('PRODUCTION', 'False') == 'True',  
                samesite='Lax'
            )
        return response