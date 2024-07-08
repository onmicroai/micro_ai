from django.urls import path
from . import views
from rest_framework.urlpatterns import format_suffix_patterns

urlpatterns = [
    path('view/', views.MicroAppList.as_view(), name='microapp_list'), 
    path('view/<int:pk>/', views.MicroAppDetails.as_view(), name='microapp_details'),
    path('clone/<int:pk>', views.clone_app, name="clone_microapp"),
    path('userapps/', views.user_microapps, name="user-microapps"),
    # path('collectionapps',views.collection_microapps, name="collection-microapps"),
]
