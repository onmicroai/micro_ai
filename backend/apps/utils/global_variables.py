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
            "supports_image": True,
            "plans": ["free", "individual", "enterprise"]
        },
        "gpt-4o": {
            **AIModelFamilyDefaults.OPENAI,
            "model": "openai/gpt-4o",
            "supports_image": True,
            "plans": ["individual", "enterprise"]
        },
        "openai-o3-mini": {
            **AIModelFamilyDefaults.OPENAI,
            "model": "openai/o3-mini",
            "supports_image": False,
            "plans": ["individual", "enterprise"]
        },
        "openai-o1": {
            **AIModelFamilyDefaults.OPENAI,
            "model": "openai/o1",
            "supports_image": True,
            "plans": ["enterprise"]
        },
        "claude-3-5-haiku": {
            **AIModelFamilyDefaults.ANTHROPIC,
            "model": "anthropic/claude-3-5-haiku-latest",
            "max_tokens": 8192,
            "supports_image": False,
            "plans": ["free", "individual", "enterprise"]
        },
        "claude-4-sonnet": {
            **AIModelFamilyDefaults.ANTHROPIC,
            "model": "anthropic/claude-4-sonnet-latest",
            "max_tokens": 8192,
            "supports_image": True,
            "plans": ["individual", "enterprise"]
        },
        "claude-4-opus": {
            **AIModelFamilyDefaults.ANTHROPIC,
            "model": "anthropic/claude-4-opus-latest",
            "max_tokens": 4096,
            "supports_image": True,
            "plans": ["enterprise"]
        },
        "gemini-2.5-pro": {
            **AIModelFamilyDefaults.GEMINI,
            "model": "gemini/gemini-2.5-pro",
            "supports_image": True,
            "plans": ["individual", "enterprise"]
        },
        "gemini-2.5-flash": {
            **AIModelFamilyDefaults.GEMINI,
            "model": "gemini/gemini-2.5-flash",
            "supports_image": True,
            "plans": ["free", "individual", "enterprise"]
        },
        "sonar-pro": {
            **AIModelFamilyDefaults.PERPLEXITY,
            "model": "perplexity/sonar-pro",
            "plans": ["individual", "enterprise"]
        },
        "deepseek-chat": {
            **AIModelFamilyDefaults.DEEPSEEK,
            "model": "deepseek/deepseek-chat",
            "plans": ["free", "individual", "enterprise"]
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

    @staticmethod
    def is_model_available_for_plan(model_name: str, plan: str) -> bool:
        """Check if a model is available for a specific plan"""
        config = AIModelConstants.AI_MODELS.get(model_name, {})
        available_plans = config.get("plans", [])
        return plan in available_plans

    @staticmethod
    def get_models_for_plan(plan: str) -> list:
        """Get all models available for a specific plan"""
        available_models = []
        for model_name, config in AIModelConstants.AI_MODELS.items():
            available_plans = config.get("plans", [])
            if plan in available_plans:
                available_models.append(model_name)
        return available_models

    @staticmethod
    def get_model_plans(model_name: str) -> list:
        """Get all plans that have access to a specific model"""
        config = AIModelConstants.AI_MODELS.get(model_name, {})
        return config.get("plans", [])

class UsageVariables:
    # Plan limits in credits
    FREE_PLAN_CREDIT_LIMIT = 10000
    INDIVIDUAL_PLAN_CREDIT_LIMIT = 100000
    ENTERPRISE_PLAN_CREDIT_LIMIT = 400000

    FREE_PLAN_MICROAPP_LIMIT = int(env("FREE_PLAN_MICROAPP_LIMIT"))
    # Guest Users
    GUEST_USER_SESSION_LIMIT = 10

    # The number of credits per penny of cost.
    # E.g. Multiplier of 10000 means 1 credit per $0.0001 of cost.
    # E.g. Multipler of 10000 also means 100 credits per $0.01 of cost.
    CREDITS_MULTIPLIER = 10000
    # The minimum number of credits to charge for any response.
    MINIMUM_CREDITS = 1