from allauth.account import app_settings
from allauth.account.adapter import DefaultAccountAdapter
from allauth.account.utils import user_email, user_field
from allauth.mfa.models import Authenticator
from django.conf import settings
from django.urls import reverse
from rest_framework import serializers
import django
import json
import os
from apps.collection.models import Collection
from apps.collection.views import CollectionList
from apps.microapps.serializer import MicroAppSerializer
from apps.microapps.views import MicroAppList
from apps.users.models import CustomUser
from apps.teams.invitations import clear_invite_from_session
from apps.utils.custom_error_message import ErrorMessages as error
from apps.utils.global_variables import CollectionVariables

json_file_path = os.path.join(settings.BASE_DIR, 'apps/utils', 'data', 'microapp_create.json')
with open(json_file_path, 'r') as file:
    data = json.load(file)

class EmailAsUsernameAdapter(DefaultAccountAdapter):
    """
    Adapter that always sets the username equal to the user's email address.
    """

    def populate_username(self, request, user):
        # override the username population to always use the email
        user_field(user, app_settings.USER_MODEL_USERNAME_FIELD, user_email(user))

    def get_email_confirmation_context(self, request, emailconfirmation):
        ctx = super().get_email_confirmation_context(request, emailconfirmation)
        ctx['domain'] = settings.DOMAIN
        ctx['user_email'] = emailconfirmation.email_address.email
        return ctx

    def get_email_confirmation_signup_context(self, request, emailconfirmation):
        ctx = super().get_email_confirmation_signup_context(request, emailconfirmation)
        ctx['domain'] = settings.DOMAIN
        ctx['user_email'] = emailconfirmation.email_address.email
        return ctx

    def get_reset_password_context(self, request, user, temp_key):
        ctx = super().get_reset_password_context(request, user, temp_key)
        ctx['domain'] = settings.DOMAIN
        ctx['user_email'] = user.email
        return ctx

    def get_login_code_context(self, request, user, code):
        ctx = super().get_login_code_context(request, user, code)
        ctx['domain'] = settings.DOMAIN
        ctx['user_email'] = user.email
        return ctx


class AcceptInvitationAdapter(EmailAsUsernameAdapter):
    """
    Adapter that checks for an invitation id in the session and redirects
    to accepting it after login.

    Necessary to use team invitations with social login.
    """

    def get_login_redirect_url(self, request):
        from apps.teams.models import Invitation

        if request.session.get("invitation_id"):
            invite_id = request.session.get("invitation_id")
            try:
                invite = Invitation.objects.get(id=invite_id)
                if not invite.is_accepted:
                    return reverse("teams:accept_invitation", args=[request.session["invitation_id"]])
                else:
                    clear_invite_from_session(request)
            except Invitation.DoesNotExist:
                pass
        return super().get_login_redirect_url(request)
    
    def save_user(self, request, user, form, commit=True):
        try:
            username = form.cleaned_data.get('email')
            if CustomUser.objects.filter(username=username):
                raise serializers.ValidationError({'error': error.EMAIL_ALREADY_EXIST})
            else:
                user = super().save_user(request, user, form, commit)
                if user.pk is None: 
                    user.save()
                self.collection_details(user)
                return user
        except django.db.utils.IntegrityError as e:  
            raise serializers.ValidationError({'error': repr(e)})
        except Exception as e:
            raise serializers.ValidationError({'error': repr(e)})
            
    def add_app_templates(self, user, cid):
        try:
            current_user_id = user.id
            micro_app_list = MicroAppList
            app_templates = data["data"]
            for app in app_templates:
                serializer = MicroAppSerializer(data = app)
                if serializer.is_valid():
                    microapp = serializer.save()
                    micro_app_list.add_microapp_user(self, uid = current_user_id, microapp = microapp, max_count = False)
                    micro_app_list.add_collection_microapp(self, cid, microapp)
        except Exception as e:
           raise Exception(error.SERVER_ERROR)
            
    def collection_details(self, user):
        try:
            current_user_id = user.id
            collection_list = CollectionList
            collections_data = [
                {"name": CollectionVariables.MY_COLLECTION},
                {"name": CollectionVariables.SHARED_WITH_ME_COLLECTION},
            ]
            collections = Collection.objects.bulk_create([Collection(**data) for data in collections_data])
            for collection in collections:
                collection_list.add_collection_user(self, uid=current_user_id, cid=collection.id)
            self.add_app_templates(user, collections[0].id)
        except Exception as e:
            raise Exception(error.SERVER_ERROR)


class NoNewUsersAccountAdapter(DefaultAccountAdapter):
    """
    Adapter that can be used to disable public sign-ups for your app.
    """

    def is_open_for_signup(self, request):
        # see https://stackoverflow.com/a/29799664/8207
        return False


def user_has_valid_totp_device(user) -> bool:
    if not user.is_authenticated:
        return False
    return user.authenticator_set.filter(type=Authenticator.Type.TOTP).exists()
