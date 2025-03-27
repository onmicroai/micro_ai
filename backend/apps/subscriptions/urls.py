from django.urls import path

from . import views
from .views.api_views import (
    ListUsageRecordsAPI,
)

app_name = "subscriptions"

urlpatterns = [
    path("api/products/", views.ProductsListAPI.as_view(), name="products_api"),
    path('products/', views.ProductsListAPI.as_view(), name='products-list'),
    path('create-checkout-session/', views.CreateCheckoutSession.as_view(), name='create-checkout-session'),
    path('create-portal-session/', views.CreatePortalSession.as_view(), name='create-portal-session'),
    path('report-usage/', views.ReportUsageAPI.as_view(), name='report-usage'),
    path('usage-records/', ListUsageRecordsAPI.as_view(), name='usage-records'),
]