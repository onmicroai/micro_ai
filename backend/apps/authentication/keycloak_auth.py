"""
DRF authentication class that validates a Keycloak-issued Bearer token and
resolves it to a CustomUser via keycloak_resolve.resolve_user. The sole
entry in REST_FRAMEWORK["DEFAULT_AUTHENTICATION_CLASSES"] since cutover
(docs/keycloak-migration.md) — simplejwt is fully removed.

Still returns None (not raise) for a token that doesn't even claim to be
from our Keycloak issuer — checked via an unverified peek at the `iss`
claim before attempting real verification — rather than raising outright.
Only a token that *claims* to be ours but fails verification raises.
"""

import logging

import jwt
from django.conf import settings
from django.core.exceptions import SuspiciousOperation
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed

from apps.authentication.keycloak_resolve import resolve_user

logger = logging.getLogger(__name__)

_jwks_client = None


def _get_jwks_client() -> jwt.PyJWKClient:
    global _jwks_client
    if _jwks_client is None:
        # Deliberately KEYCLOAK_JWKS_URL, not KEYCLOAK_ISSUER — the latter is
        # the public URL embedded in the token's `iss` claim (validated
        # separately below) and isn't reachable from inside this container.
        _jwks_client = jwt.PyJWKClient(
            f"{settings.KEYCLOAK_JWKS_URL}/protocol/openid-connect/certs",
            cache_keys=True,
        )
    return _jwks_client


def _extract_bearer(request) -> str | None:
    header = request.META.get("HTTP_AUTHORIZATION", "")
    if not header.startswith("Bearer "):
        return None
    return header[len("Bearer "):].strip()


def _claims_from_our_issuer(raw_token: str) -> bool:
    """
    Unverified peek at `iss` only — used solely to decide whether this
    authenticator should even attempt the token, never to trust its content.
    """
    try:
        unverified = jwt.decode(raw_token, options={"verify_signature": False})
    except jwt.PyJWTError:
        return False
    return unverified.get("iss") == settings.KEYCLOAK_ISSUER


def verify(raw_token: str) -> dict:
    """Validate signature, iss, aud, exp/nbf. Returns the decoded claims."""
    try:
        signing_key = _get_jwks_client().get_signing_key_from_jwt(raw_token)
        return jwt.decode(
            raw_token,
            signing_key.key,
            algorithms=["RS256"],
            audience=settings.KEYCLOAK_AUDIENCE,
            issuer=settings.KEYCLOAK_ISSUER,
            leeway=30,
        )
    except jwt.PyJWTError as exc:
        raise AuthenticationFailed(f"Invalid Keycloak token: {exc}") from exc


class KeycloakAuthentication(BaseAuthentication):
    def authenticate(self, request):
        raw_token = _extract_bearer(request)
        if raw_token is None:
            return None

        # Not even claiming to be from our realm (e.g. a simplejwt token) —
        # decline so the next authenticator in the chain gets a turn.
        if not _claims_from_our_issuer(raw_token):
            return None

        claims = verify(raw_token)
        # resolve_user raises SuspiciousOperation on an unverified/missing
        # email or a cross-linked sub — that's Django's own exception type,
        # which DRF's exception_handler doesn't special-case, so it falls
        # through to Django's core handler and comes back as an HTML 400
        # instead of the JSON error shape the frontend expects everywhere
        # else. AuthenticationFailed is the DRF-native way to say the same
        # thing: this token doesn't authenticate anyone.
        try:
            user = resolve_user(claims)
        except SuspiciousOperation as exc:
            raise AuthenticationFailed(str(exc)) from exc

        # DRF's IsAuthenticated only checks is_authenticated, not is_active
        # (unlike Django's own ModelBackend) — without this, a deactivated
        # user's still-valid Keycloak JWT keeps working on every endpoint
        # that isn't gated by HasUserAPIKey specifically.
        if not user.is_active:
            raise AuthenticationFailed("User inactive or deleted.")

        return user, raw_token

    def authenticate_header(self, request):
        return "Bearer"
