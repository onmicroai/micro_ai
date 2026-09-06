# apps/users/views.py
from allauth.account.views import LoginView
from allauth.account.views import LogoutView as AllAuthLogoutView
from apps.subscriptions.helpers import get_plan_name
from apps.subscriptions.models import Subscription
from dj_rest_auth.views import UserDetailsView
from django.urls import reverse
from django.shortcuts import render
from rest_framework.response import Response
from rest_framework import status


class CustomLogoutView(AllAuthLogoutView):
    def get(self, request, *args, **kwargs):
        return Response({"detail": "Successfully logged out."}, status=status.HTTP_200_OK)


class CustomLogoutLoadingView(AllAuthLogoutView):
    def get(self, request, *args, **kwargs):
        return render(request, 'account/logout_loading.html')


class CustomLoginView(LoginView):
    def get_success_url(self):
        # Redirect to the dashboard page after successful login
        return reverse('dashboard:dashboard')


class CustomUserDetailsView(UserDetailsView):
    def get(self, request, *args, **kwargs):
        user_data = super().get(request, *args, **kwargs).data

        subscription = Subscription.objects.filter(user=request.user).first()

        if subscription:
            subscription_data = {
                "id": subscription.subscription_id,
                "price_id": subscription.price_id,
                "status": subscription.status,
                "period_start": subscription.period_start,
                "period_end": subscription.period_end,
                "cancel_at_period_end": subscription.cancel_at_period_end,
                "canceled_at": subscription.canceled_at,
                "customer_id": subscription.customer.id if subscription.source == "stripe" else None,
            }
        else:
            subscription_data = None

        user_data["subscription"] = subscription_data
        user_data["plan"] = get_plan_name(subscription.price_id if subscription else None)
        user_data['slug'] = None

        return Response(user_data, status=status.HTTP_200_OK)
