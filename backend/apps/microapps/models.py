from django.db import models
from django.db.models import Case, F, IntegerField, Value, When
from pgvector.django import VectorField
from micro_ai import settings
import logging as log
from rest_framework.response import Response
from apps.utils.custom_error_message import ErrorMessages as error
from rest_framework import status
from apps.utils.global_variables import MicroappVariables
import openai
from openai import OpenAI
import google.generativeai as genai
from anthropic import Anthropic
import re
import environ
import os
from pathlib import Path
import uuid
BASE_DIR = Path(__file__).resolve().parent.parent
env = environ.Env()
env.read_env(os.path.join(BASE_DIR, ".env"))
from django.db import transaction
from django.utils import timezone

def handle_exception(e):
    log.error(e)
    return Response(
        error.SERVER_ERROR,
        status=status.HTTP_500_INTERNAL_SERVER_ERROR,
    )

def handle_functional_exception(e):
    log.error(e)

class MicroappQuerySet(models.QuerySet):
    PROMO_PRIORITY_UNSET_SORT = 999999

    def order_by_promo_priority(self):
        """Priority 1 first, then 2, etc. Priority 0 is treated as unset and sorts last."""
        return self.annotate(
            _promo_sort=Case(
                When(promo_priority=0, then=Value(self.PROMO_PRIORITY_UNSET_SORT)),
                default=F("promo_priority"),
                output_field=IntegerField(),
            )
        ).order_by("_promo_sort", "title")


class Microapp(models.Model):

    PUBLIC = 'public'
    PRIVATE = 'private'
    RESTRICTED = 'restricted'

    APP_PRIVACY = [
        (PUBLIC, 'public'),
        (PRIVATE, 'private'),
        (RESTRICTED, 'restricted')
    ]

    # The name of the microapp, shown on dashboard and the top of the app. 
    title = models.CharField(max_length = 150, default = MicroappVariables.DEFAULT_MICROAPP_NAME)
    
    # A user-facing description of what the app does. 
    # (e.g. "This app allows you to generate customized multiple choice questions for your students.")
    explanation = models.TextField(blank = True, default = "")
    
    # public, private, or restricted. 
    # Public apps can be shared by link and utilized by any user, even without logging in. 
    # Private apps can only be accessed by logged in owners and admins. 
    # Restricted apps are restricted by the domain, and can only be run within iFrames on approved domains. 
    privacy = models.CharField(max_length = 50, default = MicroappVariables.DEFAULT_MICROAPP_PRIVACY, choices = APP_PRIVACY)

    # For restricted apps: list of permitted hostnames where the embed can be rendered (e.g. ["example.com", "blog.example.com"])
    permitted_domains = models.JSONField(default=list, blank=True)
    
    # The app-wide default temperature for randomness in output generation (0.0 to 1.0)
    # Temperature is a parameter that controls the randomness of the output. 
    # This can be overridden by the paramater on each prompt field. 
    temperature = models.FloatField(default = 1)
    
    # The app-wide default AI model used by the microapp (e.g. gpt-4o-mini, claude-3-opus, etc.)
    # This can be overridden by the paramater on each prompt field. 
    ai_model = models.CharField(max_length = 50, default = env("DEFAULT_AI_MODEL"))
    
    
    
    # Indicates whether this microapp can be cloned (copied) by other users.
    copy_allowed = models.BooleanField(default = True)
    
    # Stores the majority of the configuration for the microapp in JSON format  
    # This field can get quite large with large and complex apps, or apps that include objects that are converted to long base64 strings.   
    app_json = models.JSONField()

    # Published rubric snapshot for analytics (new runs can point here via Run.rubric_version)
    active_rubric_version = models.ForeignKey(
        "RubricVersion",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="apps_as_active",
    )

    # Add this new field
    is_archived = models.BooleanField(default=False)

    # Shown on home page and public library when true (admin-only; lower promo_priority first, 0 = unset/last)
    is_promoted = models.BooleanField(default=False)
    promo_priority = models.PositiveIntegerField(default=0)

    objects = MicroappQuerySet.as_manager()
    
    # A unique hash identifier for the microapp
    # This is automatically generated when the app is created
    hash_id = models.CharField(max_length=50, unique=True, blank=True)
    
    def save(self, *args, **kwargs):
        if not self.hash_id:
            while True:
                candidate = str(uuid.uuid4())[:16]
                if not Microapp.objects.filter(hash_id=candidate).exists():
                    self.hash_id = candidate
                    break
        super().save(*args, **kwargs)

    def archive(self):
        with transaction.atomic():
            self.is_archived = True
            self.save()
            MicroAppUserJoin.objects.filter(ma_id=self.id).update(is_archived=True)

    def unarchive(self):
        with transaction.atomic():
            self.is_archived = False
            self.save()
            MicroAppUserJoin.objects.filter(ma_id=self.id).update(is_archived=False)

    def __str__(self):
        return self.title


class RubricVersion(models.Model):
    """Immutable rubric + scoring layout snapshot; runs link here for version-aware score analysis."""

    ma_id = models.ForeignKey(
        Microapp, on_delete=models.CASCADE, related_name="rubric_versions"
    )
    version_number = models.PositiveIntegerField()
    label = models.CharField(max_length=200, blank=True, default="")
    definition_json = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [("ma_id", "version_number")]

    def __str__(self):
        return f"RubricVersion(ma={self.ma_id_id}, v={self.version_number})"


class ScoreAnalysisSnapshot(models.Model):
    """
    Cached output of build_score_analysis_payload for a rubric version.
    Invalidated when matching scored runs change or insight LLM settings change.
    """

    rubric_version = models.OneToOneField(
        RubricVersion,
        on_delete=models.CASCADE,
        related_name="score_analysis_snapshot",
    )
    source_fingerprint = models.CharField(max_length=512)
    payload_json = models.JSONField()
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"ScoreAnalysisSnapshot(rv={self.rubric_version_id})"


class MicroAppUserJoin(models.Model):
    ADMIN = 'admin'
    OWNER = 'owner'

    ROLE_CHOICES = [
        (ADMIN, 'Admin'),
        (OWNER, 'Owner')
    ]

    ma_id = models.ForeignKey(Microapp, on_delete = models.CASCADE)
    user_id = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete = models.CASCADE)
    role = models.CharField(max_length = 10, choices = ROLE_CHOICES)
    counts_toward_max = models.BooleanField(default = False)
    is_archived = models.BooleanField(default = False)

    def __str__(self):
        return f"{self.user_id} {self.role}"
    
    def archive(self):
        self.is_archived = True
        self.save()

    def unarchive(self):
        self.is_archived = False
        self.save()

class Asset(models.Model):
    file = models.TextField()
    label = models.TextField()

class AssetsMaJoin(models.Model):
    ma_id = models.ForeignKey(Microapp, on_delete=models.CASCADE)
    asset_id = models.ForeignKey(Asset, on_delete=models.CASCADE)

class Run(models.Model):

    RESPONSE_TYPE = [
        ("AI", "AI"),
        ("Error", "Error"),
        ("Fixed_Response", "Fixed Response")
    ]

    # A run is a single instance of a user submitting a prompt to an AI model and receiving a response. 
    # Except in cases or hard-coding or skipping the submission of a promt, in which case a run is stores all the same information, but there is not AI prompt or response. 
    
    # The ID of the microapp that the run belongs to. 
    # Every run should be associated with a microapp. 
    ma_id = models.ForeignKey(Microapp, on_delete=models.CASCADE, blank=True, null=True)

    # A unique identifier generated by the frontend for tracking runs
    # This field is unique when not null, but null values are allowed
    run_uuid = models.CharField(max_length=36, unique=True, null=True, blank=True)

    # The ID of the user that is requesting the run. 
    # If a user is not logged in, then the user_id is set to None.  
    # TO-DO: This might be a security issue, if some users can glean other users' usernames or run patterns. Especially users that are not in their org. 
    user_id = models.ForeignKey(settings.AUTH_USER_MODEL, related_name = "user_runs", on_delete=models.CASCADE, blank=True, null=True)

    # The timestamp of the run. Generated by the backend when the run is created. . 
    timestamp = models.DateTimeField(auto_now_add=True)

    # The updated timestamp of the run.
    updated_at = models.DateTimeField(auto_now=True)

    # The session ID of the run. Session IDs are randomly generated and used to group a series of a user's runs as they navigate through an app. 
    # If a run is not associated with a session, then the session_id is created by the backend.
    # A user's runs should be tracked to the same session_id as they go through the app. Session_ids are reset when the user "restarts" the app, like when they refresh the page, or exit and return. 
    session_id = models.TextField(blank=True, db_index=True)

    # The user-reported satisfaction of the run. -1 is negative, 1 is positive. 
    satisfaction = models.IntegerField()

    # The final text prompt sent to AI. 

    system_prompt = models.JSONField()
    
    phase_instructions = models.JSONField()

    # Survey phase title at run time (e.g. chat phase label in analytics / conversation details).
    phase_title = models.CharField(max_length=255, blank=True, default="")
    # True when this run originates from the chat component.
    is_chat_run = models.BooleanField(default=False)

    # True when the run is from builder "Preview" (owner/admin test); excluded from stats aggregates.
    is_preview = models.BooleanField(default=False)

    rubric_version = models.ForeignKey(
        "RubricVersion",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="runs",
    )

    user_prompt = models.JSONField()

    # Exact messages array sent to the LLM (after model formatting and RAG injection).
    api_messages = models.JSONField(default=list, blank=True)

    # The chat response from the AI for the run. Or, a static response if no_submission or skipped_run is true. 
    response = models.TextField(blank=True)

    # The credits of the run. 
    # credits = models.FloatField()

    # The cost in USD the run. 
    # Calculated by the backend by multiplying the number of input and output tokens by the price per 1M input and output tokens for the AI model. 
    cost = models.DecimalField(max_digits=20, decimal_places=6)

    # The number of credits used for the run. 
    # Calculated by the backend by dividing the cost by the price per credit. 
    credits = models.IntegerField()

    # If true, then no prompt is sent to AI. Typically, this is used when the response is defined in the microapp. 
    no_submission = models.BooleanField()

    # The AI model used for the run. (e.g. gpt-4o-mini, claude-3-opus, etc.)
    ai_model = models.CharField(max_length=50)
    
    # The temperature of the run. 
    # Temperature is a parameter that controls the randomness of the output. 
    temperature = models.FloatField(null=True, blank=True)

    # The max_tokens value sent for the run. 
    # Max tokens is a parameter that controls the maximum number of tokens allowed in the output. 
    # It includes the number of input and output tokens, collectively. 
    # Smaller values result in shorter outputs, while larger values allow for longer outputs.   
    max_tokens = models.IntegerField()



    # The number of input tokens used for the run. This data is returned from the AI model. 
    # Input tokens are the tokens in the input prompt that the AI model uses to generate the output. 
    input_tokens = models.IntegerField()

    # The number of output tokens used for the run. This data is returned from the AI model. 
    # Output tokens are the tokens in the output response that the AI model generates. 
    output_tokens = models.IntegerField()

    # If true, then the run is scored by the AI model. 
    # Scored runs send special requests for a score returned in JSON format from the model. There is special logic to handle the sending and receiving of these scoring requests. 
    # See the RunList view Post method for more details.    
    scored_run = models.BooleanField()

    # The JSON score of the run, returned from the AI model. 
    # The JSON score is structured as a dictionary with keys for each criteria in the rubric, and a 'total' key with the sum of all the scores of all criteria. 
    # In additional logic, the total score is parsed from this JSON to determine if a user passed the phase. 
    run_score = models.JSONField()

    # The minimum score required to pass the run. 
    # This value is defined by the app creator at the phase level.  
    # The total score is parsed from the run_score and compared to this minimum_Score. 
    minimum_score = models.FloatField()

    # The rubric used to score the run. 
    # The app creator defines this rubric at the phase level, and it is sent to the AI model as part of the special scoring request prompt. 
    rubric = models.TextField()

    # If true, then the run is passed. 
    # Backend determines this value by parsing the run_score and comparing it to the minimum_score.     
    run_passed = models.BooleanField(default=True)

    # The user is requesting to skip this phase. 
    # The user sends a skip request to the backend. Backend performs special logic with a skip request to skip the phase and pass the user if the phase is scored. 
    request_skip = models.BooleanField(default=False)

    # The owner ID of the app, at the time of the run. 
    # Since we "charge" all usage to the owners of apps, it is important to know this field. 
    # Backend determines this value by looking up owner_id based on the ma_id at the time of the run. 
    owner_id = models.ForeignKey(settings.AUTH_USER_MODEL, related_name = "ma_owner_runs", on_delete=models.CASCADE, blank=True, null=True)

    # The user IP of the run.   
    # For tracking usage limits on non-logged in users. 
    #TO-DO: Is IP the best/most secure way to track this? 
    user_ip = models.CharField(max_length=20, blank=True)

    app_hash_id = models.CharField(max_length=50, blank=True)
    
    # The LiteLLM response ID for tracking API calls
    litellm_response_id = models.CharField(max_length=255, blank=True, null=True)
    
    response_type = models.CharField(max_length = 20, default = MicroappVariables.DEFAULT_RESPONSE_TYPE, choices = RESPONSE_TYPE)

    class Meta:
        indexes = [
            models.Index(fields=['ma_id', 'session_id'], name='run_ma_session_idx'),
            models.Index(
                fields=['ma_id', 'rubric_version', 'is_preview', 'scored_run'],
                name='run_ma_rv_preview_scored_idx',
            ),
        ]

    def __str__(self):
        return self.ai_model


class AppUsageSession(models.Model):
    """Tracks runtime session duration for a microapp (including no-run sessions)."""

    SOURCE_CHOICES = [
        ("app", "app"),
        ("preview", "preview"),
        ("embed", "embed"),
    ]

    ma_id = models.ForeignKey(Microapp, on_delete=models.CASCADE, related_name="usage_sessions")
    user_id = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="app_usage_sessions",
    )
    session_id = models.UUIDField(db_index=True)
    source = models.CharField(max_length=20, choices=SOURCE_CHOICES, default="app")
    started_at = models.DateTimeField(auto_now_add=True)
    last_seen_at = models.DateTimeField(default=timezone.now)
    ended_at = models.DateTimeField(null=True, blank=True)
    user_ip = models.CharField(max_length=64, blank=True, default="")

    class Meta:
        indexes = [
            models.Index(fields=["ma_id", "session_id"], name="usage_ma_session_idx"),
            models.Index(fields=["ma_id", "started_at"], name="usage_ma_started_idx"),
        ]

    def __str__(self):
        return f"usage:{self.ma_id_id}:{self.session_id}"


class AppThemeSnapshot(models.Model):
    """Daily generated AI themes summarizing app conversations."""

    STATUS_CHOICES = [
        ("success", "success"),
        ("failed", "failed"),
    ]

    ma_id = models.ForeignKey(Microapp, on_delete=models.CASCADE, related_name="theme_snapshots")
    generated_at = models.DateTimeField(auto_now_add=True)
    source_window_start = models.DateTimeField(null=True, blank=True)
    source_window_end = models.DateTimeField(null=True, blank=True)
    conversation_count_used = models.IntegerField(default=0)
    themes_json = models.JSONField(default=list, blank=True)
    model_used = models.CharField(max_length=100, default="gpt-4o-mini")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="success")
    error_message = models.TextField(blank=True, default="")

    class Meta:
        indexes = [
            models.Index(fields=["ma_id", "generated_at"], name="theme_ma_generated_idx"),
            models.Index(fields=["status", "generated_at"], name="theme_status_generated_idx"),
        ]

    def __str__(self):
        return f"themes:{self.ma_id_id}:{self.generated_at.isoformat()}"


class RubricBuild(models.Model):
    """
    Log for rubric generation via AI.
    """
    microapp = models.ForeignKey(Microapp, on_delete=models.CASCADE, blank=True, null=True)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)
    rubric_prompt = models.TextField(blank=True, default="") # The prompt used to generate the rubric
    files = models.JSONField(default=list)  # List of file names
    rubric = models.TextField()  # AI-generated rubric as a JSON string
    credits_spent = models.IntegerField()  
    model_used = models.CharField(max_length=50)
    app_hash_id = models.CharField(max_length=50, blank=True)  
    user_ip = models.CharField(max_length=20, blank=True) 

    def __str__(self):
        return f"RubricBuild {self.id} ({self.model_used})"


class FileSource(models.Model):
    """
    Represents one uploaded and embedded file.
    Chunks belong to a FileSource, not directly to an app — allowing shared
    references across cloned apps without duplicating vector data.
    """

    PENDING = 'pending'
    PROCESSING = 'processing'
    READY = 'ready'
    FAILED = 'failed'
    STATUS_CHOICES = [
        (PENDING, 'Pending'),
        (PROCESSING, 'Processing'),
        (READY, 'Ready'),
        (FAILED, 'Failed'),
    ]

    file_name = models.CharField(max_length=255)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=PENDING)
    error = models.TextField(null=True, blank=True)
    chunk_count = models.IntegerField(null=True, blank=True)
    word_count = models.IntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # Tracks which app originally uploaded this file.
    # Useful if file download is ever implemented — only the owner can download.
    file_owner = models.ForeignKey(
        Microapp, on_delete=models.SET_NULL, null=True, blank=True, related_name='owned_sources'
    )

    def __str__(self):
        return f"{self.file_name} [{self.status}]"


class AppFileReference(models.Model):
    """
    Join table linking apps to file sources.
    Clone  → insert new rows here (no chunk duplication).
    Delete → remove the row; prune orphaned FileSource records periodically.
    """

    app = models.ForeignKey(Microapp, on_delete=models.CASCADE, related_name='file_references')
    file_source = models.ForeignKey(FileSource, on_delete=models.CASCADE, related_name='app_references')
    added_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [('app', 'file_source')]

    def __str__(self):
        return f"App {self.app_id} → {self.file_source.file_name}"


class DocumentChunk(models.Model):
    """One chunk of a FileSource with its embedding. Shared across all apps that reference the same FileSource."""

    file_source = models.ForeignKey(FileSource, on_delete=models.CASCADE, related_name='chunks')
    content = models.TextField()
    embedding = VectorField(dimensions=1536, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [models.Index(fields=['file_source'])]
        ordering = ['file_source', 'id']

    def __str__(self):
        return f"{self.file_source.file_name} chunk {self.id}"
class UserDashboardAppOrder(models.Model):
    """Per-user ordering on dashboard for All / My apps / Shared with me (global scope)."""

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    ma = models.ForeignKey(Microapp, on_delete=models.CASCADE)
    sort_index = models.PositiveIntegerField()

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["user", "ma"],
                name="uniq_user_dashboard_app_order",
            ),
        ]
        ordering = ["sort_index", "ma_id"]

    def __str__(self):
        return f"{self.user_id} #{self.sort_index} app {self.ma_id_id}"


class UserCollectionAppOrder(models.Model):
    """Per-user ordering of apps when viewing a specific collection on the dashboard."""

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    collection = models.ForeignKey(
        "collection.Collection", on_delete=models.CASCADE
    )
    ma = models.ForeignKey(Microapp, on_delete=models.CASCADE)
    sort_index = models.PositiveIntegerField()

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["user", "collection", "ma"],
                name="uniq_user_collection_dashboard_app_order",
            ),
        ]
        ordering = ["sort_index", "ma_id"]

    def __str__(self):
        return f"{self.user_id} coll {self.collection_id} #{self.sort_index}"
