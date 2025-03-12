from django.urls import path
from .views.api_views import (
    CancelDowngrade,
    ProductsListAPI,
    CreateCheckoutSession,
    CreatePortalSession,
    UpdateSubscription,
    SpendCredits,
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
    path('update-subscription/', UpdateSubscription.as_view(), name='update-subscription'),
    path('spend-credits/', SpendCredits.as_view(), name='spend-credits'),
    path('cancel-downgrade/', CancelDowngrade.as_view(), name='cancel-downgrade'),
    
    # Usage
    path('report-usage/', ReportUsageAPI.as_view(), name='report-usage'),
    path('usage-records/', ListUsageRecordsAPI.as_view(), name='usage-records'),
] 