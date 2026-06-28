import datetime
import logging
import os
import pprint
import jwt as pyjwt

from django.conf import settings
from django.http import HttpResponse, HttpResponseForbidden, JsonResponse
from django.shortcuts import render
from django.utils.html import escape
from django.views.decorators.http import require_POST
from django.urls import reverse
from pylti1p3.contrib.django import DjangoOIDCLogin, DjangoMessageLaunch
from pylti1p3.deep_link_resource import DeepLinkResource
from pylti1p3.grade import Grade
from pylti1p3.lineitem import LineItem
from pylti1p3.tool_config import ToolConfJsonFile
from pylti1p3.registration import Registration
from pylti1p3.tool_config import ToolConfDict
import secrets
from django.views.decorators.csrf import csrf_exempt
from django.shortcuts import redirect
from .models import LTIConfig
from .pylti_helpers import (
    LTIDjangoCookieService,
    get_launch_data_storage,
    lti_request,
)
from pathlib import Path
from django.http import HttpResponseRedirect
from urllib.parse import urlencode, urlparse
from django.contrib.auth import get_user_model
from apps.microapps.models import Microapp, MicroAppUserJoin

User = get_user_model()
logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).resolve().parents[2]

KEYS_DIR = BASE_DIR / 'apps' / 'lti' 
PRIVATE_KEY_PATH = KEYS_DIR / 'private.key'
PUBLIC_KEY_PATH = KEYS_DIR / 'public.key'

frontend_url = settings.DOMAIN + "/"

class ExtendedDjangoOIDCLogin(DjangoOIDCLogin):
    def _generate_nonce(self) -> str:
        return secrets.token_hex(32)

    def __init__(self, request, tool_config, launch_data_storage=None, **kwargs):
        django_request = lti_request(request)
        cookie_service = LTIDjangoCookieService(django_request)
        super().__init__(
            request,
            tool_config,
            cookie_service=cookie_service,
            launch_data_storage=launch_data_storage,
            **kwargs,
        )

class ExtendedDjangoMessageLaunch(DjangoMessageLaunch):
    """
    Extended LTI Message Launch with clock skew tolerance.
    Adds 60 seconds of leeway to JWT validation to handle time differences
    between the LTI consumer and this tool.
    """
    
    def __init__(self, request, tool_config, launch_data_storage=None, **kwargs):
        """
        Initialize with clock skew tolerance for JWT validation.
        Accepts all parent class arguments including session_service, cookie_service, etc.
        """
        django_request = lti_request(request, post_only=True)
        cookie_service = LTIDjangoCookieService(django_request)
        # Set JWT leeway before calling parent __init__
        self._jwt_leeway = 60  # 60 seconds of clock skew tolerance
        super().__init__(
            request,
            tool_config,
            cookie_service=cookie_service,
            launch_data_storage=launch_data_storage,
            **kwargs,
        )

    @classmethod
    def from_cache(
        cls,
        launch_id,
        request,
        tool_config,
        launch_data_storage=None,
        **kwargs,
    ):
        django_request = lti_request(request, post_only=True)
        cookie_service = LTIDjangoCookieService(django_request)
        return super().from_cache(
            launch_id,
            request,
            tool_config,
            cookie_service=cookie_service,
            launch_data_storage=launch_data_storage,
            **kwargs,
        )
    
    def _get_jwt(self, jwt_str):
        """
        Override JWT decoding to add leeway for clock skew tolerance.
        This method adds a 60-second tolerance window for 'iat', 'nbf', and 'exp' claims.
        """
        # Get the public key for verification
        jwt_parts = jwt_str.split('.')
        if len(jwt_parts) != 3:
            raise Exception('Invalid JWT format')
        
        # Decode header to get key id
        header = pyjwt.get_unverified_header(jwt_str)
        
        # Get issuer from unverified claims to fetch the right public key
        unverified_claims = pyjwt.decode(jwt_str, options={"verify_signature": False})
        iss = unverified_claims.get('iss')
        aud = unverified_claims.get('aud')
        
        # Get public key from tool config
        public_key = self._tool_config.get_public_key(iss, client_id=aud)
        
        # Decode with leeway for clock skew tolerance
        try:
            decoded = pyjwt.decode(
                jwt_str,
                public_key,
                algorithms=['RS256'],
                audience=aud,
                leeway=self._jwt_leeway  # Add 60 seconds of clock skew tolerance
            )
            return decoded
        except Exception as e:
            # If custom decode fails, fall back to parent implementation
            return super()._get_jwt(jwt_str)

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


def _lti_cookie_debug_context(request):
    lti_cookies = {
        key: value
        for key, value in request.COOKIES.items()
        if key.startswith('lti1p3-')
    }
    return {
        'is_secure': request.is_secure(),
        'x_forwarded_proto': request.META.get('HTTP_X_FORWARDED_PROTO'),
        'lti_cross_site_cookies': getattr(settings, 'LTI_CROSS_SITE_COOKIES', False),
        'lti_cookies': lti_cookies,
        'has_session_id': 'lti1p3-session-id' in request.COOKIES,
    }


def build_deep_link_response_html(deep_link, resources, return_url):
    """
    Build an auto-submitting form that POSTs the deep-link JWT back to the LMS.

    The form MUST submit inside the tool iframe (target="_self"). Canvas renders
    its deep_linking_response page in that iframe, then postMessages the parsed
    content items to window.parent (the assignment editor behind the modal).

    Using target="_parent" or "_top" replaces the assignment page itself — in
    Canvas's modal layout the tool iframe's parent *is* the top window, so
    nothing is left listening for the postMessage and the UI hangs on
    "Retrieving Content".

    A cross-site iframe POST requires the LMS to send session cookies with
    SameSite=None; Secure (see Canvas session_store.yml). Without that, Canvas
    redirects to /login instead.
    """
    if not return_url:
        raise ValueError('Missing deep_link_return_url in launch data')

    jwt_val = deep_link.get_response_jwt(resources)
    safe_url = escape(return_url)
    safe_jwt = escape(jwt_val)
    return (
        '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Returning to your course</title></head>'
        '<body><p>Inserting your app&hellip;</p>'
        f'<form id="lti13_deep_link_auto_submit" action="{safe_url}" method="POST" target="_self">'
        f'<input type="hidden" name="JWT" value="{safe_jwt}" /></form>'
        '<script type="text/javascript">document.getElementById("lti13_deep_link_auto_submit").submit();</script>'
        '</body></html>'
    )


def get_launch_url(request):
    target_link_uri = request.POST.get('target_link_uri', request.GET.get('target_link_uri'))
    if not target_link_uri:
        raise Exception('Missing "target_link_uri" param')
    return target_link_uri


@csrf_exempt
def login(request):
    # Canvas sends the OIDC login initiation as a cross-origin POST, so this
    # endpoint must be exempt from CSRF Origin checking (like launch/select).
    # Open edX uses GET here, which is why it worked without the decorator.
    tool_conf = get_tool_conf(request)
    launch_data_storage = get_launch_data_storage()
    oidc_login = ExtendedDjangoOIDCLogin(request, tool_conf, launch_data_storage=launch_data_storage)
    target_link_uri = get_launch_url(request)
    # Do not use enable_check_cookies() here: it gates on document.cookie inside the
    # cross-site Canvas iframe (sec-fetch-storage-access: none). That JS test often
    # fails even when server Set-Cookie with SameSite=None works (see LTIDjango* helpers).
    return oidc_login.disable_check_cookies().redirect(target_link_uri)

@csrf_exempt
@require_POST
def launch(request):
    tool_conf = get_tool_conf(request)
    launch_data_storage = get_launch_data_storage()
    message_launch = ExtendedDjangoMessageLaunch(request, tool_conf, launch_data_storage=launch_data_storage)
    try:
      ld = message_launch.get_launch_data()
      pprint.pprint(ld)
      lid = message_launch.get_launch_id()

      # Deep Link launch: redirect instructor to content picker.
      # Pass launch_id in the URL — Django sessions are scoped to /admin/ only
      # (SESSION_COOKIE_PATH), so a session key would not survive this redirect.
      if message_launch.is_deep_link_launch():
          picker_url = f"{reverse('app-deep-link-picker')}?launch_id={lid}"
          return redirect(picker_url)

      # Regular resource launch
      iss = message_launch.get_iss()
      client_id = ld.get("aud")

      # First, check for microapp_hash_id in custom parameters (set during deep linking)
      custom = ld.get('https://purl.imsglobal.org/spec/lti/claim/custom', {})
      microapp_hash_id = custom.get('microapp_hash_id')

      if microapp_hash_id:
          redirect_url = f"{frontend_url}app/embed/{microapp_hash_id}/?lid={lid}"
          return redirect(redirect_url)

      # Fall back to the LTIConfig.microapp association
      cfg = LTIConfig.objects.get(issuer=iss, client_id=client_id)
      if not cfg.microapp:
         raise Exception(f"No microapp associated with LTI config for issuer {iss} and client_id {client_id}")

      redirect_url = f"{frontend_url}app/embed/{cfg.microapp.hash_id}/?lid={lid}"
      return redirect(redirect_url)

    except Exception as e:
      import traceback
      cookie_ctx = _lti_cookie_debug_context(request)
      logger.error(
          'LTI launch failed: %s | cookie_context=%s',
          e,
          cookie_ctx,
          exc_info=True,
      )
      print("LTI Launch Error:")
      print(traceback.format_exc())
      print(f"Request data: {request.POST}")
      print(f"Request headers: {request.headers}")
      print(f"LTI cookie context: {cookie_ctx}")
      if 'session-id' in str(e).lower():
          return HttpResponse(
              'LTI Launch Error: session cookie missing. '
              'If you use strict privacy settings or Brave Shields, allow cookies for '
              'dev.onmicro.ai and reload. '
              f'Debug: {cookie_ctx}',
              status=500,
          )
      return HttpResponse(f"LTI Launch Error: {str(e)}", status=500)

def get_jwks(request):
    tool_conf = get_tool_conf(request)
    return JsonResponse(tool_conf.get_jwks(), safe=False)


def canvas_config(request):
    """
    Returns the LTI 1.3 (LTI Advantage) tool configuration JSON used to create a
    Canvas Developer Key. A Canvas admin can paste the URL of this endpoint (or
    its JSON) into the "LTI Advantage Services" Developer Key form. It declares
    the OIDC/launch/JWKS endpoints, the AGS scopes needed for grade passback, and
    deep-linking placements so instructors can insert OnMicro apps from within
    Canvas (Rich Content Editor, assignment, and module/link pickers).
    """
    login_url = request.build_absolute_uri(reverse('app-login'))
    launch_url = request.build_absolute_uri(reverse('app-launch'))
    jwks_url = request.build_absolute_uri(reverse('app-jwks'))

    # Canvas matches a tool by its domain; derive it from the configured domain.
    domain = urlparse(settings.DOMAIN).netloc or settings.DOMAIN

    deep_linking_placements = ['link_selection', 'assignment_selection', 'editor_button']
    placements = [
        {
            'placement': placement,
            'message_type': 'LtiDeepLinkingRequest',
            'target_link_uri': launch_url,
        }
        for placement in deep_linking_placements
    ]

    config = {
        'title': 'OnMicro.AI',
        'description': 'Insert OnMicro.AI apps into your course.',
        'oidc_initiation_url': login_url,
        'target_link_uri': launch_url,
        'public_jwk_url': jwks_url,
        'scopes': [
            'https://purl.imsglobal.org/spec/lti-ags/scope/lineitem',
            'https://purl.imsglobal.org/spec/lti-ags/scope/result.readonly',
            'https://purl.imsglobal.org/spec/lti-ags/scope/score',
        ],
        'extensions': [
            {
                'domain': domain,
                'platform': 'canvas.instructure.com',
                # "public" so the launch includes the user's email, which is used
                # to match the instructor to their OnMicro account in the picker.
                'privacy_level': 'public',
                'settings': {
                    'placements': placements,
                },
            }
        ],
        'custom_fields': {},
    }

    return JsonResponse(config)


def _restore_message_launch_from_cache(request, launch_id, tool_conf):
    launch_data_storage = get_launch_data_storage()
    try:
        return ExtendedDjangoMessageLaunch.from_cache(
            launch_id, request, tool_conf, launch_data_storage=launch_data_storage
        )
    except Exception as e:
        logger.exception(
            'LTI from_cache failed launch_id=%s cookie_context=%s',
            launch_id,
            _lti_cookie_debug_context(request),
        )
        if settings.DEBUG:
            raise RuntimeError(
                f'Deep link restore failed: {e}. '
                'Confirm micro_ai_django_cache exists (manage.py createcachetable).'
            ) from e
        raise


def deep_link_picker(request):
    """
    Content picker page for LTI Deep Linking.
    Shows the instructor's microapps so they can select one to link in the LMS.
    """
    launch_id = request.GET.get('launch_id')
    if not launch_id:
        return HttpResponse('Deep link session expired. Please try again from your LMS.', status=400)

    tool_conf = get_tool_conf(request)

    try:
        message_launch = _restore_message_launch_from_cache(request, launch_id, tool_conf)
    except RuntimeError as e:
        return HttpResponse(str(e), status=400)
    except Exception:
        return HttpResponse('Deep link session expired. Please try again from your LMS.', status=400)

    if not message_launch.is_deep_link_launch():
        return HttpResponseForbidden('Must be a deep link launch.')

    # Extract instructor email from LTI launch data
    ld = message_launch.get_launch_data()
    email = ld.get('email', '')

    microapps = []
    error_message = ''

    if email:
        try:
            user = User.objects.get(email__iexact=email)
            app_ids = MicroAppUserJoin.objects.filter(
                user_id=user, is_archived=False
            ).values_list('ma_id', flat=True)
            microapps = list(
                Microapp.objects.filter(id__in=app_ids, is_archived=False)
                .order_by('title')
                .values('hash_id', 'title', 'explanation')
            )
        except User.DoesNotExist:
            error_message = (
                f'No MicroAI account found for {email}. '
                'Please make sure you have an account with the same email as your LMS.'
            )
    else:
        error_message = 'Your LMS did not provide an email address. Cannot match to a MicroAI account.'

    if not microapps and not error_message:
        error_message = 'You don\'t have any microapps yet. Create one first, then return here to link it.'

    return render(request, 'lti/deep_link_picker.html', {
        'microapps': microapps,
        'error_message': error_message,
        'launch_id': launch_id,
    })


@csrf_exempt
@require_POST
def deep_link_select(request):
    """
    Handles the instructor's microapp selection and sends the Deep Link response back to the LMS.
    """
    launch_id = request.POST.get('launch_id')
    microapp_hash_id = request.POST.get('microapp_hash_id')

    if not launch_id or not microapp_hash_id:
        return HttpResponse('Invalid request. Please try again from your LMS.', status=400)

    tool_conf = get_tool_conf(request)

    try:
        message_launch = _restore_message_launch_from_cache(request, launch_id, tool_conf)
    except RuntimeError as e:
        return HttpResponse(str(e), status=400)
    except Exception:
        return HttpResponse('Deep link session expired. Please try again from your LMS.', status=400)

    if not message_launch.is_deep_link_launch():
        return HttpResponseForbidden('Must be a deep link launch.')

    # Look up the selected microapp for its title
    try:
        microapp = Microapp.objects.get(hash_id=microapp_hash_id)
    except Microapp.DoesNotExist:
        return HttpResponse('Selected microapp not found.', status=404)

    # Build the Deep Link resource
    launch_url = request.build_absolute_uri(reverse('app-launch'))
    resource = DeepLinkResource()
    resource.set_url(launch_url)
    resource.set_title(microapp.title)
    resource.set_custom_params({'microapp_hash_id': microapp.hash_id})

    # Attach a line item so the LMS (e.g. Canvas) creates a gradable column
    # tied to this resource. Score passback in score() uses the same maximum.
    line_item = LineItem()
    line_item.set_score_maximum(1)\
        .set_label(microapp.title)\
        .set_tag('score')
    resource.set_lineitem(line_item)

    ld = message_launch.get_launch_data()
    dl_settings = ld.get('https://purl.imsglobal.org/spec/lti-dl/claim/deep_linking_settings', {})
    return_url = dl_settings.get('deep_link_return_url')
    if not return_url:
        return HttpResponse('Missing deep link return URL in launch data.', status=400)

    # POST the JWT back to Canvas inside the tool iframe (see build_deep_link_response_html).
    html = build_deep_link_response_html(message_launch.get_deep_link(), [resource], return_url)

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
