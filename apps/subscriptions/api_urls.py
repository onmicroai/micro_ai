from django.urls import path
from .views.api_views import (
    ProductsListAPI,
    CreateCheckoutSession,
    CreatePortalSession,
    ReportUsageAPI,
    ListUsageRecordsAPI,
)

app_name = "subscriptions_api"

urlpatterns = [
    # Products and Plans
    path('products/', ProductsListAPI.as_view(), name='products-list'),
    
    # Checkout and Portal
    path('checkout-session/', CreateCheckoutSession.as_view(), name='create-checkout-session'),
    path('portal-session/', CreatePortalSession.as_view(), name='create-portal-session'),
    
    # Usage
    path('report-usage/', ReportUsageAPI.as_view(), name='report-usage'),
    path('usage-records/', ListUsageRecordsAPI.as_view(), name='usage-records'),
] 