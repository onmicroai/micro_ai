# apps/users/views.py
from allauth.account.views import LoginView, SignupView
from allauth.account.views import LogoutView as AllAuthLogoutView
from django.urls import reverse
from django.shortcuts import render

class CustomLogoutView(AllAuthLogoutView):
    def get(self, request, *args, **kwargs):
        response = super().get(request, *args, **kwargs)
        response.delete_cookie('refresh_token')

        return response
    
class CustomLogoutLoadingView(AllAuthLogoutView):
    def get(self, request, *args, **kwargs):
        response = super().get(request, *args, **kwargs)
        response.delete_cookie('refresh_token')

        return render(request, 'account/logout_loading.html')
    
class CustomLoginView(LoginView):
    def get_success_url(self):
        # Redirect to the dashboard page after successful login
        return reverse('dashboard:dashboard')
    
class CustomSignupView(SignupView):
    def get_success_url(self):
        # Redirect to the dashboard page after successful registration
        return reverse('dashboard:dashboard')