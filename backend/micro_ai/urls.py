"""Micro AI URL Configuration

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/stable/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""

from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.contrib.sitemaps.views import sitemap
from django.urls import path, include, re_path
from django.views.generic import RedirectView
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView, SpectacularRedocView
from apps.web.sitemaps import StaticViewSitemap
from apps.microapps.urls import urlpatterns as microapp_urls
from apps.collection.urls import urlpatterns as collection_urls
from apps.authentication.views import CustomLoginView, CustomLogoutView, CustomLogoutLoadingView
from apps.users.views import get_resized_avatar


sitemaps = {
    "static": StaticViewSitemap(),
}

urlpatterns = [
    path("admin/", admin.site.urls),
    path("admin/doc/", include("django.contrib.admindocs.urls")),
    # redirect Django admin login to main login page
    path("admin/login/", RedirectView.as_view(pattern_name="account_login")),
    path("api/dashboard/", include("apps.dashboard.urls")),
    path("sitemap.xml", sitemap, {"sitemaps": sitemaps}, name="django.contrib.sitemaps.views.sitemap"),
    path("accounts/login/", CustomLoginView.as_view(), name='account_login'),
    # Self-registration happens in Keycloak (realm-export.json:
    # registrationAllowed) now, not here. Redirect rather than delete the
    # name outright — allauth internals reverse() "account_signup" in a few
    # places (e.g. login page's "don't have an account?" link) regardless of
    # whether the view is reachable.
    path("accounts/signup/", RedirectView.as_view(pattern_name="account_login"), name='account_signup'),
    path("accounts/logout/", CustomLogoutView.as_view(), name='account_logout'),
    path("accounts/logout_loading/", CustomLogoutLoadingView.as_view(), name='account_loading_logout'),
    path("accounts/", include("allauth.urls")),
    path("api/users/", include("apps.users.urls")),
    path("api/subscriptions/", include("apps.subscriptions.api_urls")),  # API endpoints
    path("subscriptions/", include("apps.subscriptions.urls")),  # Web views
    path("", include("apps.web.urls")),
    path("api/microapps/", include(microapp_urls)),
    path("api/collection/", include(collection_urls)),
    # auth API
    path("api/auth/", include("apps.authentication.urls")),
    # API docs
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    # Optional UI - you may wish to remove one of these depending on your preference
    path("api/schema/swagger-ui/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
    path("api/schema/redoc/", SpectacularRedocView.as_view(url_name="schema"), name="redoc"),
    path("lti/",  include('apps.lti.urls')),
    # Profile pictures at /media/profile-pictures/<name> (used by avatar_url; production has no static() media serving)
    re_path(r"^media/profile-pictures/(?P<image_name>[^/]+)/?$", get_resized_avatar, name="get_avatar_media"),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

if settings.STRIPE_ENABLED:
    from apps.subscriptions.webhooks import stripe_webhook
    urlpatterns.append(path("stripe/webhook/", stripe_webhook, name="stripe-webhook"))
