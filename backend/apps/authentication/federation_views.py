"""
The two REST endpoints Keycloak's "User migration using a REST client"
provider calls during lazy password migration (docs/keycloak-migration.md
section 2). Contract is fixed by that provider, not by us — see
https://github.com/daniel-frak/keycloak-user-migration#prerequisites---rest-endpoints-in-the-legacy-system

Network-isolated (internal-only Docker network) and shared-secret protected
(HasFederationSharedSecret) — never exposed through nginx. Not gated by a
deadline: the doc specifies lazy, indefinite migration, so this stays live
until a future decision explicitly retires it.
"""

import logging
from urllib.parse import unquote

from django.db.models import Q
from rest_framework.generics import GenericAPIView
from rest_framework.response import Response
from rest_framework import status

from apps.authentication.federation_auth import HasFederationSharedSecret
from apps.users.models import CustomUser
from apps.utils.throttles import FederationPasswordCheckThrottle

logger = logging.getLogger(__name__)


def _normalize_identifier(username_or_email: str) -> str:
    # The provider URL-encodes the path segment (john%40curricu.me). Django
    # usually unquotes it already; unquote is idempotent for a decoded email
    # and recovers the address if a proxy left it encoded.
    return unquote(username_or_email)


def _find_user(username_or_email: str):
    # Both username and email must resolve here (the plugin's "forgotten
    # password" flow depends on the email path working pre-migration).
    # Emails are not guaranteed unique in this system yet (same known gap as
    # apps/subscriptions/webhooks.py) — .first() is best effort, matching
    # existing convention elsewhere in this codebase.
    identifier = _normalize_identifier(username_or_email)
    return CustomUser.objects.filter(
        Q(username__iexact=identifier) | Q(email__iexact=identifier)
    ).first()


class FederationView(GenericAPIView):
    """
    GET /<username_or_email> — profile lookup for migration.
    POST /<username_or_email> {"password": "..."} — credential check.

    Same path for both methods per the provider's contract — it always
    calls GET then POST against the identical URI.
    """

    # Must NOT inherit the global DEFAULT_AUTHENTICATION_CLASSES: the shared
    # secret arrives as "Authorization: Bearer <secret>", which
    # KeycloakAuthentication would otherwise try to parse as a JWT. This
    # endpoint's auth is the shared secret alone, checked entirely in
    # permission_classes below.
    authentication_classes = []
    permission_classes = [HasFederationSharedSecret]

    def get(self, request, username_or_email: str):
        identifier = _normalize_identifier(username_or_email)
        user = _find_user(identifier)
        if user is None:
            # Any non-200 means "not found" to the calling provider.
            return Response(status=status.HTTP_404_NOT_FOUND)

        # The provider's findByUsername() / findByEmail() discard a 200
        # unless the returned username / email equals the searched
        # identifier (case-insensitive). Existing Django users often have
        # username != email (ACCOUNT_USERNAME_REQUIRED = False) while
        # Keycloak's realm uses email-as-username, so echo the identifier
        # that actually matched rather than Django's username field.
        return Response(
            {
                # "id" deliberately omitted — Keycloak generates its own sub.
                "username": identifier,
                "email": user.email,
                "firstName": user.first_name,
                "lastName": user.last_name,
                "enabled": user.is_active,
                "emailVerified": user.has_verified_email,
                "attributes": {"django_user_id": [str(user.pk)]},
            }
        )

    def get_throttles(self):
        # Only the password check (POST) needs throttling — GET is a plain
        # profile lookup with no credential-guessing surface.
        # Stashed on self so the exact instance DRF's automatic
        # check_throttles() (in initial(), before post() runs) used is the
        # same one record_failed_attempt() writes to below — a freshly
        # constructed instance wouldn't have self.key/history/now set.
        # Same pattern as AddAdminThrottle in apps/microapps/views/user_views.py.
        if self.request.method == "POST":
            self._password_throttle = FederationPasswordCheckThrottle()
            return [self._password_throttle]
        return []

    def post(self, request, username_or_email: str):
        password = request.data.get("password")
        user = _find_user(username_or_email)

        if user is None or not password or not user.check_password(password):
            if hasattr(self, "_password_throttle"):
                self._password_throttle.record_failed_attempt()
            logger.info("Federation password check failed for %r", username_or_email)
            return Response(status=status.HTTP_400_BAD_REQUEST)

        return Response(status=status.HTTP_200_OK)
