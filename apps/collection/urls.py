from django.urls import path
from . import views

urlpatterns = [
    path('', views.CollectionList.as_view(), name='collection_list'), 
    path('<int:pk>', views.CollectionDetail.as_view(), name='collection_detail'), 
    path('user', views.UserCollections.as_view(), name='user_collections'),  
    path('user/<int:collection_id>/user/<int:user_id>/', views.UserCollectionsDetail.as_view(), name='user_collections'),  
    path('apps/<int:collection_id>', views.CollectionMicroAppsList.as_view(), name='collections_microapps'), 
    path('<int:collection_id>/microapp/<int:app_id>', views.CollectionMicroAppsDetails.as_view(), name='collections_microapps'), 
]