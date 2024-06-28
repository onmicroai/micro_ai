from dj_rest_auth.jwt_auth import get_refresh_view
from dj_rest_auth.registration.views import RegisterView
from dj_rest_auth.views import LogoutView, UserDetailsView, PasswordChangeView
from django.urls import path
from rest_framework_simplejwt.views import TokenVerifyView

from . import api_views

app_name = "authentication"

urlpatterns = [
    path("register/", RegisterView.as_view(), name="rest_register"),
    path("login/", api_views.LoginViewWith2fa.as_view(), name="rest_login"),
    path("verify-otp/", api_views.VerifyOTPView.as_view(), name="verify_otp"),
    path("logout/", LogoutView.as_view(), name="rest_logout"),
    path("user/", UserDetailsView.as_view(), name="rest_user_details"),
    path("password/change/", PasswordChangeView.as_view(), name="change_password"),
    path("token/verify/", TokenVerifyView.as_view(), name="token_verify"),
    path("token/refresh/", get_refresh_view().as_view(), name="token_refresh"),
]
