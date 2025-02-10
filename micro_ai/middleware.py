# \micro_ai\micro_ai\middleware.py

import os
from django.utils.deprecation import MiddlewareMixin
from datetime import timedelta
from rest_framework_simplejwt.tokens import RefreshToken

class JWTRefreshTokenMiddleware(MiddlewareMixin):
    def process_response(self, request, response):
        # For successful token refresh, the response will contain new tokens
        if request.path == '/api/auth/token/refresh/' and response.status_code == 200:
            is_production = os.getenv('PRODUCTION', 'False') == 'True'
            samesite = 'None' if is_production else 'Lax'
            cookies_domain = os.getenv('COOKIES_DOMAIN', None) if is_production else None
            
            # Get the new refresh token from the response data
            if hasattr(response, 'data') and 'refresh' in response.data:
                response.set_cookie(
                    'refresh_token',
                    response.data['refresh'],
                    max_age=timedelta(days=7).total_seconds(),
                    httponly=True,
                    secure=is_production,
                    samesite=samesite,
                    domain=cookies_domain
                )
            return response

        # For other authenticated requests, set/update the refresh token
        if hasattr(request, 'user') and getattr(request.user, 'is_authenticated', False):
            refresh = RefreshToken.for_user(request.user)
            is_production = os.getenv('PRODUCTION', 'False') == 'True'
            samesite = 'None' if is_production else 'Lax'
            cookies_domain = os.getenv('COOKIES_DOMAIN', None) if is_production else None
            
            response.set_cookie(
                'refresh_token',
                str(refresh),
                max_age=timedelta(days=7).total_seconds(),
                httponly=True,
                secure=is_production,
                samesite=samesite,
                domain=cookies_domain
            )
            
        return response