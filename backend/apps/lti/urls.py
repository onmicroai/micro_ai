from django.urls import re_path
from .views import login, launch, get_jwks, configure, score
from .api import get_lti_config, create_or_update_lti_config

urlpatterns = [
    re_path(r'^login/$', login, name='app-login'),
    re_path(r'^launch/$', launch, name='app-launch'),
    re_path(r'^jwks/$', get_jwks, name='app-jwks'),
    re_path(r'^configure/(?P<launch_id>[\w-]+)/(?P<difficulty>[\w-]+)/$', configure, name='app-configure'),
    re_path(r'^api/score/(?P<launch_id>[\w-]+)/(?P<earned_score>[\w-]+)/(?P<time_spent>[\w-]+)/$', score,
            name='app-api-score'),
    re_path(r'^api/config/(?P<microapp_id>[\w-]+)/$', get_lti_config, name='app-api-lti-config'),
    re_path(r'^api/config/$', create_or_update_lti_config, name='app-api-lti-config-create'),
]
