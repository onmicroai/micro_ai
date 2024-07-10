from django.forms import model_to_dict
from django.urls import reverse

from apps.global_microapps.models import GlobalMicroapps
from apps.microapps.models import Microapps
from apps.microapps.serializer import MicroAppSerializer
from apps.microapps.views import MicroAppList
from apps.users.adapter import EmailAsUsernameAdapter
from .invitations import clear_invite_from_session


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
            print("save_user_executed")
            user = super().save_user(request, user, form, commit)
            print("user_register" + str(user.id))
            self.add_app_templates(user)
            return user

    def add_app_templates(self,user):
        print("add_templates_executed")
        current_user_id = user.id
        print("current_user_id " + str(current_user_id))
        global_apps = GlobalMicroapps.objects.all()
        microapps_instances = []

        for global_app in global_apps:
            # Use model_to_dict to convert GlobalMicroapps instance to a dictionary
            print("global_app")
            print(global_app)
            global_app_dict = model_to_dict(global_app)
            print("global_app_dict")
            print(global_app_dict)

            # Rename 'id' to 'global_ma_id' directly in the dictionary
            global_app_dict['global_ma_id'] = global_app_dict["id"]
            del global_app_dict["id"]
            print(global_app_dict)

            serializer = MicroAppSerializer(data=global_app_dict)
            if serializer.is_valid():
                microapp = serializer.save()
                micro_app_list = MicroAppList
                micro_app_list.add_microapp_user(self, uid=current_user_id, microapp=microapp)
            
            