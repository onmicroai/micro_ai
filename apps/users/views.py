# \micro_ai\apps\users\views.py

from .adapter import user_has_valid_totp_device
from allauth.account.utils import send_email_confirmation
from allauth.socialaccount.models import SocialAccount
from django.http import HttpResponse, Http404
from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.http import HttpResponse, HttpResponseRedirect, JsonResponse
from django.shortcuts import render
from django.urls import reverse
from django.utils.translation import gettext_lazy as _
from django.views.decorators.http import require_POST
from django.conf import settings
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from .serializers import CustomUserSerializer

from .forms import  UploadAvatarForm
from .helpers import require_email_confirmation, user_has_confirmed_email_address
from .models import CustomUser
from PIL import Image
import os
import logging as log
from django.views.decorators.csrf import csrf_exempt

@api_view(['POST'])
@permission_classes([IsAuthenticated])
@csrf_exempt
def upload_profile_image(request):
    user = request.user
    form = UploadAvatarForm(request.POST, request.FILES)
    if form.is_valid():
        try:
            user.avatar = request.FILES["avatar"]
            user.save()
            serializer = CustomUserSerializer(user)
            return Response(serializer.data)
        except Exception as e:
            log.error(f"Error uploading image: {e}")
            return Response(
                {"errors": "Error uploading image."}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    else:
        readable_errors = ", ".join(str(error) for key, errors in form.errors.items() for error in errors)
        return Response(
            {"errors": readable_errors}, 
            status=status.HTTP_400_BAD_REQUEST
        )

@api_view(['GET', 'POST', 'PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def profile_api(request):
    """
    API endpoint for user profile operations
    """
    if request.method == 'GET':
        serializer = CustomUserSerializer(request.user)
        return Response(serializer.data)
    
    elif request.method in ['POST', 'PATCH']:
        serializer = CustomUserSerializer(request.user, data=request.data, partial=True)
        if serializer.is_valid():
            user = serializer.save()
            if 'email' in request.data and require_email_confirmation():
                if not user_has_confirmed_email_address(user, request.data['email']):
                    send_email_confirmation(request, user, signup=False, email=request.data['email'])
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    elif request.method == 'DELETE':
        user = request.user
        user.is_active = False
        user.save()
        return Response(status=status.HTTP_204_NO_CONTENT)   