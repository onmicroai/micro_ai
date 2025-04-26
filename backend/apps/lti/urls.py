from django.urls import re_path
from .views import login, launch, get_jwks, configure, score

urlpatterns = [
    re_path(r'^login/$', login, name='app-login'),
    re_path(r'^launch/$', launch, name='app-launch'),
    re_path(r'^jwks/$', get_jwks, name='app-jwks'),
    re_path(r'^configure/(?P<launch_id>[\w-]+)/(?P<difficulty>[\w-]+)/$', configure, name='app-configure'),
    re_path(r'^api/score/(?P<launch_id>[\w-]+)/(?P<earned_score>[\w-]+)/(?P<time_spent>[\w-]+)/$', score,
            name='app-api-score'),
]
