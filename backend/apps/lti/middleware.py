from django.utils.deprecation import MiddlewareMixin


class LTIFrameMiddleware(MiddlewareMixin):
    """
    Middleware to allow API requests from LTI embedded iframes.
    Detects LTI context and modifies frame security headers accordingly.
    """
    
    def process_response(self, request, response):
        # Only process API and LTI requests
        if not (request.path.startswith('/api/') or request.path.startswith('/lti/')):
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
        2. 'lti1p3-launch-' in the URL path (for LTI API endpoints)
        3. '/app/embed/' or '/lti/launch' in the HTTP_REFERER
        """
        # Check for 'lid' parameter in GET or POST
        if request.GET.get('lid') or request.POST.get('lid'):
            return True
        
        # Check for LTI launch ID in the URL path (e.g., /lti/api/score/lti1p3-launch-xxx/...)
        if 'lti1p3-launch-' in request.path:
            return True
        
        # Check HTTP_REFERER for LTI-related paths
        referer = request.META.get('HTTP_REFERER', '')
        if '/app/embed/' in referer or '/lti/launch' in referer:
            return True
        
        return False

