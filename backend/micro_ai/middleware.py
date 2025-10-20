# \micro_ai\micro_ai\middleware.py

import os
from django.utils.deprecation import MiddlewareMixin
from rest_framework_simplejwt.tokens import RefreshToken
from django.conf import settings


class LTIFrameMiddleware(MiddlewareMixin):
    """
    Middleware to allow API requests from LTI embedded iframes.
    Detects LTI context and modifies frame security headers accordingly.
    """
    
    def process_response(self, request, response):
        # Only process API requests
        if not request.path.startswith('/api/'):
            return response
        
        # Check if this is an LTI context
        is_lti_context = self._is_lti_context(request)
        
        if is_lti_context:
            # Remove X-Frame-Options to allow iframe embedding
            if 'X-Frame-Options' in response:
                del response['X-Frame-Options']
            
            # Set CSP to allow embedding from LTI consumer domains
            response['Content-Security-Policy'] = (
                "frame-ancestors 'self' https://curricu.me https://sumac.curricu.me"
            )
        
        return response
    
    def _is_lti_context(self, request):
        """
        Determines if the request is in an LTI context.
        Checks for:
        1. 'lid' parameter in GET or POST data
        2. '/app/embed/' or '/lti/launch' in the HTTP_REFERER
        """
        # Check for 'lid' parameter in GET or POST
        if request.GET.get('lid') or request.POST.get('lid'):
            return True
        
        # Check HTTP_REFERER for LTI-related paths
        referer = request.META.get('HTTP_REFERER', '')
        if '/app/embed/' in referer or '/lti/launch' in referer:
            return True
        
        return False


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