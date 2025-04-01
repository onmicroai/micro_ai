# \micro_ai\micro_ai\middleware.py

import os
from django.utils.deprecation import MiddlewareMixin
from rest_framework_simplejwt.tokens import RefreshToken
from django.conf import settings

class JWTRefreshTokenMiddleware(MiddlewareMixin):
    def process_response(self, request, response):
        # For successful token refresh, the response will contain new tokens
        if request.path == '/api/auth/token/refresh/' and response.status_code == 200:
            is_production = os.getenv('PRODUCTION', 'False') == 'True'
            samesite = 'None' if is_production else 'Lax'
            # Get the new refresh token from the response data
            if hasattr(response, 'data') and 'refresh' in response.data:
                response.set_cookie(
                    'refresh_token',
                    response.data['refresh'],
                    max_age=settings.SIMPLE_JWT['REFRESH_TOKEN_LIFETIME'].total_seconds(),
                    httponly=True,
                    secure=is_production,
                    samesite=samesite,
                )
            return response

        # For other authenticated requests, set/update the refresh token
        if request.path == '/api/auth/login/' and response.status_code == 200:
            if hasattr(request, 'user') and getattr(request.user, 'is_authenticated', False):
                refresh = RefreshToken.for_user(request.user)
                is_production = os.getenv('PRODUCTION', 'False') == 'True'
                samesite = 'None' if is_production else 'Lax'
                
                response.set_cookie(
                    'refresh_token',
                    str(refresh),
                    max_age=settings.SIMPLE_JWT['REFRESH_TOKEN_LIFETIME'].total_seconds(),
                    httponly=True,
                    secure=is_production,
                    samesite=samesite,
                )
        return response