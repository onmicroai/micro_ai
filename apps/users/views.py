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
from apps.api.models import UserAPIKey
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from .serializers import CustomUserSerializer

from .forms import CustomUserChangeForm, UploadAvatarForm
from .helpers import require_email_confirmation, user_has_confirmed_email_address
from .models import CustomUser
from PIL import Image
import os
import logging as log
from django.views.decorators.csrf import csrf_exempt

@login_required
def profile(request):
    if request.method == "POST":
        form = CustomUserChangeForm(request.POST, instance=request.user)
        if form.is_valid():
            user = form.save(commit=False)
            user_before_update = CustomUser.objects.get(pk=user.pk)
            need_to_confirm_email = (
                user_before_update.email != user.email
                and require_email_confirmation()
                and not user_has_confirmed_email_address(user, user.email)
            )
            if need_to_confirm_email:
                # don't change it but instead send a confirmation email
                # email will be changed by signal when confirmed
                new_email = user.email
                send_email_confirmation(request, user, signup=False, email=new_email)
                user.email = user_before_update.email
                # recreate the form to avoid populating the previous email in the returned page
                form = CustomUserChangeForm(instance=user)
            user.save()
            messages.success(request, _("Profile successfully saved."))
    else:
        form = CustomUserChangeForm(instance=request.user)
    return render(
        request,
        "account/profile.html",
        {
            "form": form,
            "active_tab": "profile",
            "page_title": _("Profile"),
            "api_keys": request.user.api_keys.filter(revoked=False),
            "social_accounts": SocialAccount.objects.filter(user=request.user),
            "user_has_valid_totp_device": user_has_valid_totp_device(request.user),
        },
    )


@login_required
@csrf_exempt
@require_POST
def upload_profile_image(request):
    user = request.user
    form = UploadAvatarForm(request.POST, request.FILES)
    if form.is_valid():
        try:
            user.avatar = request.FILES["avatar"]
            user.save()
            return HttpResponse(_("Success!"))
        except Exception as e:
            log.error(f"Error uploading image: {e}")
            return JsonResponse(status=500, data={"errors": "Error uploading image."})
    else:
        readable_errors = ", ".join(str(error) for key, errors in form.errors.items() for error in errors)
        return JsonResponse(status=403, data={"errors": readable_errors})


@login_required
def create_api_key(request):
    api_key, key = UserAPIKey.objects.create_key(
        name=f"{request.user.get_display_name()[:40]} API Key", user=request.user
    )
    messages.success(
        request,
        _("API Key created. Your key is: {key}. Save this somewhere safe - you will only see it once!").format(
            key=key,
        ),
    )
    return HttpResponseRedirect(reverse("users:user_profile"))


@login_required
@require_POST
def revoke_api_key(request):
    key_id = request.POST.get("key_id")
    api_key = request.user.api_keys.get(id=key_id)
    api_key.revoked = True
    api_key.save()
    messages.success(
        request,
        _("API Key {key} has been revoked. It can no longer be used to access the site.").format(
            key=api_key.prefix,
        ),
    )
    return HttpResponseRedirect(reverse("users:user_profile"))

@login_required
def get_resized_avatar(request, image_name):
    try:
        original_image_path = os.path.join(settings.MEDIA_ROOT, 'profile-pictures', image_name)
        if not os.path.exists(original_image_path):
            raise Http404("Avatar not found.")
        
        query_params = request.GET
        width = query_params.get('w')
        height = query_params.get('h')
        
        base, ext = os.path.splitext(image_name)

        resized_image_path = original_image_path  # Fallback to the original
 
        if width is not None or height is not None:
            # Setup target dimensions
            target_width = int(width) if width else None
            target_height = int(height) if height else None
            
            resized_image_filename = f"{base}_{target_width if target_width else 'auto'}x{target_height if target_height else 'auto'}{ext}"
            resized_image_path = os.path.join(settings.MEDIA_ROOT, 'profile-pictures', resized_image_filename)
            if os.path.exists(resized_image_path):
                with open(resized_image_path, 'rb') as f:
                    return HttpResponse(f.read(), content_type="image/jpeg")

            with Image.open(original_image_path) as img:
                original_width, original_height = img.size
                
                # Determine target dimensions for square resizing if only one dimension is given
                if target_width is None and target_height is None:
                    raise ValueError("Must provide either width or height.")

                if target_width is None:
                    target_width = target_height
                elif target_height is None:
                    target_height = target_width

                # Calculate resize ratios
                width_ratio = target_width / original_width
                height_ratio = target_height / original_height

                if width_ratio > height_ratio:
                    new_width = target_width
                    new_height = int(original_height * width_ratio)
                    img = img.resize((new_width, new_height), Image.LANCZOS)
                    crop_top_bottom = (new_height - target_height) // 2
                    img = img.crop((0, crop_top_bottom, new_width, crop_top_bottom + target_height))
                else:
                    new_height = target_height
                    new_width = int(original_width * height_ratio)
                    img = img.resize((new_width, new_height), Image.LANCZOS)
                    crop_left_right = (new_width - target_width) // 2
                    img = img.crop((crop_left_right, 0, crop_left_right + target_width, new_height))

                if img.mode == 'RGBA':
                    img = img.convert('RGB')

                img.save(resized_image_path, format='JPEG')

        with open(resized_image_path, 'rb') as f:
            return HttpResponse(f.read(), content_type="image/jpeg")
    
    except Exception as e:
        return HttpResponse(status=500)

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