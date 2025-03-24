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
from django.urls import path, include
from django.views.generic import RedirectView
from apps.subscriptions.webhooks import stripe_webhook
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView, SpectacularRedocView
from apps.teams.urls import team_urlpatterns as single_team_urls
from apps.subscriptions.urls import team_urlpatterns as subscriptions_team_urls
from apps.utils.sitemaps import StaticViewSitemap
from apps.microapps.urls import urlpatterns as microapp_urls
from apps.collection.urls import urlpatterns as collection_urls
from apps.authentication.views import CustomLoginView, CustomLogoutView, CustomSignupView, CustomLogoutLoadingView


sitemaps = {
    "static": StaticViewSitemap(),
}

# urls that are unique to using a team should go here
team_urlpatterns = [
    path("subscription/", include(subscriptions_team_urls)),
    path("team/", include(single_team_urls)),
]

urlpatterns = [
    path("admin/", admin.site.urls),
    path("admin/doc/", include("django.contrib.admindocs.urls")),
    # redirect Django admin login to main login page
    path("admin/login/", RedirectView.as_view(pattern_name="account_login")),
    path("sitemap.xml", sitemap, {"sitemaps": sitemaps}, name="django.contrib.sitemaps.views.sitemap"),
    path("a/<slug:team_slug>/", include(team_urlpatterns)),
    path("api/users/", include("apps.users.urls")),
    path("api/subscriptions/", include("apps.subscriptions.api_urls")),  # API endpoints
    path("subscriptions/", include("apps.subscriptions.urls")),  # Web views
    path("teams/", include("apps.teams.urls")),
    path("celery-progress/", include("celery_progress.urls")),
    # cutom API's
    path("api/microapps/", include(microapp_urls)),
    path("api/collection/", include(collection_urls)),
    # auth API
    path("api/auth/", include("apps.authentication.urls")),
    # API docs
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    # Optional UI - you may wish to remove one of these depending on your preference
    path("api/schema/swagger-ui/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
    path("api/schema/redoc/", SpectacularRedocView.as_view(url_name="schema"), name="redoc"),
    # url - for stripe webhook
    path("stripe/webhook/", stripe_webhook, name="stripe-webhook"),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
