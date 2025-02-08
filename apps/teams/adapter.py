import django
import json
import os
from django.forms import model_to_dict
from django.urls import reverse
from django.conf import settings
from rest_framework import serializers
from apps.collection.models import Collection
from apps.collection.serializer import CollectionSerializer
from apps.collection.views import CollectionList
from apps.microapps.models import Microapp
from apps.microapps.serializer import MicroAppSerializer
from apps.microapps.views import MicroAppList
from apps.users.adapter import EmailAsUsernameAdapter
from apps.users.models import CustomUser
from .invitations import clear_invite_from_session
from django.conf import settings
from apps.utils.custom_error_message import ErrorMessages as error
from apps.utils.global_varibales import CollectionVariables

json_file_path = os.path.join(settings.BASE_DIR, 'apps/utils', 'data', 'microapp_create.json')
with open(json_file_path, 'r') as file:
    data = json.load(file)