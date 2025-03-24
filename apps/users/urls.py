from django.urls import path
from . import views


app_name = "users"
urlpatterns = [
    # API endpoints
    path("profile/", views.profile_api, name="user_profile_api"),
    
    # Web views
    path("profile/upload-image/", views.upload_profile_image, name="upload_profile_image"),
]
