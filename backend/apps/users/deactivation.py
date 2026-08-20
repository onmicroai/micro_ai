"""
Shared deactivation path so every way a user gets deactivated also revokes
their live API keys — today that's only the self-service profile DELETE
(apps/users/views.py:profile_api), but this exists as a single seam for
whatever else needs to deactivate a user later (see apps/api/permissions.py:
HasUserAPIKey, which is what actually enforces the revocation).
"""

from apps.users.models import CustomUser


def deactivate_user_and_keys(user: CustomUser) -> None:
    user.is_active = False
    user.save(update_fields=["is_active"])

    from apps.api.models import UserAPIKey

    UserAPIKey.objects.filter(user=user, revoked=False).update(revoked=True)
