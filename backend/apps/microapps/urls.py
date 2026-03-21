# \micro_ai\apps\microapps\urls.py
from django.urls import path
from .views import (
    # Microapp views
    MicroAppList,
    MicroAppDetails,
    MicroAppArchive,
    CloneMicroApp,
    MicroAppDetailsByHash,
    PublicMicroApps,
    PublicMicroAppsByHash,
    MicroAppVisibility,
    
    # User views
    UserMicroApps,
    UserMicroAppsDetails,
    UserApps,
    UserMicroAppsRoleByHash,
    AppAdminsView,
    
    # Run views
    RunList,
    RunDetailByUuid,
    ScoreRunList,
    AnonymousRunList,
    LiteLLMModelConfigurations,
    
    # Analytics views
    AppStatistics,
    AppConversations,
    AppConversationDetails,
    BillingDetails,
    AppQuota,
    
    # Media views
    MicroAppImageUpload,
    MicroAppFileUpload,
    MicroAppFileDelete,
    FileEmbeddingStatusView,
    ParseFile,
    AudioTranscription,
    AnonymousAudioTranscription,
    TextToSpeech,
    AnonymousTextToSpeech,
)
from .views.rubric_build_views import RubricBuildView
from .views.app_builder_views import AppBuilderChatView
from .dashboard_order_views import (
    DashboardGlobalAppOrderView,
    DashboardCollectionAppOrderView,
)

urlpatterns = [
    # Microapp management
    path('', MicroAppList.as_view(), name='microapp_list'), 
    path('<int:app_id>', MicroAppDetails.as_view(), name='microapp_details'),
    path('hash/<str:hash_id>', MicroAppDetailsByHash.as_view(), name='microapp_details_by_hash'),
    path('<int:app_id>/archive', MicroAppArchive.as_view(), name='microapp_archive'),
    path('<int:pk>/clone', CloneMicroApp.as_view(), name="clone_microapp_no_collection"),
    path('<int:pk>/<int:collection_id>/clone', CloneMicroApp.as_view(), name="clone_microapp"),
    
    # Public access
    path('public/app/<int:id>', PublicMicroApps.as_view(), name="public_microapps"),
    path('public/hash/<str:hash_id>', PublicMicroAppsByHash.as_view(), name="public_microapps_by_hash"),
    path('visibility/<str:hash_id>', MicroAppVisibility.as_view(), name="app_visibility"),
    
    # User management
    path('user', UserMicroAppsDetails.as_view(), name="users-roles"),
    path('<int:app_id>/user/<int:user_id>', UserMicroApps.as_view(), name="user-role"),
    path('hash/<str:hash_id>/user/<int:user_id>', UserMicroAppsRoleByHash.as_view(), name="user-role-by-hash"),
    path('apps', UserApps.as_view(), name="user_apps"),
    path(
        'me/dashboard-app-order/',
        DashboardGlobalAppOrderView.as_view(),
        name="dashboard_global_app_order",
    ),
    path(
        'me/collection/<int:collection_id>/app-order/',
        DashboardCollectionAppOrderView.as_view(),
        name="dashboard_collection_app_order",
    ),
    path('<int:app_id>/admins/', AppAdminsView.as_view(), name='app-admins'),
    path('<int:app_id>/admins/<int:user_id>/', AppAdminsView.as_view(), name='app-admin-detail'),
    
    # AI Model execution
    path('run', RunList.as_view(), name="run_model"),
    path('run/<str:run_uuid>/', RunDetailByUuid.as_view(), name="run_detail_by_uuid"),
    path('score', ScoreRunList.as_view(), name="score_model"),
    path('run/anonymous', AnonymousRunList.as_view(), name="anonymous_run_model"),
    path('models/litellm-configuration/', LiteLLMModelConfigurations.as_view(), name="litellm_models_configuration"),
    
    # Analytics & Statistics
    path('stats/run', AppStatistics.as_view(), name="app_stats"),
    path('stats/conversations', AppConversations.as_view(), name="app_conversations"),
    path('stats/conversation-details', AppConversationDetails.as_view(), name="conversation_details"),
    path('user/billing', BillingDetails.as_view(), name="usage_details"),
    path('quota/', AppQuota.as_view(), name='app-quota'),
    
    # File & Media processing
    path('<int:pk>/upload-image/', MicroAppImageUpload.as_view(), name='microapp-upload-image'),
    path('<int:pk>/upload-file/', MicroAppFileUpload.as_view(), name='microapp-upload-file'),
    path('<int:pk>/delete-file/', MicroAppFileDelete.as_view(), name='microapp-delete-file'),
    path('<int:pk>/file-status/', FileEmbeddingStatusView.as_view(), name='microapp-file-status'),
    path('parse-file/', ParseFile.as_view(), name='parse-file'),
    path('transcribe/', AudioTranscription.as_view(), name='audio-transcription'),
    path('transcribe/anonymous/', AnonymousAudioTranscription.as_view(), name='anonymous-audio-transcription'),
    path('tts/', TextToSpeech.as_view(), name='text-to-speech'),
    path('tts/anonymous/', AnonymousTextToSpeech.as_view(), name='anonymous-text-to-speech'),
    path('rubric-build/', RubricBuildView.as_view(), name='rubric-build'),
    path('app-builder-chat/', AppBuilderChatView.as_view(), name='app-builder-chat'),
]
