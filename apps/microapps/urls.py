# \micro_ai\apps\microapps\urls.py
from django.urls import path
from . import views

urlpatterns = [
    path('', views.MicroAppList.as_view(), name='microapp_list'), 
    path('<int:app_id>', views.MicroAppDetails.as_view(), name='microapp_details'),
    path('hash/<str:hash_id>', views.MicroAppDetailsByHash.as_view(), name='microapp_details_by_hash'),
    path('<int:app_id>/archive', views.MicroAppArchive.as_view(), name='microapp_archive'),
    path('<int:pk>/<int:collection_id>/clone', views.CloneMicroApp.as_view(), name="clone_microapp"),
    path('user', views.UserMicroAppsDetails.as_view(), name="users-roles"),
    path('app/<int:app_id>', views.UserMicroAppList.as_view(), name="users-roles"),
    path('<int:app_id>/user/<int:user_id>', views.UserMicroApps.as_view(), name="user-role"),
    path('apps', views.UserApps.as_view(), name = "user_apps"),
    path('run', views.RunList.as_view(), name="run_model"),
    path('models/configuration/', views.AIModelConfigurations.as_view(), name="models_configuration"),
    path('public/app/<int:id>', views.PublicMicroApps.as_view(), name = "public_microapps")
]
