# apps/users/views.py
from allauth.account.views import LoginView, SignupView
from allauth.account.views import LogoutView as AllAuthLogoutView
from dj_rest_auth.views import UserDetailsView
from django.urls import reverse
from django.shortcuts import render
from rest_framework.response import Response
from rest_framework import status

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
    
class CustomUserDetailsView(UserDetailsView):
    def get(self, request, *args, **kwargs):
        # Get the default user data from the parent view
        user_data = super().get(request, *args, **kwargs).data

        # Get the subscription slug for the user
        
        # Add the subscription slug to the response data
        user_data['slug'] = request.team.slug

        return Response(user_data, status=status.HTTP_200_OK)