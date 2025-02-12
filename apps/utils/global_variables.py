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

class AIModelDefaults:
    """Base default values for all AI models"""
    BASE_DEFAULTS = {
        "temperature": 1.0,
        "top_p": 1.0,
        "max_tokens": 5000,
        "presence_penalty": 0.0,
        "frequency_penalty": 0.0,
        "temperature_min": 0.0,
        "temperature_max": 2.0,
        "presence_penalty_min": -2.0,
        "presence_penalty_max": 2.0,
        "frequency_penalty_min": -2.0,
        "frequency_penalty_max": 2.0,
        "top_p_min": 0.0,
        "top_p_max": 1.0,
        "supports_image": False,
        "stream": False,# Default empty list for messages
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
    # Visit LiteLLM https://docs.litellm.ai/docs/providers for more information on the models
    AI_MODELS = {
        "gpt-4o-mini": {
            **AIModelFamilyDefaults.OPENAI,
            "model": "openai/gpt-4o-mini",
            "supports_image": True
        },
        "gpt-4o": {
            **AIModelFamilyDefaults.OPENAI,
            "model": "openai/gpt-4o",
            "supports_image": True
        },
        "openai-o3-mini": {
            **AIModelFamilyDefaults.OPENAI,
            "model": "openai/o3-mini",
            "supports_image": False
        },
        "openai-o1": {
            **AIModelFamilyDefaults.OPENAI,
            "model": "openai/o1",
            "supports_image": True
        },
        "claude-3-5-haiku": {
            **AIModelFamilyDefaults.ANTHROPIC,
            "model": "anthropic/claude-3-5-haiku-latest",
            "max_tokens": 8192,
            "supports_image": False
        },
        "claude-3-5-sonnet": {
            **AIModelFamilyDefaults.ANTHROPIC,
            "model": "anthropic/claude-3-5-sonnet-latest",
            "max_tokens": 8192,
            "supports_image": True
        },
        "claude-3-opus": {
            **AIModelFamilyDefaults.ANTHROPIC,
            "model": "anthropic/claude-3-opus-latest",
            "max_tokens": 4096,
            "supports_image": True
        },
        "gemini-2.0-flash": {
            **AIModelFamilyDefaults.GEMINI,
            "model": "gemini/gemini-2.0-flash",
            "supports_image": True
        },
        "gemini-pro": {
            **AIModelFamilyDefaults.GEMINI,
            "model": "gemini/gemini-pro",
            "supports_image": True
        },
        "sonar-pro": {
            **AIModelFamilyDefaults.PERPLEXITY,
            "model": "perplexity/sonar-pro"
        },
        "deepseek-chat": {
            **AIModelFamilyDefaults.DEEPSEEK,
            "model": "deepseek/deepseek-chat"
        }
    }

    @staticmethod
    def get_configs(model_name: str) -> dict:
        """Get model configuration with proper inheritance chain:
        1. Start with BASE_DEFAULTS
        2. Override with family defaults
        3. Override with model-specific settings
        """
        # Start with base defaults
        config = AIModelDefaults.BASE_DEFAULTS.copy()
        
        # Get the model's config
        model_config = AIModelConstants.AI_MODELS.get(model_name, {})
        if not model_config:
            return config
            

        # Get the family defaults based on the model's family
        family = model_config.get("family")
        if family:
            family_defaults = getattr(AIModelFamilyDefaults, family.upper(), {})
            # Override base defaults with family defaults
            config.update({k: v for k, v in family_defaults.items() 
                         if k in AIModelDefaults.BASE_DEFAULTS})
            
        # Finally override with ALL model-specific settings
        config.update(model_config)
        
        return config

    @staticmethod
    def get_model_family(model_name: str) -> str:
        """Get the AI model family (openai, anthropic, etc)"""
        config = AIModelConstants.AI_MODELS.get(model_name, {})
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

    # The number of credits per penny of cost.
    # E.g. Multiplier of 1000 means 1 credit per $0.001 of cost.
    # E.g. Multipler of 1000 also means 10 credits per $0.01 of cost.
    CREDITS_MULTIPLIER = 1000
    # The minimum number of credits to charge for any response.
    MINIMUM_CREDITS = 1