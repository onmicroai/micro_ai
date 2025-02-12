from django.urls import path, re_path
from .views import lti_launch, lti_login

urlpatterns = [
    path("launch/", lti_launch, name="lti_launch"),
    path("login/", lti_login, name="lti_login"),
]
