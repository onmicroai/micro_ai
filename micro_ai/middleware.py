# \micro_ai\micro_ai\middleware.py

import os
from django.utils.deprecation import MiddlewareMixin
from datetime import timedelta
from rest_framework_simplejwt.tokens import RefreshToken

class JWTRefreshTokenMiddleware(MiddlewareMixin):
    def process_response(self, request, response):
        if hasattr(request, 'user') and request.user.is_authenticated:
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