# micro_ai\apps\authentication\urls.py

from django.urls import path
from . import federation_views
from . import views

app_name = "authentication"

urlpatterns = [
    # REST federation — Keycloak-only (network-isolated + shared-secret,
    # never proxied through nginx). GET (profile lookup) and POST (password
    # check) share one path per the provider's contract. See federation_views.py.
    path(
        "federation/<str:username_or_email>",
        federation_views.FederationView.as_view(),
        name="federation",
    ),
    # Profile data beyond the token's own claims (subscription, plan) — kept
    # post-cutover, consumed by KeycloakAuthContext's Django-profile bridge.
    path("user/", views.CustomUserDetailsView.as_view(), name="rest_user_details"),
]
