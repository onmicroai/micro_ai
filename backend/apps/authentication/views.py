# apps/users/views.py
from allauth.account.views import LoginView, SignupView
from allauth.account.views import LogoutView as AllAuthLogoutView
from apps.subscriptions.helpers import get_plan_name
from apps.subscriptions.models import Subscription
from dj_rest_auth.views import UserDetailsView, PasswordResetView, PasswordResetConfirmView, PasswordChangeView
from django.urls import reverse, resolve, get_resolver
from django.shortcuts import render
from rest_framework.response import Response
from rest_framework import status, serializers
from rest_framework.permissions import AllowAny, IsAuthenticated
from django.conf import settings
from dj_rest_auth.serializers import PasswordResetSerializer
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.utils.encoding import force_bytes, force_str
from django.contrib.auth import get_user_model
from django.contrib.auth.forms import SetPasswordForm
from django.utils.decorators import method_decorator
from django.views.decorators.debug import sensitive_post_parameters
from django.utils.translation import gettext_lazy as _
import logging
from .serializers import CustomPasswordChangeSerializer

logger = logging.getLogger(__name__)

# Add a custom serializer for password reset confirmation
class CustomPasswordResetConfirmSerializer(serializers.Serializer):
    """
    Serializer for confirming a password reset. This is a custom version
    that provides detailed logging for debugging.
    """
    new_password1 = serializers.CharField(max_length=128)
    new_password2 = serializers.CharField(max_length=128)
    uid = serializers.CharField()
    token = serializers.CharField()

    def validate_uid(self, value):
        print(f"validate_uid called with value: {value}")
        try:
            # Try to decode the uid
            uid = force_str(urlsafe_base64_decode(value))
            print(f"Decoded UID: {uid}")
            self.user = get_user_model().objects.get(pk=uid)
            print(f"Found user: {self.user}")
            return value
        except (TypeError, ValueError, OverflowError, get_user_model().DoesNotExist) as e:
            print(f"Error validating UID: {str(e)}")
            # Try with the value directly as a user ID
            try:
                self.user = get_user_model().objects.get(pk=value)
                print(f"Found user with direct ID: {self.user}")
                return value
            except (get_user_model().DoesNotExist) as e:
                print(f"Error finding user with direct ID: {str(e)}")
                raise serializers.ValidationError("Invalid value")

    def validate(self, attrs):
        print(f"validate called with attrs: {attrs}")
        self.set_password_form = SetPasswordForm(
            user=self.user, data={
                'new_password1': attrs.get('new_password1'),
                'new_password2': attrs.get('new_password2'),
            }
        )
        if not self.set_password_form.is_valid():
            print(f"SetPasswordForm errors: {self.set_password_form.errors}")
            raise serializers.ValidationError(self.set_password_form.errors)
        return attrs

    def save(self):
        print(f"save called")
        self.set_password_form.save()
        print(f"Password saved successfully")
        return self.user

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
    serializer_class = CustomPasswordResetConfirmSerializer  # Use our custom serializer

    def post(self, request, *args, **kwargs):
        print("\n==== PASSWORD RESET CONFIRM DEBUG ====")
        print(f"Request data: {request.data}")
        print(f"URL kwargs: {kwargs}")
        
        # Extract uid and token from URL and request data
        url_uid = kwargs.get('uidb64')
        url_token = kwargs.get('token')
        data_uid = request.data.get('uid')
        data_token = request.data.get('token')
        
        print(f"URL UID: {url_uid}, URL Token: {url_token}")
        print(f"Data UID: {data_uid}, Data Token: {data_token}")
        
        # Try to decode the URL UID to see what it should be
        try:
            decoded_uid_from_url = urlsafe_base64_decode(url_uid).decode()
            print(f"Decoded UID from URL: {decoded_uid_from_url}")
        except Exception as e:
            print(f"Error decoding URL UID: {str(e)}")
        
        # Use the encoded UID from the URL if no uid in request data
        if 'uid' not in request.data or not request.data['uid']:
            print(f"Setting uid in request data to URL UID: {url_uid}")
            request.data['uid'] = url_uid
        
        # Use the token from the URL if no token in request data
        if 'token' not in request.data or not request.data['token']:
            print(f"Setting token in request data to URL token: {url_token}")
            request.data['token'] = url_token
        
        # Log the final request data before passing to parent
        print(f"Final request data: {request.data}")
        print("==== END DEBUG ====\n")
        
        try:
            response = super().post(request, *args, **kwargs)
            print(f"Response status: {response.status_code}")
            print(f"Response data: {response.data}")
            return response
        except Exception as e:
            print(f"Exception in password reset confirm: {str(e)}")
            import traceback
            print(traceback.format_exc())
            raise

    def get_response_data(self, user):
        print(f"Password reset successful for user: {user.email}")
        return {
            "detail": "Password has been reset with the new password."
        }
    
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

        # Safely get the team slug if available
        team = getattr(request, 'team', None)
        if team:
            user_data['slug'] = team.slug
        else:
            user_data['slug'] = None

        return Response(user_data, status=status.HTTP_200_OK)

class CustomPasswordChangeView(PasswordChangeView):
    """
    Calls Django Auth SetPasswordForm save method.

    Accepts the following POST parameters: old_password, new_password1, new_password2
    Returns the success/fail message.
    """
    serializer_class = CustomPasswordChangeSerializer
    permission_classes = (IsAuthenticated,)

    @method_decorator(sensitive_post_parameters('old_password', 'new_password1', 'new_password2'))
    def dispatch(self, *args, **kwargs):
        return super().dispatch(*args, **kwargs)

    def post(self, request, *args, **kwargs):
        try:
            serializer = self.get_serializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            serializer.save()
            return Response({'detail': _('New password has been saved.')})
        except serializers.ValidationError as e:
            logger.info(f"Password change validation error: {e.detail}")
            return Response(e.detail, status=status.HTTP_400_BAD_REQUEST)