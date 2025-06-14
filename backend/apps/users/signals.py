# \micro_ai\apps\users\signals.py

from allauth.account.signals import email_confirmed, user_signed_up
from django.conf import settings
from django.core.files.storage import default_storage
from django.core.mail import mail_admins
from django.db.models.signals import pre_save, post_delete
from django.dispatch import receiver
from apps.users.models import CustomUser
from django.core.files.base import ContentFile
from django.utils.text import slugify
import requests


@receiver(user_signed_up)
def handle_sign_up(request, user, **kwargs):
    # customize this function to do custom logic on sign up, e.g. send a welcome email
    # or subscribe them to your mailing list.
    # This example notifies the admins, in case you want to keep track of sign ups
    _notify_admins_of_signup(user)

    gravatar_url = f"https://www.gravatar.com/avatar/{user.gravatar_id}?s=128&d=identicon"
    response = requests.get(gravatar_url)

    if response.status_code == 200:
        avatar_filename = f"profile-pictures/{slugify(user.username)}_avatar.jpg"
        
        user.avatar.save(avatar_filename, ContentFile(response.content)) 
        user.save()
    else:
        print(f"Gravatar image not found for {user.email}: {response.status_code}")

@receiver(email_confirmed)
def update_user_email(sender, request, email_address, **kwargs):
    """
    When an email address is confirmed make it the primary email.
    """
    # This also sets user.email to the new email address.
    # hat tip: https://stackoverflow.com/a/29661871/8207
    email_address.set_as_primary()


def _notify_admins_of_signup(user):
    mail_admins(
        f"Yowsers, someone signed up for {settings.PROJECT_METADATA['NAME']}!",
        "Email: {}".format(user.email),
        fail_silently=True,
    )


@receiver(pre_save, sender=CustomUser)
def remove_old_profile_picture_on_change(sender, instance, **kwargs):
    if not instance.pk:
        return False

    try:
        old_file = sender.objects.get(pk=instance.pk).avatar
    except sender.DoesNotExist:
        return False

    if old_file and old_file.name != instance.avatar.name:
        if default_storage.exists(old_file.name):
            default_storage.delete(old_file.name)


@receiver(post_delete, sender=CustomUser)
def remove_profile_picture_on_delete(sender, instance, **kwargs):
    if instance.avatar:
        if default_storage.exists(instance.avatar.name):
            default_storage.delete(instance.avatar.name)
