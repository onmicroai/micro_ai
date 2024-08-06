from django.urls import path
from . import views
from rest_framework.urlpatterns import format_suffix_patterns

urlpatterns = [
    path('', views.MicroAppList.as_view(), name='microapp_list'), 
    path('<int:app_id>', views.MicroAppDetails.as_view(), name='microapp_details'),
    path('<int:pk>/clone', views.CloneMicroApp.as_view(), name="clone_microapp"),
    path('user', views.UserMicroAppsDetails.as_view(), name="users-roles"),
    path('app/<int:app_id>', views.UserMicroAppList.as_view(), name="users-roles"),
    path('<int:app_id>/user/<int:user_id>', views.UserMicroApps.as_view(), name="user-role"),
    path('apps', views.UserApps.as_view(), name = "user_apps"),
    path('run', views.RunList.as_view(), name="run_model")
]
