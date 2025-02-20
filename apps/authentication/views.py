# apps/users/views.py
from allauth.account.views import LoginView, SignupView
from allauth.account.views import LogoutView as AllAuthLogoutView
from dj_rest_auth.views import UserDetailsView, PasswordResetView, PasswordResetConfirmView
from django.urls import reverse, resolve, get_resolver
from django.shortcuts import render
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny
from django.conf import settings
from dj_rest_auth.serializers import PasswordResetSerializer
from django.utils.http import urlsafe_base64_encode
from django.utils.encoding import force_bytes
import logging

logger = logging.getLogger(__name__)

def custom_url_generator(request, user, temp_key):
    """Generate custom password reset URL."""
    uid = urlsafe_base64_encode(force_bytes(user.pk))
    logger.info(f"Generated UID: {uid}")
    return f"{settings.DOMAIN}/accounts/password/reset/confirm/{uid}/{temp_key}/"

class CustomLogoutView(AllAuthLogoutView):
    def get(self, request, *args, **kwargs):
        response = Response({"detail": "Successfully logged out."}, status=status.HTTP_200_OK)
        response.delete_cookie('refresh_token')
        return response
    
class CustomLogoutLoadingView(AllAuthLogoutView):
    def get(self, request, *args, **kwargs):
        response = render(request, 'account/logout_loading.html')
        response.delete_cookie('refresh_token')
        return response
    
class CustomLoginView(LoginView):
    def get_success_url(self):
        # Redirect to the dashboard page after successful login
        return reverse('dashboard:dashboard')
    
class CustomSignupView(SignupView):
    def get_success_url(self):
        # Redirect to the dashboard page after successful registration
        return reverse('dashboard:dashboard')

class CustomPasswordResetSerializer(PasswordResetSerializer):
    def get_email_options(self):
        logger.info("Getting email options with domain: %s", settings.DOMAIN)
        return {
            'domain_override': settings.DOMAIN,
            'extra_email_context': {
                'domain': settings.DOMAIN
            }
        }

    def save(self):
        try:
            logger.info("Starting password reset for email: %s", self.validated_data['email'])
            request = self.context.get('request')
            logger.info("Request path: %s", request.path if request else 'No request')
            
            # Call parent save method with custom URL generator
            opts = {
                'use_https': request.is_secure() if request else False,
                'from_email': getattr(settings, 'DEFAULT_FROM_EMAIL'),
                'request': request,
                'email_template_name': 'registration/password_reset_email.html',
                'url_generator': custom_url_generator
            }
            opts.update(self.get_email_options())
            logger.info("Password reset options: %s", opts)
            
            self.reset_form.save(**opts)
            logger.info("Password reset email sent successfully")
        except Exception as e:
            logger.error("Error in password reset: %s", str(e), exc_info=True)
            raise

class CustomPasswordResetView(PasswordResetView):
    permission_classes = (AllowAny,)
    serializer_class = CustomPasswordResetSerializer

    def post(self, request, *args, **kwargs):
        logger.info("Received password reset request")
        try:
            serializer = self.get_serializer(data=request.data)
            if serializer.is_valid():
                logger.info("Serializer is valid")
                serializer.save()
                return self.get_response()
            else:
                logger.error("Serializer errors: %s", serializer.errors)
                return Response(
                    serializer.errors,
                    status=status.HTTP_400_BAD_REQUEST
                )
        except Exception as e:
            logger.error("Error in password reset view: %s", str(e), exc_info=True)
            raise

    def get_response(self):
        return Response(
            {"detail": "Password reset e-mail has been sent."},
            status=status.HTTP_200_OK
        )

class CustomPasswordResetConfirmView(PasswordResetConfirmView):
    permission_classes = (AllowAny,)

    def post(self, request, *args, **kwargs):
        logger.info("Received password reset confirm request")
        logger.info("URL kwargs: %s", kwargs)
        return super().post(request, *args, **kwargs)

    def get_response_data(self, user):
        logger.info("Password reset successful for user: %s", user.email)
        return {
            "detail": "Password has been reset with the new password."
        }
    
class CustomUserDetailsView(UserDetailsView):
    def get(self, request, *args, **kwargs):
        # Get the default user data from the parent view
        user_data = super().get(request, *args, **kwargs).data

        # Get the subscription slug for the user
        
        # Add the subscription slug to the response data
        user_data['slug'] = request.team.slug

        return Response(user_data, status=status.HTTP_200_OK)