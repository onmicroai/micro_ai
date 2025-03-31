from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status

class APICustomLogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        response = Response({"detail": "Successfully logged out."}, status=status.HTTP_200_OK)
        response.delete_cookie(
            'refresh_token',
            path='/',  # Must match the path used when setting
            domain=None,  # Must match the domain used when setting
            samesite='Lax'  # Must match the samesite setting used when setting
        )
        return response 