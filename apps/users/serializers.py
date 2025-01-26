# \micro_ai\apps\users\serializers.py

from rest_framework import serializers

from .models import CustomUser


class CustomUserSerializer(serializers.ModelSerializer):
    """
    Basic serializer to pass CustomUser details to the front end.
    Extend with any fields your app needs.
    """

    is_beta_tester = serializers.BooleanField(read_only=True)

    class Meta:
        model = CustomUser
        fields = ("id", "first_name", "last_name", "email", "avatar_url", "get_display_name", "is_beta_tester")

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomUser
        fields = '__all__'
