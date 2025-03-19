from django.urls import path
from . import views


app_name = "users"
urlpatterns = [
    # API endpoints
    path("profile/", views.profile_api, name="user_profile_api"),
    
    # Web views
    path("web/profile/", views.profile, name="user_profile"),
    path("profile/upload-image/", views.upload_profile_image, name="upload_profile_image"),
    path('media/profile-pictures/<str:image_name>/', views.get_resized_avatar, name='get_avatar'),
]
