# micro_ai\apps\authentication\urls.py

from dj_rest_auth.jwt_auth import get_refresh_view
from dj_rest_auth.views import UserDetailsView, PasswordChangeView
from django.urls import path, re_path
from rest_framework_simplejwt.views import TokenVerifyView
from . import api_views
from . import views

app_name = "authentication"

urlpatterns = [
    path("register/", api_views.CustomRegisterView.as_view(), name="rest_register"),
    path("login/", api_views.LoginViewWith2fa.as_view(), name="rest_login"),
    path("verify-otp/", api_views.VerifyOTPView.as_view(), name="verify_otp"),
    path("verify-email/", api_views.EmailVerificationView.as_view(), name="verify_email"),
    path("logout/", api_views.APICustomLogoutView.as_view(), name="rest_logout"),
    path("user/", views.CustomUserDetailsView.as_view(), name="rest_user_details"),
    path("password/change/", PasswordChangeView.as_view(), name="change_password"),
    path("password/reset/", views.CustomPasswordResetView.as_view(), name="password_reset"),
    re_path(
        r"^password/reset/confirm/(?P<uidb64>[0-9A-Za-z_\-]+)/(?P<token>[0-9A-Za-z]{1,13}-[0-9A-Za-z]{1,32})/$",
        views.CustomPasswordResetConfirmView.as_view(),
        name="password_reset_confirm",
    ),
    path("token/verify/", TokenVerifyView.as_view(), name="token_verify"),
    path("token/refresh/", get_refresh_view().as_view(), name="token_refresh"),
]
