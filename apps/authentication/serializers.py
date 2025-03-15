from dj_rest_auth.serializers import JWTSerializer
from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.contrib.auth.forms import PasswordChangeForm
from django.utils.translation import gettext_lazy as _
import re


class LoginResponseSerializer(serializers.Serializer):
    status = serializers.CharField()
    detail = serializers.CharField()
    jwt = JWTSerializer(required=False)
    temp_otp_token = serializers.CharField(required=False)


class OtpRequestSerializer(serializers.Serializer):
    temp_otp_token = serializers.CharField()
    otp = serializers.CharField()


class EmailVerificationSerializer(serializers.Serializer):
    key = serializers.CharField()


class CustomPasswordChangeSerializer(serializers.Serializer):
    old_password = serializers.CharField(max_length=128)
    new_password1 = serializers.CharField(max_length=128)
    new_password2 = serializers.CharField(max_length=128)

    def __init__(self, *args, **kwargs):
        self.user = kwargs.pop('user', None)
        super().__init__(*args, **kwargs)
        if not self.user:
            self.user = self.context.get('request').user

    def validate_old_password(self, value):
        if not self.user.check_password(value):
            raise serializers.ValidationError(_("Your old password was entered incorrectly. Please enter it again."))
        return value

    def validate_new_password1(self, value):
        # Minimum length validation
        if len(value) < 8:
            raise serializers.ValidationError(_("Password must be at least 8 characters long"))
        
        # Uppercase letter validation
        if not re.search(r'[A-Z]', value):
            raise serializers.ValidationError(_("Password must contain at least one uppercase letter"))
        
        # Lowercase letter validation
        if not re.search(r'[a-z]', value):
            raise serializers.ValidationError(_("Password must contain at least one lowercase letter"))
        
        # Number validation
        if not re.search(r'[0-9]', value):
            raise serializers.ValidationError(_("Password must contain at least one number"))
        
        # Special character validation
        if not re.search(r'[^A-Za-z0-9]', value):
            raise serializers.ValidationError(_("Password must contain at least one special character"))
        
        # Not entirely numeric validation
        if re.match(r'^\d+$', value):
            raise serializers.ValidationError(_("Password cannot be entirely numeric"))
        
        return value

    def validate(self, attrs):
        # Check if old password is the same as new password
        if attrs.get('old_password') == attrs.get('new_password1'):
            raise serializers.ValidationError({
                'new_password1': _("New password cannot be the same as the old password.")
            })
        
        # Check if password confirmation matches
        if attrs.get('new_password1') != attrs.get('new_password2'):
            raise serializers.ValidationError({
                'new_password2': _("The two password fields didn't match.")
            })

        # Create a password change form instance
        self.password_change_form = PasswordChangeForm(
            user=self.user,
            data={
                'old_password': attrs.get('old_password'),
                'new_password1': attrs.get('new_password1'),
                'new_password2': attrs.get('new_password2'),
            }
        )

        if not self.password_change_form.is_valid():
            raise serializers.ValidationError(self.password_change_form.errors)
        
        return attrs

    def save(self):
        self.password_change_form.save()
        return self.user
