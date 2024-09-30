import environ
import os
from pathlib import Path
BASE_DIR = Path(__file__).resolve().parent.parent
env = environ.Env()
env.read_env(os.path.join(BASE_DIR, ".env"))

class MicroappVariables:
    APP_OWNER = "owner"

class CollectionVariables:
    MY_COLLECTION = "My Collection"
    SHARED_WITH_ME_COLLECTION = "Shared With Me"

class AIModelVariables:
    CLAUDE_USER_DUMMY_MESSAGE_FIRST = {"role": "user", "content": "This is a conversation between user and assistant"}
    CLAUDE_USER_DUMMY_MESSAGE_LAST = {"role": "user", "content": "your thoughts on this"}

class AIModelConstants:

    GPT_CONSTANTS = [
        {
        "model_name": env("OPENAI_MODEL_NAME"),
        "frequency_penalty_min": -2,
        "frequency_penalty_max": 2,
        "presence_penalty_min": -2,
        "presence_penalty_max": 2,
        "top_p_min": 0,
        "top_p_max": 1,
        "temperature_min": 0,
        "temperature_max": 2,
        "max_tokens_default": 500,
        "input_token_price": 3,
        "output_token_price": 6,
        "price_scale": 1_000_000,
        "api_key": env("OPENAI_API_KEY")
    }
    ]
    GEMINI_CONSTANTS =[
        {
        "model_name": env("GEMINI_MODEL_NAME"),
        "frequency_penalty_min": 0,
        "frequency_penalty_max": 0,
        "presence_penalty_min": 0,
        "presence_penalty_max": 0,
        "top_p_min": 0,
        "top_p_max": 1,
        "temperature_min": 0,
        "temperature_max": 2,
        "max_tokens_default": 500,
        "input_token_price": 0.15,
        "output_token_price": 0.0375,
        "price_scale": 1_000_000,
        "api_key": env("GEMINI_API_KEY")
    }
    ]
    CLAUDE_CONSTANTS =[
        {
        "model_name": env("CLAUDE_MODEL_NAME"),
        "frequency_penalty_min": 0,
        "frequency_penalty_max": 0,
        "presence_penalty_min": 0,
        "presence_penalty_max": 0,
        "top_p_min": 0,
        "top_p_max": 1,
        "temperature_min": 0,
        "temperature_max": 1,
        "max_tokens_default": 500,
        "input_token_price": 3,
        "output_token_price": 15,
        "price_scale": 1_000_000,
        "api_key": env("CLAUDE_API_KEY")
    }
    ]

    @staticmethod
    def get_configs(model_name):
        if "gpt" in model_name:
            for object in AIModelConstants.GPT_CONSTANTS:
                if object["model_name"] == model_name:
                    return object
        elif "gemini" in model_name:
            for object in AIModelConstants.GEMINI_CONSTANTS:
                if object["model_name"] == model_name:
                    return object
        elif "claude" in model_name:
            for object in AIModelConstants.CLAUDE_CONSTANTS:
                if object["model_name"] == model_name:
                    return object
                
        return False
    
class UsageVariables:
    # Plan names
    FREE_PLAN = "free"
    INDIVIDUAL_PLAN = "individual"
    ENTERPRISE_PLAN = "enterprise"
    # Plan limits
    FREE_PLAN_LIMIT = 3
    INDIVIDUAL_PLAN_LIMIT = 10
    ENTERPRISE_PLAN_LIMIT = 40
    # Default values
    DEFAULT_PLAN_ID = 1
    DEFAULT_TOTAL_COST = 0
    FREE_PLAN_MICROAPP_LIMIT = 3
    # Plan amounts
    FREE_PLAN_AMOUNT_MONTH = "0.00"
    FREE_PLAN_AMOUNT_YEAR = "0.00"
    ENTERPRISE_PLAN_AMOUNT_MONTH = "79.00"
    ENTERPRISE_PLAN_AMOUNT_YEAR = "850.00"
    INDIVIDUAL_PLAN_AMOUNT_YEAR = "18.00"
    INDIVIDUAL_PLAN_AMOUNT_YEAR = "195.00"
    # Guest Users
    GUEST_USER_SESSION_LIMIT = 3