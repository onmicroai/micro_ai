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
from apps.users.models import CustomUser
from .serializers import LoginResponseSerializer, OtpRequestSerializer, EmailVerificationSerializer
import uuid
from django.core.cache import cache
from django.conf import settings
from datetime import datetime, timedelta, UTC
from allauth.account.models import EmailConfirmation
import logging
from dj_rest_auth.registration.views import RegisterView as BaseRegisterView
import os
from apps.subscriptions.helpers import create_free_subscription, create_free_billing_cycle
from apps.utils.usage_helper import subscription_details
from apps.subscriptions.models import Subscription

logger = logging.getLogger(__name__)


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
                
                # Calculate token expiration time in UTC
                access_token_lifetime = settings.SIMPLE_JWT.get('ACCESS_TOKEN_LIFETIME', timedelta(minutes=60))
                expiration_time = datetime.now(UTC) + access_token_lifetime
                
                # Add expiration information to the response in ISO format with UTC timezone
                jwt_data['access_expiration'] = expiration_time.isoformat() + 'Z'
                
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
            
            # Calculate token expiration time
            access_token_lifetime = settings.SIMPLE_JWT.get('ACCESS_TOKEN_LIFETIME', timedelta(minutes=60))
            expiration_time = datetime.now(UTC) + access_token_lifetime
            
            # Create response data
            response_data = JWTSerializer(
                {
                    "user": user,
                    "refresh": str(refresh),
                    "access": str(refresh.access_token),
                }
            ).data
            
            # Add expiration information to the response
            response_data['access_expiration'] = expiration_time.isoformat() + 'Z'
            
            return Response(
                response_data,
                status=status.HTTP_200_OK,
            )
        else:
            # OTP is invalid
            return Response({"status": "invalid_otp", "detail": "Invalid OTP code"}, status=status.HTTP_400_BAD_REQUEST)


@extend_schema(tags=["api"])
class EmailVerificationView(GenericAPIView):
    permission_classes = [AllowAny]
    serializer_class = EmailVerificationSerializer

    @extend_schema(
        responses={
            200: {"type": "object", "properties": {
                "status": {"type": "string"},
                "detail": {"type": "string"},
                "jwt": {"type": "object"}
            }},
            400: {"type": "object", "properties": {"detail": {"type": "string"}}},
        },
    )
    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        key = serializer.validated_data["key"]
        
        # First try to verify using HMAC verification
        try:
            confirmation = EmailConfirmation.objects.get(key=key)
        except EmailConfirmation.DoesNotExist:
                return Response(
                    {"detail": "Invalid key or key has expired"},
                    status=status.HTTP_400_BAD_REQUEST
                )

        if confirmation.key != key:
            return Response(
                {"detail": "Invalid key or key has expired"},
                status=status.HTTP_400_BAD_REQUEST
            )

            # Check if the confirmation has expired
        from datetime import timedelta
        from django.utils import timezone
        from django.conf import settings
            
        # Get the expiration period from settings or use default (3 days)
        expiration_period = getattr(settings, 'ACCOUNT_EMAIL_CONFIRMATION_EXPIRE_DAYS', 3)
        expiration_time = confirmation.created + timedelta(days=expiration_period)
            
        if expiration_time < timezone.now():
            return Response(
                {"detail": "Invalid key or key has expired"},
                   status=status.HTTP_400_BAD_REQUEST
            )

        try:
            confirmation.confirm(request)
            
            # Get the user from the confirmed email address
            user = confirmation.email_address.user
            refresh = RefreshToken.for_user(user)
            
            # Calculate token expiration time
            access_token_lifetime = settings.SIMPLE_JWT.get('ACCESS_TOKEN_LIFETIME', timedelta(minutes=60))
            expiration_time = datetime.now(UTC) + access_token_lifetime
            
            # Create the response data
            jwt_data = {
                "access": str(refresh.access_token),
                "refresh": str(refresh),
                "user": {
                    "id": user.id,
                    "email": user.email,
                },
                "access_expiration": expiration_time.isoformat() + 'Z'
            }
            
            wrapped_jwt_data = {
                "status": "success",
                "detail": "Email verified successfully",
                "jwt": jwt_data,
            }
            
            # Create response with refresh token cookie
            response = Response(wrapped_jwt_data, status=status.HTTP_200_OK)
            
            # Set refresh token cookie using the same approach as in JWTRefreshTokenMiddleware
            is_production = os.getenv('PRODUCTION', 'False') == 'True'
            samesite = 'None' if is_production else 'Lax'
            
            response.set_cookie(
                'refresh_token',
                str(refresh),
                max_age=settings.SIMPLE_JWT['REFRESH_TOKEN_LIFETIME'].total_seconds(),
                httponly=True,
                secure=is_production,
                samesite=samesite,
                # Do NOT set the domain attribute
            )
            
            return response
            
        except Exception as e:
            return Response(
                {"detail": f"Error confirming email: {str(e)}"},
                status=status.HTTP_400_BAD_REQUEST
            )

class APICustomLogoutView(APIView):
    permission_classes = ()

    def post(self, request):
        try:
            refresh_token = request.COOKIES.get('refresh_token')
            if refresh_token:
                try:
                    token = RefreshToken(refresh_token)
                    token.blacklist()
                except Exception as e:
                    logger.warning(f"Failed to blacklist token: {str(e)}")

                response = Response({"detail": "Successfully logged out."}, status=status.HTTP_205_RESET_CONTENT)

                # Get the same settings used when setting the cookie
                is_production = os.getenv("PRODUCTION", "False") == "True"
                samesite = "None" if is_production else "Lax"

                try:
                    response.delete_cookie("refresh_token", path="/", samesite=samesite)
                except Exception as e:
                    logger.error(f"Failed to delete cookies: {str(e)}")
                    # Continue with response even if cookie deletion fails

                return response
            else:
                logger.warning("No refresh token found in cookies")
                return Response({"detail": "No refresh token found."}, status=status.HTTP_400_BAD_REQUEST)

        except Exception as e:
            logger.error(f"Logout failed: {str(e)}")
            return Response({"detail": "Failed to log out."}, status=status.HTTP_400_BAD_REQUEST)

class CustomRegisterView(BaseRegisterView):
    def get_response_data(self, user):
        return {
            "detail": "Verification e-mail sent.",
            "user_id": user.id,
            "email": user.email
        }

    def perform_create(self, serializer):
        user = serializer.save(self.request)
        
        # Create free subscription for new user
        subscription_instance = create_free_subscription(user)
        # Get the serialized version of the new subscription
        subscription_data = subscription_details(user.id)
        subscription_instance = Subscription.objects.get(id=subscription_data["id"])

        create_free_billing_cycle(user, subscription_instance)
        
        # Check if email verification is already set up
        from allauth.account.models import EmailAddress
        email_addresses = EmailAddress.objects.filter(user=user)
        
        # Check if there are any existing confirmations
        from allauth.account.models import EmailConfirmation
        confirmations = EmailConfirmation.objects.filter(email_address__user=user)
        
        if confirmations:
            for confirmation in confirmations:
                confirmation.delete()
                # Delete existing confirmation to create a new one with the correct template
                confirmation.delete()
        
        # Create a new confirmation with the correct template
        if email_addresses:
            email_address = email_addresses[0]
            # Create confirmation
            confirmation = EmailConfirmation.create(email_address)
            
            # Send with the correct template
            confirmation.send(signup=True)  # This will use the signup template
        
        return user