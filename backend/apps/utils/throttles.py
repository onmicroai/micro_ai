from rest_framework.throttling import UserRateThrottle


class AddAdminThrottle(UserRateThrottle):
    """Rate limit for the add-admin-by-email endpoint to prevent user enumeration abuse."""
    scope = 'add_admin'
