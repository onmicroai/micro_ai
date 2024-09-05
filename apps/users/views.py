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

from .forms import CustomUserChangeForm, UploadAvatarForm
from .helpers import require_email_confirmation, user_has_confirmed_email_address
from .models import CustomUser
from PIL import Image
import os

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
@require_POST
def upload_profile_image(request):
    user = request.user
    form = UploadAvatarForm(request.POST, request.FILES)
    if form.is_valid():
        user.avatar = request.FILES["avatar"]
        user.save()
        return HttpResponse(_("Success!"))
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
    # Construct the full path to the original avatar
    original_image_path = os.path.join(settings.MEDIA_ROOT, 'profile-pictures', image_name)
    
    if not os.path.exists(original_image_path):
        raise Http404("Avatar not found.")

    # Retrieve query parameters for resizing
    query_params = request.GET
    width = query_params.get('w')
    height = query_params.get('h')
    quality = query_params.get('q')
    
    base, ext = os.path.splitext(image_name)
    
    # Define resized image path
    resized_image_path = original_image_path  # Fallback to original

    if width or height:
        # Generate filename for the resized image
        resized_image_filename = f"{base}_{width if width else 'original'}x{height if height else 'original'}_{quality if quality else 'default'}{ext}"
        resized_image_path = os.path.join(settings.MEDIA_ROOT, 'profile-pictures', resized_image_filename)

        # Check if the resized image already exists
        if os.path.exists(resized_image_path):
            with open(resized_image_path, 'rb') as f:
                return HttpResponse(f.read(), content_type="image/jpeg")

    # Resize the image
    with Image.open(original_image_path) as img:
        # Resize the image based on provided dimensions
        new_width = img.width
        new_height = img.height

        if width:
            new_width = int(width)
        if height:
            new_height = int(height)

        img = img.resize((new_width, new_height), Image.ANTIALIAS)

        # Save the resized image with the specified quality
        if quality:
            img.save(resized_image_path, format='JPEG', quality=int(quality))
        else:
            img.save(resized_image_path, format='JPEG', quality=85)  # Default quality

    # Serve the resized image
    with open(resized_image_path, 'rb') as f:
        return HttpResponse(f.read(), content_type="image/jpeg")