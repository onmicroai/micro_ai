# \micro_ai\apps\authentication\api_views.py

from allauth.mfa.utils import is_mfa_enabled
from allauth.mfa.models import Authenticator
from allauth.mfa.totp import TOTP
from dj_rest_auth.serializers import JWTSerializer
from dj_rest_auth.views import LoginView
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.generics import GenericAPIView
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from apps.users.models import CustomUser
from .serializers import LoginResponseSerializer, OtpRequestSerializer
import uuid
from django.core.cache import cache


class LoginViewWith2fa(LoginView):
    """
    Custom login view that checks if 2FA is enabled for the user.
    """

    @extend_schema(
        responses={
            status.HTTP_200_OK: LoginResponseSerializer,
        },
    )
    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.user = serializer.validated_data["user"]
        if is_mfa_enabled(self.user, [Authenticator.Type.TOTP]):
            # Generate a temporary token and store it with the user object
            temp_token = str(uuid.uuid4())
            cache.set(temp_token, self.user.id, timeout=300)  # set a token that will be valid for 5 minutes
            api_auth_serializer = LoginResponseSerializer(
                data={
                    "status": "otp_required",
                    "detail": "OTP required for 2FA",
                    "temp_otp_token": temp_token,
                }
            )
            api_auth_serializer.is_valid(raise_exception=True)
            # use a different status code to make it easier for API clients to handle this case
            return Response(api_auth_serializer.data, status=200)
        else:
            super_response = super().post(request, *args, **kwargs)
            if super_response.status_code == status.HTTP_200_OK:
                jwt_data = super_response.data
                # rewrap login responses to match our serializer schema
                wrapped_jwt_data = {
                    "status": "success",
                    "detail": "User logged in.",
                    "jwt": jwt_data,
                }
                return Response(wrapped_jwt_data, status=200)
            return super_response


@extend_schema(tags=["api"])
class VerifyOTPView(GenericAPIView):
    permission_classes = [AllowAny]
    serializer_class = OtpRequestSerializer

    @extend_schema(
        responses={200: JWTSerializer},
    )
    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        temp_token = serializer.validated_data["temp_otp_token"]
        otp = serializer.validated_data["otp"]

        user_id = cache.get(temp_token)
        if not user_id:
            return Response(
                {"status": "token_expired", "detail": "Invalid temporary token"}, status=status.HTTP_401_UNAUTHORIZED
            )

        user = CustomUser.objects.get(id=user_id)
        if user and TOTP(Authenticator.objects.get(user=user, type=Authenticator.Type.TOTP)).validate_code(otp):
            # OTP is valid, generate JWT tokens
            refresh = RefreshToken.for_user(user)
            return Response(
                JWTSerializer(
                    {
                        "user": user,
                        "refresh": str(refresh),
                        "access": str(refresh.access_token),
                    }
                ).data,
                status=status.HTTP_200_OK,
            )
        else:
            # OTP is invalid
            return Response({"status": "invalid_otp", "detail": "Invalid OTP code"}, status=status.HTTP_400_BAD_REQUEST)

class APICustomLogoutView(APIView):
    permission_classes = (IsAuthenticated,)

    def post(self, request):
        try:
            refresh_token = request.COOKIES.get('refresh_token')
            if refresh_token:
                try:
                    token = RefreshToken(refresh_token)
                    token.blacklist()
                except Exception:
                    pass
                    # return Response(
                    #     {"detail": "Failed to log out, token not found."},
                    #     status=status.HTTP_400_BAD_REQUEST)
                
                response = Response(
                    {"detail": "Successfully logged out."},
                    status=status.HTTP_205_RESET_CONTENT
                )

                response.delete_cookie('refresh_token')
                response.delete_cookie('csrftoken')

                return response

        except Exception as e:
            return Response(
                {"detail": "Failed to log out."},
                status=status.HTTP_400_BAD_REQUEST)