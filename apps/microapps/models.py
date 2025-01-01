# \micro_ai\apps\microapps\models.py

from django.db import models
from micro_ai import settings
import logging as log
from rest_framework.response import Response
from apps.utils.custom_error_message import ErrorMessages as error
from rest_framework import status
from apps.utils.global_varibales import AIModelVariables, MicroappVariables
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


def handle_exception(e):
    log.error(e)
    return Response(
        error.SERVER_ERROR,
        status=status.HTTP_500_INTERNAL_SERVER_ERROR,
    )


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
    title = models.CharField(max_length = 50, default = MicroappVariables.DEFAULT_MICROAPP_NAME)
    
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
        print("Hash ID",self.hash_id)
        if not self.hash_id:
            while True:
                candidate = str(uuid.uuid4())[:16]
                if not Microapp.objects.filter(hash_id=candidate).exists():
                    self.hash_id = candidate
                    break
        super().save(*args, **kwargs)

    def archive(self):
        self.is_archived = True
        self.save()

    def unarchive(self):
        self.is_archived = False
        self.save()

    def __str__(self):
        return self.title

class MicroAppUserJoin(models.Model):
    ADMIN = 'admin'
    OWNER = 'owner'

    ROLE_CHOICES = [
        (ADMIN, 'Admin'),
        (OWNER, 'Owner')
    ]

    ma_id = models.ForeignKey(Microapp, on_delete=models.CASCADE)
    user_id = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    role = models.CharField(max_length=10, choices=ROLE_CHOICES)

    def __str__(self):
        return f"{self.user_id} {self.role}"

class Asset(models.Model):
    file = models.TextField()
    label = models.TextField()


class AssetsMaJoin(models.Model):
    ma_id = models.ForeignKey(Microapp, on_delete=models.CASCADE)
    asset_id = models.ForeignKey(Asset, on_delete=models.CASCADE)


class KnowledgeBase(models.Model):

    file = models.TextField()


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

    # The price per 1M input tokens for this request at the time of the run. 
    # This value is determined by the backend based on libraries that we maintain. 
    # TO-DO: Can we automate the updates of these libraries, rather than maintaining them manually?
    price_input_token_1M = models.DecimalField(max_digits=20, decimal_places=6)

    # The price per 1M output tokens for this request at the time of the run. 
    # This value is determined by the backend based on libraries that we maintain. 
    # TO-DO: Can we automate the updates of these libraries, rather than maintaining them manually?
    price_output_token_1M = models.DecimalField(max_digits=20, decimal_places=6)

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

    price_scale = models.FloatField(default=1_000_000.0)

    def __str__(self):
        return self.ai_model

class AIModelConfig(models.Model):
    # The name of the AI model (gpt-4o-mini, claude-3-opus-20240229, etc.) used when calling the API. 
    # The model_name is used to look up the model_config for the AI model. 
    model_name = models.CharField(max_length=50, unique=True)

    # The minimum range value for the frequency penalty of the AI model. 
    frequency_penalty_min = models.FloatField(default=0)

    # The maximum range value for the frequency penalty of the AI model. 
    frequency_penalty_max = models.FloatField(default=0)

    # The minimum range value for the presence penalty of the AI model. 
    presence_penalty_min = models.FloatField(default=0)

    # The maximum range value for the presence penalty of the AI model. 
    presence_penalty_max = models.FloatField(default=0)

    # The minimum range value for the top_p of the AI model. 
    top_p_min = models.FloatField(default=0)

    # The maximum range value for the top_p of the AI model. 
    top_p_max = models.FloatField(default=0)

    # The minimum range value for the temperature of the AI model. 
    temperature_min = models.FloatField(default=0)  

    # The maximum range value for the temperature of the AI model. 
    temperature_max = models.FloatField(default=0)

    # The default maximum number of tokens allowed in the output. 
    max_tokens_default = models.IntegerField()

    # The price per 1M input tokens for this model
    input_token_price = models.FloatField()

    # The price per 1M output tokens for this model
    output_token_price = models.FloatField()

    def __str__(self):
        return self.model_name
    
class BaseAIModel:
    def __init__(self, api_key, model_config):
        self.api_key = api_key
        self.model_config = model_config

    def get_response(self, api_params):
        pass

    def score_response(self, api_params, minimum_score):
        pass

    def extract_score(self, response):
        pass

    def calculate_cost(self, usage):
        pass
    
    def calculate_input_token_price(self, usage):
        pass

    def calculate_output_token_price(self, usage):
        pass

    def validate_params(self, data):
        pass

    def get_default_params(self, data):
        pass

    def get_model_message(self, messages, data):
        pass

    def build_instruction(self, data, params):
        pass
    
class GPTModel(BaseAIModel):
    def __init__(self, api_key, model_config):
        super().__init__(api_key, model_config)
        self.client = OpenAI(api_key = self.api_key)

    def get_response(self, api_params):
        try:
            response = self.client.chat.completions.create(**api_params)
            usage = response.usage
            ai_response = response.choices[0].message.content
            calculation = {"completion_tokens": usage.completion_tokens, "prompt_tokens": usage.prompt_tokens, "total_tokens": usage.total_tokens,}
            return {
                "completion_tokens": usage.completion_tokens,
                "prompt_tokens": usage.prompt_tokens,
                "total_tokens": usage.total_tokens,
                "ai_response": ai_response,
                "cost": self.calculate_cost(calculation),
                "price_input_token_1M": self.calculate_input_token_price(calculation),
                "price_output_token_1M": self.calculate_output_token_price(calculation)
            }
        except Exception as e:
            return handle_exception(e)

    def score_response(self, api_params, minimum_score):
        try:
            response = self.client.chat.completions.create(**api_params)
            usage = response.usage
            ai_score = response.choices[0].message.content
            score_result = False
            if self.extract_score(ai_score) >= minimum_score:
                score_result = True
            return {
                    "completion_tokens": usage.completion_tokens,
                    "prompt_tokens": usage.prompt_tokens,
                    "total_tokens": usage.total_tokens,
                    "ai_score": ai_score,
                    "score_result": score_result
            }
        except Exception as e:
            return handle_exception(e)

    def extract_score(self, response):
        try:
            pattern = r'"total":\s*"?(\d+)"?'
            match = re.search(pattern, response)
            if match:
                return int(match.group(1))
            else:
                return 0
        except Exception as e:
            return handle_exception(e)
        
    def calculate_cost(self, usage):
        try:
            cost = round(self.model_config["input_token_price"] * usage["prompt_tokens"] / self.model_config["price_scale"] + self.model_config["output_token_price"] * usage["completion_tokens"] / self.model_config["price_scale"], 6)
            return cost
        except Exception as e:
            return handle_exception(e)
    
    def calculate_input_token_price(self, usage):
        try:
            price_input_token_1M = round(self.model_config["input_token_price"] * usage["prompt_tokens"] / self.model_config["price_scale"], 6)    
            return price_input_token_1M
        except Exception as e:
            return handle_exception(e)
    
    def calculate_output_token_price(self, usage):
        try:
            price_output_token_1M = round(self.model_config["output_token_price"] * usage["completion_tokens"] / self.model_config["price_scale"], 6)
            return price_output_token_1M
        except Exception as e:
            return handle_exception(e)

    def validate_params(self, data):
        try:
            temperature_min = self.model_config["temperature_min"]
            temperature_max = self.model_config["temperature_max"]
            temperature = data.get("temperature", temperature_min)
            top_p_min = self.model_config["top_p_min"]
            top_p_max = self.model_config["top_p_max"]
            top_p = data.get("top_p", top_p_min)            
            params = {
                "temperature": (temperature, temperature_min, temperature_max),
                "frequency_penalty": (data.get("frequency_penalty"), self.model_config["frequency_penalty_min"], self.model_config["frequency_penalty_max"]),
                "presence_penalty": (data.get("presence_penalty"), self.model_config["presence_penalty_min"], self.model_config["presence_penalty_max"]),
                "top_p": (top_p, top_p_min, top_p_max),
            }
            for param, (value, min_val, max_val) in params.items():
                if value is not None and not (min_val <= value <= max_val):
                    return {"status": False, "message": f"Invalid {param} value"}
            return {"status": True}
        except ValueError:
            return {"status": False, "message": "Invalid input: temperature and top_p must be numeric values."}
        except Exception as e:
            log.error(e)
            return {"status": False, "message": error.VALIDATION_ERROR}
    
    def get_default_params(self, data):
        try:
            return {
                "model": data.get("ai_model", env("DEFAULT_AI_MODEL")),
                "messages": data.get("message_history", []) + data.get("prompt", []),
                "temperature": data.get("temperature", 0),
                "frequency_penalty": data.get("frequency_penalty", 0),
                "presence_penalty": data.get("presence_penalty", 0),
                "top_p": data.get("top_p", 1),
                "max_tokens": data.get("max_tokens", self.model_config["max_tokens_default"])
            }
        except Exception as e:
                log.error(e)
                return {}
    
    def get_model_message(self, messages, data):
        try:
            return messages
        except Exception as e:
            log.error(e)
            return []
    
    def build_instruction(self, data, messages):
        try:
            instruction = (
            "Please provide a score for the previous user message. Use the following rubric:" 
            + str(data.get("rubric")) 
            + " Output your response as JSON, using this format: "
            + "{ '[criteria 1]': '[score 1]', '[criteria 2]': '[score 2]', 'total': '[sum of all scores of all criteria]' }."
            + " Make sure to include the 'total' key and its value in your response."
            )
            messages.append({"role": "user", "content": instruction})
            return messages
        except Exception as e:
            log.error(e)
    
class GeminiModel(BaseAIModel):
    def __init__(self, api_key, model, model_config):
        super().__init__(api_key, model_config)
        genai.configure(api_key = self.api_key)
        self.model = genai.GenerativeModel(model)

    def get_response(self, api_params):
        try:
            messages = api_params["messages"]
            response = self.model.generate_content(messages,generation_config=genai.types.GenerationConfig(
                temperature = api_params["temperature"],
                top_p = api_params["top_p"],
                max_output_tokens = api_params["max_tokens"]
            ))   
            usage = response.usage_metadata
            ai_response = response.candidates[0].content.parts[0].text
            calculation = { "completion_tokens":usage.candidates_token_count,"prompt_tokens": usage.prompt_token_count,"total_tokens": usage.total_token_count}
            return {
                    "completion_tokens":usage.candidates_token_count,
                    "prompt_tokens": usage.prompt_token_count,
                    "total_tokens": usage.total_token_count,
                    "ai_response": ai_response,
                    "cost": self.calculate_cost(calculation),
                    "price_input_token_1M": self.calculate_input_token_price(calculation),
                    "price_output_token_1M": self.calculate_output_token_price(calculation)
            }
        except Exception as e:
             return handle_exception(e)

    def score_response(self, api_params, minimum_score):
        try:
            messages = api_params["messages"]
            response = self.model.generate_content(messages,generation_config=genai.types.GenerationConfig(
                temperature = api_params["temperature"],
                top_p = api_params["top_p"],
                max_output_tokens = api_params["max_tokens"]
            ))   
            usage = response.usage_metadata
            ai_score = response.candidates[0].content.parts[0].text
            score_result = False
            if self.extract_score(ai_score) >= minimum_score:
                score_result = True
            return {
                    "completion_tokens":usage.candidates_token_count,
                    "prompt_tokens": usage.prompt_token_count,
                    "total_tokens": usage.total_token_count,
                    "ai_score": ai_score,
                    "score_result": score_result
            }
        except Exception as e:
                return handle_exception(e)

    def extract_score(self, response):
        try:
            pattern = r'["\']total["\']:\s*["\']?(\d+)["\']?'
            match = re.search(pattern, response)
            if match:
                return int(match.group(1))
            else:
                return 0
        except Exception as e:
            return handle_exception(e)
        
    def calculate_cost(self, usage):
        try:
            cost = round(self.model_config["input_token_price"] * usage["prompt_tokens"] / self.model_config["price_scale"] + self.model_config["output_token_price"] * usage["completion_tokens"] / self.model_config["price_scale"], 6)
            return cost
        except Exception as e:
            return handle_exception(e)
    
    def calculate_input_token_price(self, usage):
        try:
            price_input_token_1M = round(self.model_config["input_token_price"] * usage["prompt_tokens"] / self.model_config["price_scale"], 6)    
            return price_input_token_1M
        except Exception as e:
            return handle_exception(e)
    
    def calculate_output_token_price(self, usage):
        try:
            price_output_token_1M = round(self.model_config["output_token_price"] * usage["completion_tokens"] / self.model_config["price_scale"], 6)
            return price_output_token_1M
        except Exception as e:
            return handle_exception(e)
        
    def validate_params(self, data):
        try:
            temperature_min = self.model_config["temperature_min"]
            temperature_max = self.model_config["temperature_max"]
            temperature = float(data.get("temperature", temperature_min))
            top_p_min = self.model_config["top_p_min"]
            top_p_max = self.model_config["top_p_max"]
            top_p = float(data.get("top_p", top_p_min)) 
            params = {
                "temperature": (temperature, temperature_min, temperature_max),
                "top_p": (top_p, top_p_min, top_p_max),
            }
            for param, (value, min_val, max_val) in params.items():
                if value is not None and not (min_val <= value <= max_val):
                    return {"status": False, "message": f"Invalid {param} value"}
            return {"status": True}
        except ValueError:
            return {"status": False, "message": "Invalid input: temperature and top_p must be numeric values."}
        except Exception as e:
            log.error(e)
            return {"status": False, "message": error.VALIDATION_ERROR}
    
    def get_default_params(self, data):
        return {
            "model": data.get("ai_model", env("DEFAULT_AI_MODEL")),
            "messages": data.get("message_history", []) + data.get("prompt", []),
            "temperature": float(data.get("temperature", 0)),
            "frequency_penalty": data.get("frequency_penalty", 0),
            "presence_penalty": data.get("presence_penalty", 0),
            "top_p": data.get("top_p", 1),
            "max_tokens": data.get("max_tokens", self.model_config["max_tokens_default"])
        }
    
    def get_model_message(self, messages, data):
        try:
            new_message = []
            new_message = [
                {"parts": msg["content"], "role": "model" if msg["role"] in ["system", "assistant", "model"] else "user"}
                for msg in messages
            ]
            return new_message
        except Exception as e:
            log.error(e)
            return []
    
    def build_instruction(self, data, messages):
        try:
            instruction = (
            "Please provide a score for the previous user message. Use the following rubric:" 
            + str(data.get("rubric")) 
            + " Output your response as JSON, using this format: "
            + "{ '[criteria 1]': '[score 1]', '[criteria 2]': '[score 2]', 'total': '[sum of all scores of all criteria]' }."
            + " Make sure to include the 'total' key and its value in your response."
            )
            messages.append({"role": "model", "parts": instruction})
            return messages
        except Exception as e:
            log.error(e)

class ClaudeModel(BaseAIModel):
    def __init__(self, api_key, model_config):
        super().__init__(api_key, model_config)
        self.client = Anthropic(api_key = api_key)

    def get_response(self, api_params):
        try:
            response = self.client.messages.create(
            max_tokens = api_params["max_tokens"],
            messages = api_params["messages"], 
            model = api_params["model"],
            temperature = api_params["temperature"],
            top_p = api_params["top_p"],
            ),             
            message_data = response[0]
            ai_response = message_data.content[0].text
            usage = message_data.usage
            calculation = {"completion_tokens": usage.output_tokens, "prompt_tokens": usage.input_tokens, "total_tokens": usage.input_tokens + usage.output_tokens,}
            return {
                "completion_tokens": usage.output_tokens,
                "prompt_tokens": usage.input_tokens,
                "total_tokens": usage.input_tokens + usage.output_tokens,
                "ai_response": ai_response,
                "cost": self.calculate_cost(calculation),
                "price_input_token_1M": self.calculate_input_token_price(calculation),
                "price_output_token_1M": self.calculate_output_token_price(calculation)
            }
        except Exception as e:
            return handle_exception(e)

    def score_response(self, api_params, minimum_score):
        try:
            response = self.client.messages.create(
            max_tokens = api_params["max_tokens"],
            messages = api_params["messages"], 
            model = api_params["model"],
            temperature = api_params["temperature"],
            top_p = api_params["top_p"],
            ),             
            message_data = response[0]
            ai_score = message_data.content[0].text
            usage = message_data.usage
            score_result = False
            if self.extract_score(ai_score) >= minimum_score:
                score_result = True
            return {
                    "completion_tokens": usage.output_tokens,
                    "prompt_tokens": usage.input_tokens,
                    "total_tokens": usage.output_tokens + usage.input_tokens,
                    "ai_score": ai_score,
                    "score_result": score_result
            }
        except Exception as e:
            return handle_exception(e)

    def extract_score(self, response):
        try:
            pattern = r'"total":\s*"?(\d+)"?'
            match = re.search(pattern, response)
            if match:
                return int(match.group(1))
            else:
                return 0
        except Exception as e:
            return handle_exception(e)
        
    def calculate_cost(self, usage):
        try:
            cost = round(self.model_config["input_token_price"] * usage["prompt_tokens"] / self.model_config["price_scale"] + self.model_config["output_token_price"] * usage["completion_tokens"] / self.model_config["price_scale"], 6)
            return cost
        except Exception as e:
            return handle_exception(e)
    
    def calculate_input_token_price(self, usage):
        try:
            price_input_token_1M = round(self.model_config["input_token_price"] * usage["prompt_tokens"] / self.model_config["price_scale"], 6)    
            return price_input_token_1M
        except Exception as e:
            return handle_exception(e)
    
    def calculate_output_token_price(self, usage):
        try:
            price_output_token_1M = round(self.model_config["output_token_price"] * usage["completion_tokens"] / self.model_config["price_scale"], 6)
            return price_output_token_1M
        except Exception as e:
            return handle_exception(e)
        
    def validate_params(self, data):
        try:
            temperature_min = self.model_config["temperature_min"]
            temperature_max = self.model_config["temperature_max"]
            temperature = float(data.get("temperature", temperature_min))
            top_p_min = self.model_config["top_p_min"]
            top_p_max = self.model_config["top_p_max"]
            top_p = float(data.get("top_p", top_p_min)) 
            params = {
                "temperature": (temperature, temperature_min, temperature_max),
                "top_p": (top_p, top_p_min, top_p_max),
            }
            for param, (value, min_val, max_val) in params.items():
                if value is not None and not (value == -1 or (min_val <= value <= max_val)):
                    return {"status": False, "message": f"Invalid {param} value"}
            return {"status": True}
        except ValueError:
            return {"status": False, "message": "Invalid input: temperature and top_p must be numeric values."}
        except Exception as e:
            log.error(e)
            return {"status": False, "message": error.VALIDATION_ERROR}
    
    def get_default_params(self, data):
        return {
            "model": data.get("ai_model", env("DEFAULT_AI_MODEL")),
            "messages": data.get("message_history", []) + data.get("prompt", []),
            "temperature": data.get("temperature", 0),
            "frequency_penalty": data.get("frequency_penalty", 0),
            "presence_penalty": data.get("presence_penalty", 0),
            "top_p": data.get("top_p", 1),
            "max_tokens": data.get("max_tokens", self.model_config["max_tokens_default"])
        }
    
    def get_model_message(self, messages, data):
        try:
            new_message = []
            if (data.get('prompt') or data.get('message_history')) and messages[0]["role"] != "user":
                new_message.append(AIModelVariables.CLAUDE_USER_DUMMY_MESSAGE_FIRST)

            new_message.extend(
                {"content": msg["content"], "role": "assistant" if msg["role"] in ["system", "assistant", "model"] else "user"}
                for msg in messages
            )
            if new_message and new_message[-1]["role"] == "assistant":
                new_message.append(AIModelVariables.CLAUDE_USER_DUMMY_MESSAGE_LAST)

            return new_message
       
        except Exception as e:
            log.error(e)
            return []
        
    def build_instruction(self, data, messages):
        try:
            instruction = (
            "Please provide a score for the previous user message. Use the following rubric:" 
            + str(data.get("rubric")) 
            + " Output your response as JSON, using this format: "
            + "{ '[criteria 1]': '[score 1]', '[criteria 2]': '[score 2]', 'total': '[sum of all scores of all criteria]' }."
            + " Make sure to include the 'total' key and its value in your response."
            )
            if messages[-1]["role"] == "user":
                messages.append({"role": "assistant", "content": "What is the next instruction"})
                messages.append({"role": "user", "content": instruction})
            else:
                messages.append({"role": "user", "content": instruction})
            return messages
        except Exception as e:
            log.error(e)
