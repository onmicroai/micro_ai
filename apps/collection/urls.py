from django.urls import path
from . import views

urlpatterns = [
    path('', views.CollectionList.as_view(), name='collection_list'), 
    path('<int:collection_id>', views.CollectionDetail.as_view(), name='collection_detail'), 
    path('user', views.UserCollections.as_view(), name='user_collections'),
    path('user/admin', views.UserCollectionsAdmin.as_view(), name='user_collections_admin'),    
    path('user/<int:collection_id>/user/<int:user_id>/', views.UserCollectionsDetail.as_view(), name='user_collections'),
    path('user/apps/<int:collection_id>', views.UserCollectionMicroAppsList.as_view(), name='user_collections_microapps'),   
    path('apps/<int:collection_id>', views.CollectionMicroAppsList.as_view(), name='collections_microapps'), 
    path('<int:collection_id>/microapp/<int:app_id>', views.CollectionMicroAppsDetails.as_view(), name='collections_microapps'), 
    path('app/<int:app_id>/collections/', views.AppCollectionsList.as_view(), name='app_collections'),  # New URL pattern
    path('user/collection/apps', views.CollectionMicroApps.as_view(), name = "collection_microapps")
]
