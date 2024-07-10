from django.urls import path
from . import views
from rest_framework.urlpatterns import format_suffix_patterns

urlpatterns = [
    path('', views.MicroAppList.as_view(), name='microapp_list'), 
    path('<int:pk>', views.MicroAppDetails.as_view(), name='microapp_details'),
    path('<int:pk>/clone', views.CloneMicroApp.as_view(), name="clone_microapp"),
    path('<int:app_id>/user/<int:user_id>', views.UserMicroApps.as_view(), name="user-role"),
    path('<int:app_id>/user', views.UserMicroApps.as_view(), name="users-roles"),
    path('apps', views.UserApps.as_view(), name = "user_apps"),
    path('run', views.create_reponse, name="run_model")
    # path('collectionapps',views.collection_microapps, name="collection-microapps"),
]
