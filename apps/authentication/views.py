# apps/users/views.py
from allauth.account.views import LoginView
from allauth.account.views import LogoutView as AllAuthLogoutView
from django.urls import reverse

class CustomLogoutView(AllAuthLogoutView):
    def get(self, request, *args, **kwargs):
        # Call the parent AllAuth logout view to perform the actual logout
        response = super().get(request, *args, **kwargs)

        response.delete_cookie('refresh_token')

        return response

class CustomLoginView(LoginView):
    def get_success_url(self):
        # Redirect to the dashboard page after successful login
        return reverse('dashboard:dashboard')