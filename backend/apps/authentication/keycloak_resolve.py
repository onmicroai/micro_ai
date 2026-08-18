"""
Resolves a validated Keycloak ID/access token's claims to a CustomUser row.

JIT (just-in-time) provisioning only — no webhooks. The token Keycloak issued
*is* the sync event; see docs/keycloak-migration.md section 2.
"""

import logging

from django.contrib.auth import get_user_model
from django.core.exceptions import SuspiciousOperation
from django.db import IntegrityError

logger = logging.getLogger(__name__)


def resolve_user(claims: dict):
    """
    Resolve Keycloak token claims to a CustomUser, provisioning one if needed.

    Three lookups, in order:
      1. keycloak_sub — already linked, steady state.
      2. django_user_id — migrated user's first login after federation.
      3. verified email — the only place email is ever a matcher.

    Raises SuspiciousOperation if the token asserts an unverified/missing
    email at the fallback step, or if it claims a `sub` already linked to a
    different Django row.
    """
    CustomUser = get_user_model()
    sub = claims["sub"]

    user = CustomUser.objects.filter(keycloak_sub=sub).first()
    if user:
        return user

    user = None
    django_user_id = claims.get("django_user_id")
    if django_user_id:
        user = CustomUser.objects.filter(pk=django_user_id).first()

    if not user:
        email = (claims.get("email") or "").strip().lower()
        if not email or not claims.get("email_verified"):
            raise SuspiciousOperation("Keycloak token asserted no verified email")
        user = CustomUser.objects.filter(email__iexact=email).first()

    if user:
        return _link_user(user, sub)

    return jit_create(claims)


def _link_user(user, sub: str):
    # Callers only reach here on a lookup MISS against keycloak_sub=sub, so
    # user.keycloak_sub is either None (normal case) or some other value
    # (cross-link attempt) — never already equal to sub.
    if user.keycloak_sub:
        raise SuspiciousOperation(
            "Django user row already linked to a different Keycloak user"
        )
    try:
        user.keycloak_sub = sub
        user.save(update_fields=["keycloak_sub"])
    except IntegrityError:
        # Lost a race with a parallel request linking the same sub —
        # the unique constraint on keycloak_sub is the arbiter. Re-read.
        user.refresh_from_db()
        if user.keycloak_sub != sub:
            raise SuspiciousOperation(
                "Django user row already linked to a different Keycloak user"
            )
    return user


def jit_create(claims: dict):
    """
    Create a new CustomUser from a Keycloak token that matched none of the
    three resolve_user lookups. Fires the same user_signed_up signal the
    legacy registration flow fires, so wallet funding / admin-notify /
    avatar-fetch all happen from one place (apps/users/signals.py).
    """
    from allauth.account.signals import user_signed_up

    CustomUser = get_user_model()
    email = (claims.get("email") or "").strip().lower()
    if not email or not claims.get("email_verified"):
        raise SuspiciousOperation("Keycloak token asserted no verified email")

    sub = claims["sub"]
    username = _unique_username_for(email)

    try:
        user = CustomUser.objects.create(
            username=username,
            email=email,
            first_name=claims.get("given_name", "") or "",
            last_name=claims.get("family_name", "") or "",
            keycloak_sub=sub,
        )
    except IntegrityError:
        # Lost a race with a parallel request creating the same user —
        # the unique constraint on keycloak_sub is the arbiter. Re-read.
        existing = CustomUser.objects.filter(keycloak_sub=sub).first()
        if existing:
            return existing
        raise

    user.set_unusable_password()
    user.save(update_fields=["password"])

    _mark_email_verified(user, email)

    user_signed_up.send(sender=user.__class__, request=None, user=user)

    return user


def _unique_username_for(email: str) -> str:
    CustomUser = get_user_model()
    base = email.split("@", 1)[0] or "user"
    username = base
    suffix = 0
    while CustomUser.objects.filter(username__iexact=username).exists():
        suffix += 1
        username = f"{base}{suffix}"
    return username


def _mark_email_verified(user, email: str):
    from allauth.account.models import EmailAddress

    # email is already lowercased by the caller — plain equality is safe and
    # avoids passing an __iexact lookup into update_or_create's create() step.
    EmailAddress.objects.update_or_create(
        user=user,
        email=email,
        defaults={"verified": True, "primary": True},
    )
