from typing import Dict, Any, Optional
import litellm
from django.conf import settings
import logging

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
                - max_completion_tokens: Default max completion tokens
                - price_scale: Price scaling factor (usually 1M for per-million pricing)
                - stream: Whether to stream the response
        """
        self.model_config = model_config
        self.model_name = model_config.get("model")
        
        # Set the API key for the model provider
        litellm.api_key = model_config.get("api_key")
        
        # Default parameters
        self.default_params = {
            "model": self.model_name,
            "temperature": model_config.get("temperature", 1.0),
            "max_completion_tokens": model_config.get("max_completion_tokens_default", 2000),
            "top_p": model_config.get("top_p", 1.0),
            "frequency_penalty": model_config.get("frequency_penalty", 0),
            "presence_penalty": model_config.get("presence_penalty", 0),
            "stream": model_config.get("stream", False)
        }
        
        # Price configuration
        self.price_scale = model_config.get("price_scale", 1_000_000.0)
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

            # Validate max_tokens
            if "max_tokens" in data:
                tokens = int(data["max_tokens"])
                if tokens < 1 or tokens > self.model_config.get("max_tokens_limit", 4000):
                    return {"status": False, "message": f"Max tokens must be between 1 and {self.model_config.get('max_tokens_limit', 4000)}"}

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
        
        # Override defaults with provided values
        for key in ["temperature", "max_tokens", "top_p", "frequency_penalty", "presence_penalty"]:
            if key in data:
                params[key] = float(data[key]) if key != "max_tokens" else int(data[key])
        
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
                max_completion_tokens=params["max_completion_tokens"],
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