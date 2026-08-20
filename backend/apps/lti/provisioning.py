"""
JIT-provisions a CustomUser from an LTI 1.3 launch's email claim, for the
deep-link picker (apps/lti/views.py:deep_link_picker) — implements the
migration doc's open question 1 ("should an LTI launch provision an
account? — yes").

Deliberately does NOT reuse KeycloakAuthentication's resolve_user(): that
function's keycloak_sub/django_user_id branches don't apply to an LTI
launch (its `sub` is the LMS's own identifier, not a Keycloak UUID), so
this only does the email-lookup-or-create step, via the same jit_create()
used for real Keycloak JIT provisioning (shared username disambiguation +
wallet-funding signal), just without a Keycloak sub attached — see
jit_create()'s docstring for why that matters.

Trust-path judgment call: an LTI launch's email isn't OIDC "email_verified"
in the way a Keycloak token's is, but pylti1p3 has already cryptographically
validated the launch against the LMS's own signing keys before this code
ever runs (see lti_request / DjangoMessageLaunch in apps/lti/views.py) — that
signature chain is treated as sufficient grounds to trust the email it
asserts. The alternative (routing first-time LTI users through an actual
Keycloak account creation before granting access) is more architecturally
pure but adds a redirect hop to every first-time LTI launch; this was an
explicit, flagged tradeoff, not an oversight.
"""

from apps.authentication.keycloak_resolve import jit_create
from apps.users.models import CustomUser


def find_or_provision_user(email: str, first_name: str = "", last_name: str = "") -> CustomUser:
    email = (email or "").strip().lower()
    user = CustomUser.objects.filter(email__iexact=email).first()
    if user:
        return user

    return jit_create(
        {
            "email": email,
            "email_verified": True,
            "given_name": first_name,
            "family_name": last_name,
        }
    )
