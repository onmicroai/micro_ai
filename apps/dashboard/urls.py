from django.urls import path

from . import views

app_name = "dashboard"

urlpatterns = [
    path("", views.dashboard, name="dashboard"),
    path("all/", views.dashboard, name="all"),
    path("api/user-signups/", views.UserSignupStatsView.as_view(), name="user_signups_api"),
]
