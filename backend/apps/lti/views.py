import datetime
import os
import pprint

from django.conf import settings
from django.http import HttpResponse, HttpResponseForbidden, JsonResponse
from django.shortcuts import render
from django.views.decorators.http import require_POST
from django.urls import reverse
from pylti1p3.contrib.django import DjangoOIDCLogin, DjangoMessageLaunch, DjangoCacheDataStorage
from pylti1p3.deep_link_resource import DeepLinkResource
from pylti1p3.grade import Grade
from pylti1p3.lineitem import LineItem
from pylti1p3.tool_config import ToolConfJsonFile
from pylti1p3.registration import Registration
import secrets
from django.views.decorators.csrf import csrf_exempt
from django.shortcuts import redirect
from .models import LTIConfig
from django.conf import settings
from pylti1p3.tool_config import ToolConfDict
from pathlib import Path
from django.http import HttpResponseRedirect
from urllib.parse import urlencode

BASE_DIR = Path(__file__).resolve().parents[2]

KEYS_DIR = BASE_DIR / 'apps' / 'lti' 
PRIVATE_KEY_PATH = KEYS_DIR / 'private.key'
PUBLIC_KEY_PATH = KEYS_DIR / 'public.key'

frontend_url = "https://onmicro.ai/"

class ExtendedDjangoOIDCLogin(DjangoOIDCLogin):
    def _generate_nonce(self) -> str:
        return secrets.token_hex(32)

class ExtendedDjangoMessageLaunch(DjangoMessageLaunch):

    def validate_nonce(self):
        iss = self.get_iss()
        deep_link_launch = self.is_deep_link_launch()
        if iss:
            return self
        return super().validate_nonce()

def get_tool_conf(request):
   tool_conf_map = {}
   for cfg in LTIConfig.objects.all():
      tool_conf_map.setdefault(cfg.issuer, []).append({
         "client_id":        cfg.client_id,
         "auth_login_url":   cfg.auth_login_url,
         "auth_token_url":   cfg.auth_token_url,
         "key_set_url":      cfg.key_set_url,
         "deployment_ids":   cfg.deployment_ids,
         "private_key_file": str(PRIVATE_KEY_PATH),             
         "public_key_file":  str(PUBLIC_KEY_PATH),
      })
   
   tool_conf = ToolConfDict(tool_conf_map)

   private_pem = PRIVATE_KEY_PATH.read_text()
   public_pem  = PUBLIC_KEY_PATH.read_text()
   for cfg in LTIConfig.objects.all():
        tool_conf.set_private_key(cfg.issuer, private_pem, client_id=cfg.client_id)
        tool_conf.set_public_key(cfg.issuer, public_pem,   client_id=cfg.client_id)

   return tool_conf

def get_jwk_from_public_key(key_name):
    key_path = os.path.join(settings.BASE_DIR, '..', 'configs', key_name)
    f = open(key_path, 'r')
    key_content = f.read()
    jwk = Registration.get_jwk(key_content)
    f.close()
    return jwk

def get_launch_data_storage():
    return DjangoCacheDataStorage()


def get_launch_url(request):
    target_link_uri = request.POST.get('target_link_uri', request.GET.get('target_link_uri'))
    if not target_link_uri:
        raise Exception('Missing "target_link_uri" param')
    return target_link_uri


def login(request):
    tool_conf = get_tool_conf(request)
    launch_data_storage = get_launch_data_storage()
    oidc_login = ExtendedDjangoOIDCLogin(request, tool_conf, launch_data_storage=launch_data_storage)
    target_link_uri = get_launch_url(request)
    return oidc_login\
        .enable_check_cookies()\
        .redirect(target_link_uri)

@csrf_exempt
@require_POST
def launch(request):
    tool_conf = get_tool_conf(request)
    launch_data_storage = get_launch_data_storage()
    message_launch = ExtendedDjangoMessageLaunch(request, tool_conf, launch_data_storage=launch_data_storage)
    try:
      ld = message_launch.get_launch_data()
      pprint.pprint(ld)
      iss = message_launch.get_iss()
      client_id = ld.get("aud")
      cfg = LTIConfig.objects.get(issuer=iss, client_id=client_id)
      lid = message_launch.get_launch_id()
      return redirect(f"{cfg.redirect_url}/?lid={lid}")
    
    except Exception as e:
      print(e)
      return redirect(frontend_url)

def get_jwks(request):
    tool_conf = get_tool_conf(request)
    return JsonResponse(tool_conf.get_jwks(), safe=False)


def configure(request, launch_id, difficulty):
    tool_conf = get_tool_conf(request)
    launch_data_storage = get_launch_data_storage()
    message_launch = ExtendedDjangoMessageLaunch.from_cache(launch_id, request, tool_conf, launch_data_storage=launch_data_storage)
    if not message_launch.is_deep_link_launch():
        return HttpResponseForbidden('Must be a deep link!')
    launch_url = request.build_absolute_uri(reverse('app-launch'))
    resource = DeepLinkResource()
    resource.set_url(launch_url)
    html = message_launch.get_deep_link().output_response_form([resource])
    return HttpResponse(html)

@csrf_exempt
@require_POST
def score(request, launch_id, earned_score, time_spent):
    tool_conf = get_tool_conf(request)
    launch_data_storage = get_launch_data_storage()
    message_launch = ExtendedDjangoMessageLaunch.from_cache(launch_id, request, tool_conf, launch_data_storage=launch_data_storage)
    resource_link_id = message_launch.get_launch_data() \
        .get('https://purl.imsglobal.org/spec/lti/claim/resource_link', {}).get('id')

    if not message_launch.has_ags():
        return HttpResponseForbidden("Don't have grades!")
    sub = message_launch.get_launch_data().get('sub')
    timestamp = datetime.datetime.utcnow().isoformat() + 'Z'
    earned_score = int(earned_score)
    time_spent = int(time_spent)

    ags = message_launch.get_ags()
    if ags.can_create_lineitem():
        sc = Grade()
        sc.set_score_given(earned_score)\
            .set_score_maximum(1)\
            .set_timestamp(timestamp)\
            .set_activity_progress('Completed')\
            .set_grading_progress('FullyGraded')\
            .set_user_id(sub)

        sc_line_item = LineItem()
        sc_line_item.set_tag('score')\
            .set_score_maximum(1)\
            .set_label('Score')
        if resource_link_id:
            sc_line_item.set_resource_id(resource_link_id)
            sc_line_item.set_resource_link_id(resource_link_id)

        result = ags.put_grade(sc, sc_line_item)
    else:
        sc = Grade()
        sc.set_score_given(earned_score) \
            .set_score_maximum(1) \
            .set_timestamp(timestamp) \
            .set_activity_progress('Completed') \
            .set_grading_progress('FullyGraded') \
            .set_user_id(sub)
        result = ags.put_grade(sc)

    return JsonResponse({'success': True, 'result': result.get('body')})
