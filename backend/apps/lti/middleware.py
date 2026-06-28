from urllib.parse import urlparse

from django.utils.deprecation import MiddlewareMixin


# LMS origins that are always allowed to embed LTI content. Canvas is matched
# with a wildcard since institutions are hosted on per-tenant subdomains
# (e.g. school.instructure.com), and beta/test hosts use *.instructure.com too.
STATIC_FRAME_ANCESTORS = [
    "'self'",
    "https://*.instructure.com",
    "https://curricu.me",
    "https://sumac.curricu.me",
    "https://canvas.curricu.me",
]


class LTIFrameMiddleware(MiddlewareMixin):
    """
    Middleware to allow API requests from LTI embedded iframes.
    Detects LTI context and modifies frame security headers accordingly.
    """
    
    def process_response(self, request, response):
        # LTI tool endpoints are always loaded inside an LMS iframe.
        # API routes only get relaxed frame headers when the request carries
        # LTI context (e.g. lid on the embed page calling /lti/api/score/...).
        is_lti_path = request.path.startswith('/lti/')
        is_lti_context = is_lti_path or (
            request.path.startswith('/api/') and self._is_lti_context(request)
        )

        if not is_lti_context:
            return response

        # Remove X-Frame-Options to allow iframe embedding
        if 'X-Frame-Options' in response:
            del response['X-Frame-Options']

        # Set CSP to allow embedding from LTI consumer domains
        ancestors = ' '.join(self._frame_ancestors())
        response['Content-Security-Policy'] = f"frame-ancestors {ancestors}"

        return response

    def _frame_ancestors(self):
        """
        Build the list of allowed frame-ancestors: the static LMS origins plus
        the origin of every registered LTI platform (issuer), so that any
        configured consumer (e.g. a Canvas instance) can embed the tool.
        """
        ancestors = list(STATIC_FRAME_ANCESTORS)
        try:
            from .models import LTIConfig
            issuers = LTIConfig.objects.values_list('issuer', flat=True).distinct()
            for issuer in issuers:
                origin = self._issuer_origin(issuer)
                if origin and origin not in ancestors:
                    ancestors.append(origin)
        except Exception:
            # Never let header construction break the response.
            pass
        return ancestors

    @staticmethod
    def _issuer_origin(issuer):
        if not issuer:
            return None
        parsed = urlparse(issuer)
        if parsed.scheme and parsed.netloc:
            return f"{parsed.scheme}://{parsed.netloc}"
        return None
    
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

