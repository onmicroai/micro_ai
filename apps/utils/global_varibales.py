import environ
import os
from pathlib import Path
BASE_DIR = Path(__file__).resolve().parent.parent
env = environ.Env()
env.read_env(os.path.join(BASE_DIR, ".env"))

class MicroappVariables:
    APP_OWNER = "owner"
    DEFAULT_MICROAPP_NAME = "Untitled App"
    DEFAULT_MICROAPP_PRIVACY = "private"
    DEFAULT_MICROAPP_AI_MODEL = "gpt-4o-mini"
    DEFAULT_RESPONSE_TYPE = "AI"
    FIXED_RESPONSE_TYPE = "Fixed_Response"

class CollectionVariables:
    MY_COLLECTION = "My Collection"
    SHARED_WITH_ME_COLLECTION = "Shared With Me"

class AIModelVariables:
    CLAUDE_USER_DUMMY_MESSAGE_FIRST = {"role": "user", "content": "This is a conversation between user and assistant"}
    CLAUDE_USER_DUMMY_MESSAGE_LAST = {"role": "user", "content": "your thoughts on this"}

class AIModelConstants:
    AI_MODELS = {
        "gpt-4o-mini": {
            "family": "openai",
            "model": "gpt-4o-mini",
            "max_tokens": 1000,
            "max_tokens_default": 1000,
            "temperature": 1.0,
            "top_p": 1.0,
            "frequency_penalty": 0,
            "presence_penalty": 0,
            "frequency_penalty_min": -2,
            "frequency_penalty_max": 2,
            "presence_penalty_min": -2,
            "presence_penalty_max": 2,
            "top_p_min": 0,
            "top_p_max": 1,
            "temperature_min": 0,
            "temperature_max": 2,
            "supports_image": False,
            "input_token_price": 0.15,
            "output_token_price": 0.60,
            "price_scale": 1_000_000,
            "api_key": env("OPENAI_API_KEY")
        },
        "gpt-4o": {
            "family": "openai",
            "model": "gpt-4o",
            "max_tokens": 1000,
            "max_tokens_default": 1000,
            "temperature": 1.0,
            "top_p": 1.0,
            "frequency_penalty": 0,
            "presence_penalty": 0,
            "frequency_penalty_min": -2,
            "frequency_penalty_max": 2,
            "presence_penalty_min": -2,
            "presence_penalty_max": 2,
            "top_p_min": 0,
            "top_p_max": 1,
            "temperature_min": 0,
            "temperature_max": 2,
            "supports_image": True,
            "input_token_price": 2.5,
            "output_token_price": 10,
            "price_scale": 1_000_000,
            "api_key": env("OPENAI_API_KEY")
        },
        "gemini-1.5-flash": {
            "family": "gemini",
            "model": "gemini-1.5-flash",
            "max_tokens": 1000,
            "max_tokens_default": 1000,
            "temperature": 1.0,
            "top_p": 0.95,
            "frequency_penalty": 0,
            "presence_penalty": 0,
            "frequency_penalty_min": 0,
            "frequency_penalty_max": 0,
            "presence_penalty_min": 0,
            "presence_penalty_max": 0,
            "top_p_min": 0,
            "top_p_max": 1,
            "temperature_min": 0,
            "temperature_max": 2,
            "supports_image": False,
            "input_token_price": 0.15,
            "output_token_price": 0.60,
            "price_scale": 1_000_000,
            "api_key": env("GEMINI_API_KEY")
        },
        "gemini-2.0-flash-exp": {
            "family": "gemini",
            "model": "gemini-2.0-flash-exp",
            "max_tokens": 1000,
            "max_tokens_default": 1000,
            "temperature": 1.0,
            "top_p": 0.95,
            "frequency_penalty": 0,
            "presence_penalty": 0,
            "frequency_penalty_min": 0,
            "frequency_penalty_max": 0,
            "presence_penalty_min": 0,
            "presence_penalty_max": 0,
            "top_p_min": 0,
            "top_p_max": 1,
            "temperature_min": 0,
            "temperature_max": 2,
            "supports_image": False,
            "input_token_price": 0.15,
            "output_token_price": 0.60,
            "price_scale": 1_000_000,
            "api_key": env("GEMINI_API_KEY")
        },
        "gemini-1.5-pro": {
            "family": "gemini",
            "model": "gemini-1.5-pro",
            "max_tokens": 1000,
            "max_tokens_default": 1000,
            "temperature": 1.0,
            "top_p": 0.95,
            "frequency_penalty": 0,
            "presence_penalty": 0,
            "frequency_penalty_min": 0,
            "frequency_penalty_max": 0,
            "presence_penalty_min": 0,
            "presence_penalty_max": 0,
            "top_p_min": 0,
            "top_p_max": 1,
            "temperature_min": 0,
            "temperature_max": 2,        
            "supports_image": True,
            "input_token_price": 2.5,
            "output_token_price": 10.00,
            "price_scale": 1_000_000,
            "api_key": env("GEMINI_API_KEY")
        },   
        "claude-3-5-haiku-20241022": {
            "family": "anthropic",
            "model": "claude-3-5-haiku-20241022",
            "max_tokens": 1000,
            "max_tokens_default": 1000,
            "temperature": 1.0,
            "top_p": 0.95,
            "top_p_min": 0,
            "top_p_max": 1,
            "temperature_min": 0,
            "temperature_max": 1,        
            "supports_image": True,
            "input_token_price": .80,
            "output_token_price": 4.00,
            "price_scale": 1_000_000,
            "api_key": env("CLAUDE_API_KEY")
        }, 
        "claude-3-5-sonnet-20241022": {
            "family": "anthropic",
            "model": "claude-3-5-sonnet-20241022",
            "max_tokens": 1000,
            "max_tokens_default": 1000,
            "temperature": 1.0,
            "top_p": 0.95,
            "top_p_min": 0,
            "top_p_max": 1,
            "temperature_min": 0,
            "temperature_max": 1,        
            "supports_image": True,
            "input_token_price": 3.75,
            "output_token_price": 15.00,
            "price_scale": 1_000_000,
            "api_key": env("CLAUDE_API_KEY")
        }, 
        "sonar-reasoning-pro": {
            "family": "perplexity",
            "model": "sonar-reasoning-pro",
            "max_tokens": 10000,
            "max_tokens_default": 10000,
            "frequency_penalty": 1,
            "frequency_penalty_min": 0,
            "frequency_penalty_max": 2,
            "presence_penalty": 0,
            "presence_penalty_min": -2,
            "presence_penalty_max": 2,
            "temperature": .2,
            "top_p": 0.9,
            "top_p_min": 0,
            "top_p_max": 1,
            "temperature_min": 0,
            "temperature_max": 2,        
            "supports_image": False,
            "input_token_price": 2.00,
            "output_token_price": 8.00,
            "price_scale": 1_000_000,
            "api_key": env("PERPLEXITY_API_KEY")
        }, 
    }

    @staticmethod
    def get_configs(model_name):
        return AIModelConstants.AI_MODELS.get(model_name, False)

    
class UsageVariables:
    # Plan names
    FREE_PLAN = "free"
    INDIVIDUAL_PLAN = "individual"
    ENTERPRISE_PLAN = "enterprise"
    # Plan limits in credits
    FREE_PLAN_CREDIT_LIMIT = 10000
    INDIVIDUAL_PLAN_CREDIT_LIMIT = 100000
    ENTERPRISE_PLAN_CREDIT_LIMIT = 400000
    # Default values
    DEFAULT_PLAN_ID = 1
    DEFAULT_TOTAL_COST = 0
    FREE_PLAN_MICROAPP_LIMIT = int(env("FREE_PLAN_MICROAPP_LIMIT"))
    # Plan amounts
    FREE_PLAN_AMOUNT_MONTH = "0.00"
    FREE_PLAN_AMOUNT_YEAR = "0.00"
    ENTERPRISE_PLAN_AMOUNT_MONTH = "79.00"
    ENTERPRISE_PLAN_AMOUNT_YEAR = "850.00"
    INDIVIDUAL_PLAN_AMOUNT_YEAR = "18.00"
    INDIVIDUAL_PLAN_AMOUNT_YEAR = "195.00"
    # Guest Users
    GUEST_USER_SESSION_LIMIT = 3

class SubscriptionVariables:
    DEFAULT_BILLING_CYCLE_STATUS = "open"
    HARDCODED_RESPONSE_CREDIT = 5
    DEFAULT_RESPONSE_CREDIT = 10
    SCORE_RESPONSE_CREDIT = 20