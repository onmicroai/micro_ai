# \micro_ai\apps\microapps\urls.py
from django.urls import path
from . import views

urlpatterns = [
    path('', views.MicroAppList.as_view(), name='microapp_list'), 
    path('<int:app_id>', views.MicroAppDetails.as_view(), name='microapp_details'),
    path('hash/<str:hash_id>', views.MicroAppDetailsByHash.as_view(), name='microapp_details_by_hash'),
    path('<int:app_id>/archive', views.MicroAppArchive.as_view(), name='microapp_archive'),
    path('<int:pk>/clone', views.CloneMicroApp.as_view(), name="clone_microapp_no_collection"),
    path('<int:pk>/<int:collection_id>/clone', views.CloneMicroApp.as_view(), name="clone_microapp"),
    path('user', views.UserMicroAppsDetails.as_view(), name="users-roles"),
    # path('app/<int:app_id>', views.UserMicroAppList.as_view(), name="users-roles"),
    path('<int:app_id>/user/<int:user_id>', views.UserMicroApps.as_view(), name="user-role"),
    path('hash/<str:hash_id>/user/<int:user_id>', views.UserMicroAppsRoleByHash.as_view(), name="user-role-by-hash"),
    path('apps', views.UserApps.as_view(), name = "user_apps"),
    path('run', views.RunList.as_view(), name="run_model"),
    path('run/anonymous', views.AnonymousRunList.as_view(), name="anonymous_run_model"),
    path('models/configuration/', views.AIModelConfigurations.as_view(), name="models_configuration"),
    path('public/app/<int:id>', views.PublicMicroApps.as_view(), name = "public_microapps"),
    path('public/hash/<str:hash_id>', views.PublicMicroAppsByHash.as_view(), name = "public_microapps_by_hash"),
    path('visibility/<str:hash_id>', views.MicroAppVisibility.as_view(), name="app_visibility"),
    path('stats/run', views.AppStatistics.as_view(), name="app_stats"),
    path('stats/conversations', views.AppConversations.as_view(), name="app_conversations"),
    path('stats/conversation-details', views.AppConversationDetails.as_view(), name="conversation_details"),
    path('user/billing', views.BillingDetails.as_view(), name = "usage_details"),
    path('quota/', views.AppQuota.as_view(), name='app-quota'),
    path('<int:pk>/upload-image/', views.MicroAppImageUpload.as_view(), name='microapp-upload-image'),
    path('<int:pk>/upload-file/', views.MicroAppFileUpload.as_view(), name='microapp-upload-file'),
    path('transcribe/', views.AudioTranscription.as_view(), name='audio-transcription'),
    path('transcribe/anonymous/', views.AnonymousAudioTranscription.as_view(), name='anonymous-audio-transcription'),
    path('tts/', views.TextToSpeech.as_view(), name='text-to-speech'),
]
