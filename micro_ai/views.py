# \micro_ai\micro_ai\views.py

from allauth.account.views import LogoutView as AllAuthLogoutView

class CustomLogoutView(AllAuthLogoutView):
    def get(self, request, *args, **kwargs):
        # Call the parent AllAuth logout view to perform the actual logout
        response = super().get(request, *args, **kwargs)

        response.delete_cookie('refresh_token')

        return response