from django.urls import path
from . import views
from rest_framework.urlpatterns import format_suffix_patterns

urlpatterns = [
    path('view/', views.GlobalAppList.as_view(), name='globalapp_list'), 
    path('view/<int:pk>/', views.GlobalAppDetail.as_view(), name='globalapp_detail'),
]
