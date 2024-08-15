class CollectionVariables:
    MY_COLLECTION = "My Collection"
    SHARED_WITH_ME_COLLECTION = "Shared With Me"

class AIModelVariables:
    CLAUDE_USER_DUMMY_MESSAGE_FIRST = {"role": "user", "content": "This is a conversation between user and assistant"}
    CLAUDE_USER_DUMMY_MESSAGE_LAST = {"role": "user", "content": "your thoughts on this"}

class AIModelConstants:

    GPT_CONSTANTS = [
        {
        "model_name": "gpt-3.5-turbo",
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
        "output_token_price": 6 
    }
    ]
    GEMINI_CONSTANTS =[
        {
        "model_name": "gemini-1.5-flash",
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
        "output_token_price": 0.0375 
    }
    ]
    CLAUDE_CONSTANTS =[
        {
        "model_name": "claude-3-opus-20240229",
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
        "output_token_price": 15 
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