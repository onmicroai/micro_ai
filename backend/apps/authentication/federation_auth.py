"""
Shared-secret guard for the REST federation endpoints (federation_views.py).

These endpoints are called only by Keycloak's "User migration using a REST
client" provider during the lazy password-migration window
(docs/keycloak-migration.md section 2). They must never be reachable from
the public internet — network isolation is the primary control (see the
internal-only Docker network in docker-compose*.yml) and this shared secret
is defense-in-depth on top of that, matching the provider's built-in Bearer
token auth option (ConfigurationProperties.API_TOKEN_ENABLED upstream).
"""

import hmac

from django.conf import settings
from rest_framework.permissions import BasePermission


class HasFederationSharedSecret(BasePermission):
    def has_permission(self, request, view) -> bool:
        header = request.META.get("HTTP_AUTHORIZATION", "")
        if not header.startswith("Bearer "):
            return False
        token = header[len("Bearer "):].strip()
        secret = settings.KEYCLOAK_FEDERATION_SHARED_SECRET
        if not secret:
            return False
        return hmac.compare_digest(token, secret)
