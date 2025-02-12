# views.py
from django.http import HttpResponse, HttpResponseRedirect
from django.views.decorators.csrf import csrf_exempt
from django.shortcuts import render
from pylti1p3.contrib.django import DjangoOIDCLogin, DjangoMessageLaunch
from pylti1p3.tool_config import ToolConfDict
from pylti1p3.registration import Registration
from django.urls import reverse
import logging

logger = logging.getLogger(__name__)

def get_tool_conf():
    config = {
    "http://local.overhang.io": {
        "client_id": "6c48e56e-75e3-4c86-b632-6ce039e01a39",
        "auth_login_url": "http://local.overhang.io/api/lti_consumer/v1/launch/",
        "auth_token_url": "http://local.overhang.io/api/lti_consumer/v1/token/268d5c3a-cf23-4019-82c1-36502abf4082",
        "key_set_url": "http://local.overhang.io/api/lti_consumer/v1/public_keysets/268d5c3a-cf23-4019-82c1-36502abf4082",
        "deployment_ids": ["1"],
        "private_key_file": "private.key",
        "public_key_file": "public.key",
        }
    }
    return ToolConfDict(config)
    
@csrf_exempt
def lti_login(request):
    try:
        # Log the incoming request parameters
        logger.error("LTI Login Request Parameters: %s", request.GET.dict())
        
        # Get the launch URL from the request
        launch_url = request.GET.get('target_link_uri')
        if not launch_url:
            launch_url = request.build_absolute_uri(reverse('lti_launch'))

        logger.error("Redirect URL: %s", launch_url)
        
        tool_conf = get_tool_conf()
        oidc_login = DjangoOIDCLogin(request, tool_conf)
        
        oidc_login.enable_check_cookies()

        redirect = oidc_login.redirect(launch_url)
            
        logger.error("Redirecting to OIDC authentication")
        return redirect

    
    except Exception as e:
        logger.error("LTI login error: %s", str(e), exc_info=True)
        return HttpResponse(f'Error during login: {str(e)}', status=403)

@csrf_exempt
def lti_launch(request):
    try:
        # Log the incoming request parameters
        logger.error("LTI Launch Request Parameters: %s", request.POST.dict())
        
        tool_conf = get_tool_conf()
        message_launch = DjangoMessageLaunch(request, tool_conf)
        
        message_launch_data = message_launch.validate()
        logger.error("Launch data validated successfully")
        
        # Get some basic user data from the LTI launch
        user_data = {
            'name': message_launch_data.get('name', 'Unknown User'),
            'email': message_launch_data.get('email', 'No email provided'),
            'role': message_launch_data.get('https://purl.imsglobal.org/spec/lti/claim/roles', []),
            'context_title': message_launch_data.get('https://purl.imsglobal.org/spec/lti/claim/context', {}).get('title', 'Unknown Course')
        }
        
        # Store the launch data in session
        request.session['lti_launch_data'] = user_data
        logger.error("User data stored in session: %s", user_data)
        
        return render(request, 'lti/launch.html', {
            'user_data': user_data
        })
    
    except Exception as e:
        logger.error("LTI launch error: %s", str(e), exc_info=True)
        return HttpResponse(f'Error during launch: {str(e)}', status=403)