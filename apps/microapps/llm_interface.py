from typing import Dict, Any, Optional
import litellm
from django.conf import settings
import logging
from apps.utils.global_variables import AIModelConstants, AIModelDefaults

log = logging.getLogger(__name__)

class UnifiedLLMInterface:
    """
    A unified interface for all LLM providers using litellm
    """
    
    def __init__(self, model_config: Dict[str, Any]):
        """
        Initialize the LLM interface with model configuration
        
        Args:
            model_config: Dictionary containing model configuration including:
                - model: The model identifier (e.g., "gpt-4", "claude-3-opus")
                - api_key: The API key for the model provider
                - temperature: Default temperature
                - max_tokens: Default max tokens
                - price_scale: Price scaling factor (usually 1M for per-million pricing)
                - stream: Whether to stream the response
        """
        self.model_config = model_config
        self.model_name = model_config.get("model")
        
        # Set the API key for the model provider
        litellm.api_key = model_config.get("api_key")
        
        # Use base defaults, overridden by model-specific config
        self.default_params = {
            "model": self.model_name,
            **{k: model_config.get(k, v) for k, v in AIModelDefaults.BASE_DEFAULTS.items()}
        }
        
        # Price configuration
        self.price_scale = model_config.get("price_scale", AIModelDefaults.BASE_DEFAULTS["price_scale"])
        self.input_token_price = model_config.get("input_token_price", 0)
        self.output_token_price = model_config.get("output_token_price", 0)

    def validate_params(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Validate the parameters for the model"""
        try:
            
            # Validate temperature
            if "temperature" in data:
                temp = float(data["temperature"])
                if temp < self.model_config.get("temperature_min", 0) or temp > self.model_config.get("temperature_max", 2):
                    return {"status": False, "message": f"Temperature must be between {self.model_config.get('temperature_min', 0)} and {self.model_config.get('temperature_max', 2)}"}

            return {"status": True, "message": "Parameters validated successfully"}
        except ValueError as e:
            return {"status": False, "message": str(e)}
        except Exception as e:
            log.error(f"Error validating parameters: {str(e)}")
            return {"status": False, "message": "Invalid parameters"}

    def get_default_params(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Get default parameters, overridden by any provided in data"""
        params = self.default_params.copy()
        
        # Add default empty messages list
        params["messages"] = data.get("messages", [])
        
        # Override defaults with provided values, ensuring max_tokens has a valid default
        for key in ["temperature", "max_tokens", "top_p", "frequency_penalty", "presence_penalty"]:
            if key in data:
                params[key] = float(data[key]) if key != "max_tokens" else int(data[key])
            elif key == "max_tokens":
                # Ensure max_tokens has the model's default value if not provided
                params[key] = self.model_config.get("max_tokens", AIModelDefaults.BASE_DEFAULTS["max_tokens"])
        
        return params

    def get_model_message(self, messages: Any, data: Dict[str, Any]) -> list:
        try:
            return messages
        except Exception as e:
            log.error(e)
            return []

    def get_response(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Get response from the model"""
        try:
            print("params", params)
            # Make the API call using litellm
            response = litellm.completion(
                model=params["model"],
                messages=params["messages"],
                temperature=params["temperature"],
                top_p=params["top_p"],
                max_tokens=params["max_tokens"],
                presence_penalty=params["presence_penalty"],
                frequency_penalty=params["frequency_penalty"],
                stream=params["stream"],
                drop_params=True
            )

            print("LiteLLM response", response)
            print("response_cost", response._hidden_params)
            # Extract usage information
            usage = response.usage
            
            # Calculate costs
            input_cost = (usage.prompt_tokens * self.input_token_price) / self.price_scale
            output_cost = (usage.completion_tokens * self.output_token_price) / self.price_scale
            total_cost = input_cost + output_cost
            
            # Calculate credits (assuming 1 credit = $0.001)
            credits = int(total_cost * 1000)
            
            return {
                "status": True,
                "data": {
                    "ai_response": response.choices[0].message.content,
                    "prompt_tokens": usage.prompt_tokens,
                    "completion_tokens": usage.completion_tokens,
                    "total_tokens": usage.total_tokens,
                    "cost": total_cost,
                    "credits": credits,
                    "price_input_token_1M": self.input_token_price,
                    "price_output_token_1M": self.output_token_price
                }
            }
            
        except Exception as e:
            log.error(f"Error getting response from {self.model_name}: {str(e)}")
            return {"status": False, "message": str(e)}

    def calculate_cost(self, usage: Dict[str, int]) -> float:
        """Calculate the cost for the given token usage"""
        input_cost = (usage["prompt_tokens"] * self.input_token_price) / self.price_scale
        output_cost = (usage["completion_tokens"] * self.output_token_price) / self.price_scale
        return input_cost + output_cost

    def calculate_credits(self, cost: float) -> int:
        """Calculate credits from cost (1 credit = $0.001)"""
        return int(cost * 1000)

    def calculate_input_token_price(self, usage: Dict[str, int]) -> float:
        """Calculate the input token price"""
        return self.input_token_price

    def calculate_output_token_price(self, usage: Dict[str, int]) -> float:
        """Calculate the output token price"""
        return self.output_token_price 