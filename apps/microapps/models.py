from django.db import models
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

def handle_exception(e):
    log.error(e)
    return Response(
        error.SERVER_ERROR,
        status=status.HTTP_500_INTERNAL_SERVER_ERROR,
    )

def handle_functional_exception(e):
    log.error(e)

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
    
    # The app-wide default temperature for randomness in output generation (0.0 to 1.0)
    # Temperature is a parameter that controls the randomness of the output. 
    # This can be overridden by the paramater on each prompt field. 
    temperature = models.FloatField(default = 1)
    
    # The app-wide default AI model used by the microapp (e.g. gpt-4o-mini, claude-3-opus, etc.)
    # This can be overridden by the paramater on each prompt field. 
    ai_model = models.CharField(max_length = 50, default = MicroappVariables.DEFAULT_MICROAPP_AI_MODEL)
    
    # The app-wide default cumulative probability cutoff for token selection
    # Top_p is a parameter that controls the randomness of the output. 
    # This can be overridden by the paramater on each prompt field. 
    top_p = models.FloatField(default = 1)
    
    # The app-wide default frequency penalty for repeating the same line verbatim (0.0 to 2.0)
    # Frequency penalty is a parameter that controls the likelihood of the model repeating the same line verbatim. 
    # A high frequency penalty reduces redundancy by making the AI less likely to repeat the same words or phrases. This encourages more variety in the generated output.
    # A low frequency penalty (or a value of zero) increases the likelihood of redundancy because the model isn't discouraged from repeating words or phrases it has already used.
    # This can be overridden by the paramater on each prompt field. 
    frequency_penalty = models.FloatField(default = 0)
    
    # The app-wide default presence penalty for increasing the model's likelihood to talk about new topics (0.0 to 2.0)
    # Presence penalty is a parameter that controls the likelihood of the model talking about new topics. 
    # A high presence penalty reduces the likelihood of the model talking about new topics by making the AI less likely to repeat the same words or phrases. This encourages more variety in the generated output.
    # A low presence penalty (or a value of zero) increases the likelihood of the model talking about new topics because the model isn't discouraged from repeating words or phrases it has already used.
    # This can be overridden by the paramater on each prompt field. 
    presence_penalty = models.FloatField(default = 0)
    
    # Indicates whether this microapp can be cloned (copied) by other users.
    copy_allowed = models.BooleanField(default = True)
    
    # Stores the majority of the configuration for the microapp in JSON format  
    # This field can get quite large with large and complex apps, or apps that include objects that are converted to long base64 strings.   
    app_json = models.JSONField()

    # Add this new field
    is_archived = models.BooleanField(default=False)
    
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
    session_id = models.TextField(blank=True)

    # The user-reported satisfaction of the run. -1 is negative, 1 is positive. 
    satisfaction = models.IntegerField()

    # The final text prompt sent to AI. 

    system_prompt = models.JSONField()
    
    phase_instructions = models.JSONField()
    
    user_prompt = models.JSONField()

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
    temperature = models.FloatField()

    # The max_tokens value sent for the run. 
    # Max tokens is a parameter that controls the maximum number of tokens allowed in the output. 
    # It includes the number of input and output tokens, collectively. 
    # Smaller values result in shorter outputs, while larger values allow for longer outputs.   
    max_tokens = models.IntegerField()

    # The top_p value sent for the run. 
    # Top_p is a parameter that controls the randomness of the output. 
    # It is used to determine the probability distribution from which tokens are selected for the output. 
    # A value of 0.5 means that the AI model will select tokens with a probability of 50%, while a value of 1.0 means that the AI model will select tokens with a probability of 100%. 
    # Lower values make the output more deterministic, while higher values make the output more random. 
    top_p = models.FloatField()

    # The frequency_penalty value sent for the run.     
    # Frequency penalty is a parameter that controls the likelihood of the model repeating the same line verbatim. 
    # A high frequency penalty reduces redundancy by making the AI less likely to repeat the same words or phrases. This encourages more variety in the generated output.
    # A low frequency penalty (or a value of zero) increases the likelihood of redundancy because the model isn't discouraged from repeating words or phrases it has already used.
    frequency_penalty = models.FloatField()

    # The presence_penalty value sent for the run. 
    # Presence penalty is a parameter that controls the likelihood of the model talking about new topics. 
    # A high presence penalty reduces the likelihood of the model talking about new topics by making the AI less likely to repeat the same words or phrases. This encourages more variety in the generated output.
    # A low presence penalty (or a value of zero) increases the likelihood of the model talking about new topics because the model isn't discouraged from repeating words or phrases it has already used.
    presence_penalty = models.FloatField()

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
    
    response_type = models.CharField(max_length = 20, default = MicroappVariables.DEFAULT_RESPONSE_TYPE, choices = RESPONSE_TYPE)

    def __str__(self):
        return self.ai_model