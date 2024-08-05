import django
from django.forms import model_to_dict
from django.urls import reverse

from rest_framework import serializers
from apps.collection.serializer import CollectionSerializer
from apps.collection.views import CollectionList
from apps.global_microapps.models import GlobalMicroapps
from apps.microapps.models import Microapp
from apps.microapps.serializer import MicroAppSerializer
from apps.microapps.views import MicroAppList
from apps.users.adapter import EmailAsUsernameAdapter
from apps.users.models import CustomUser
from .invitations import clear_invite_from_session
from django.conf import settings


class AcceptInvitationAdapter(EmailAsUsernameAdapter):
    """
    Adapter that checks for an invitation id in the session and redirects
    to accepting it after login.

    Necessary to use team invitations with social login.
    """

    def get_login_redirect_url(self, request):
        from .models import Invitation

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
                raise serializers.ValidationError({'error': "email already exists"})
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
            
    def add_app_templates(self,user,cid):
        
        try:
            current_user_id = user.id
            global_apps = GlobalMicroapps.objects.all()
            micro_app_list = MicroAppList
            for global_app in global_apps:
                global_app_dict = model_to_dict(global_app)
                del global_app_dict["id"]
                serializer = MicroAppSerializer(data=global_app_dict)
                if serializer.is_valid():
                    microapp = serializer.save()
                    micro_app_list.add_microapp_user(self, uid=current_user_id, microapp=microapp)
                    micro_app_list.add_collection_microapp(self, cid, microapp)
        except Exception as e:
           raise Exception("An error occurred while adding app templates")
        
    def collection_details(self,user):
        try:
            current_user_id = user.id
            collection_list = CollectionList
            collection_data = {"name": "My Collection"}
            serializer = CollectionSerializer(data=collection_data)
            if serializer.is_valid():
                serialize = serializer.save()
                collection_list.add_collection_user(self, uid=current_user_id, cid=serialize.id)
                self.add_app_templates(user,serialize.id)
        except Exception as e:
            raise Exception("An error occurred while adding user collection")
            
            