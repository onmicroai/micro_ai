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

class AIModelDefaults:
    """Base default values for all AI models"""
    BASE_DEFAULTS = {
        "temperature": 1.0,
        "top_p": 1.0,
        "max_tokens": 10000,
        "presence_penalty": 0,
        "frequency_penalty": 0,
        "temperature_min": 0,
        "temperature_max": 2,
        "presence_penalty_min": -2,
        "presence_penalty_max": 2,
        "frequency_penalty_min": -2,
        "frequency_penalty_max": 2,
        "top_p_min": 0,
        "top_p_max": 1,
        "supports_image": False,
        "stream": False
    }

class AIModelFamilyDefaults:
    """Family-specific defaults that inherit and override base defaults"""
    OPENAI = {
        "family": "openai",
        "api_key": env("OPENAI_API_KEY"),
        **AIModelDefaults.BASE_DEFAULTS
    }
    
    ANTHROPIC = {
        "family": "anthropic",
        "temperature_max": 1,  # Anthropic has different temperature range
        "api_key": env("ANTHROPIC_API_KEY"),
        **AIModelDefaults.BASE_DEFAULTS
    }
    
    GEMINI = {
        "family": "gemini",
        "api_key": env("GOOGLE_API_KEY"),
        **AIModelDefaults.BASE_DEFAULTS
    }
    
    PERPLEXITY = {
        "family": "perplexity",
        "frequency_penalty_min": 0,  # Perplexity has different penalty ranges
        "api_key": env("PERPLEXITY_API_KEY"),
        **AIModelDefaults.BASE_DEFAULTS
    }
    
    DEEPSEEK = {
        "family": "deepseek",
        "api_key": env("DEEPSEEK_API_KEY"),
        **AIModelDefaults.BASE_DEFAULTS
    }

class AIModelConstants:
    """Model-specific configurations that inherit from family defaults"""
    AI_MODELS = {
        "gpt-4o-mini": {
            "model": "openai/gpt-4o-mini",
            **AIModelFamilyDefaults.OPENAI
        },
        "openai-o3-mini": {
            "model": "openai/o3-mini",
            **AIModelFamilyDefaults.OPENAI
        },
        "claude-3-opus": {
            "model": "anthropic/claude-3-opus-20240229",
            "supports_image": True,
            **AIModelFamilyDefaults.ANTHROPIC
        },
        "claude-3-5-haiku": {
            "model": "anthropic/claude-3-5-haiku-20241022",
            "max_tokens": 8192,
            **AIModelFamilyDefaults.ANTHROPIC
        },
        "gemini-pro": {
            "model": "gemini/gemini-pro",
            "supports_image": True,
            **AIModelFamilyDefaults.GEMINI
        },
        "gemini-2.0-flash": {
            "model": "gemini/gemini-2.0-flash",
            "supports_image": True,
            **AIModelFamilyDefaults.GEMINI
        },
        "sonar-reasoning-pro": {
            "model": "sonar-reasoning-pro",
            **AIModelFamilyDefaults.PERPLEXITY
        },
        "deepseek-chat": {
            "model": "deepseek-chat",
            **AIModelFamilyDefaults.DEEPSEEK
        }
    }

    @staticmethod
    def get_configs(model_name: str) -> dict:
        """Get model configuration with all defaults"""
        return AIModelConstants.AI_MODELS.get(model_name, {})

    @staticmethod
    def get_model_family(model_name: str) -> str:
        """Get the AI model family (openai, anthropic, etc)"""
        config = AIModelConstants.get_configs(model_name)
        return config.get("family", "")

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