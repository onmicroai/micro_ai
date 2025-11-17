"""
Dynamic Model Service - Replaces hard-coded model configurations with LiteLLM API calls
"""
import requests
import logging
from typing import Dict, Any, Optional, List
from django.conf import settings
from django.core.cache import cache

log = logging.getLogger(__name__)

class DynamicModelService:
    """
    Service to dynamically retrieve model configurations from LiteLLM API
    instead of using hard-coded values from global_variables.py
    """
    
    CACHE_KEY = "litellm_models"
    CACHE_TIMEOUT = 300  # 5 minutes
    
    @classmethod
    def get_model_config(cls, model_name: str) -> Dict[str, Any]:
        """
        Get model configuration dynamically from LiteLLM API
        
        Args:
            model_name: The model identifier (e.g., "gpt-4o-mini", "claude-3-5-haiku")
            
        Returns:
            Dictionary containing model configuration
        """
        try:
            # Get all models from LiteLLM
            models_data = cls._get_litellm_models()
            
            # Find the specific model
            model_info = cls._find_model_info(models_data, model_name)
            
            if not model_info:
                log.warning(f"Model {model_name} not found in LiteLLM, using fallback config")
                return cls._get_fallback_config(model_name)
            
            # Build configuration from LiteLLM data
            config = cls._build_model_config(model_info, model_name)
            
            log.info(f"Retrieved dynamic config for {model_name}: {config}")
            return config
            
        except Exception as e:
            log.error(f"Error getting dynamic model config for {model_name}: {str(e)}")
            return cls._get_fallback_config(model_name)
    
    @classmethod
    def get_model_family(cls, model_name: str) -> str:
        """
        Get the model family (openai, anthropic, etc) from LiteLLM data
        
        Args:
            model_name: The model identifier
            
        Returns:
            Model family string
        """
        try:
            models_data = cls._get_litellm_models()
            model_info = cls._find_model_info(models_data, model_name)
            
            if model_info:
                return model_info.get('model_info', {}).get('litellm_provider', '')
            
            # Fallback to name-based inference
            return cls._infer_family_from_name(model_name)
            
        except Exception as e:
            log.error(f"Error getting model family for {model_name}: {str(e)}")
            return cls._infer_family_from_name(model_name)
    
    @classmethod
    def is_model_available_for_plan(cls, model_name: str, plan: str) -> bool:
        """
        Check if a model is available for a specific plan
        
        Args:
            model_name: The model identifier
            plan: The subscription plan (free, pro, enterprise)
            
        Returns:
            Boolean indicating availability
        """
        try:
            models_data = cls._get_litellm_models()
            model_info = cls._find_model_info(models_data, model_name)
            
            if model_info:
                access_groups = model_info.get('model_info', {}).get('access_groups', [])
                return plan in access_groups
            
            # Fallback - assume available for all plans if not found
            return True
            
        except Exception as e:
            log.error(f"Error checking model availability for {model_name}: {str(e)}")
            return True
    
    @classmethod
    def get_models_for_plan(cls, plan: str) -> List[str]:
        """
        Get all models available for a specific plan
        
        Args:
            plan: The subscription plan
            
        Returns:
            List of model names available for the plan
        """
        try:
            models_data = cls._get_litellm_models()
            available_models = []
            
            for model in models_data:
                access_groups = model.get('model_info', {}).get('access_groups', [])
                if plan in access_groups:
                    available_models.append(model.get('model_name'))
            
            return available_models
            
        except Exception as e:
            log.error(f"Error getting models for plan {plan}: {str(e)}")
            return []
    
    @classmethod
    def _get_litellm_models(cls) -> List[Dict[str, Any]]:
        """
        Get models from LiteLLM API with caching
        
        Returns:
            List of model information from LiteLLM
        """
        # Check cache first
        cached_models = cache.get(cls.CACHE_KEY)
        if cached_models:
            return cached_models
        
        try:
            # Query LiteLLM API
            litellm_url = f"{settings.LITELLM_BASE_URL}/v1/model/info"
            headers = {
                'accept': 'application/json',
                'x-litellm-api-key': settings.LITELLM_API_KEY
            }
            
            log.info(f"Fetching models from LiteLLM: {litellm_url}")
            response = requests.get(litellm_url, headers=headers, timeout=10)
            response.raise_for_status()
            
            data = response.json()
            models = data.get('data', [])
            
            # Cache the results
            cache.set(cls.CACHE_KEY, models, cls.CACHE_TIMEOUT)
            
            log.info(f"Retrieved {len(models)} models from LiteLLM")
            return models
            
        except Exception as e:
            log.error(f"Error fetching models from LiteLLM: {str(e)}")
            return []
    
    @classmethod
    def _find_model_info(cls, models_data: List[Dict[str, Any]], model_name: str) -> Optional[Dict[str, Any]]:
        """
        Find model information by model name
        
        Args:
            models_data: List of model data from LiteLLM
            model_name: The model identifier to find
            
        Returns:
            Model information dictionary or None
        """
        for model in models_data:
            if model.get('model_name') == model_name:
                return model
        return None
    
    @classmethod
    def _build_model_config(cls, model_info: Dict[str, Any], model_name: str) -> Dict[str, Any]:
        """
        Build model configuration from LiteLLM model info
        
        Args:
            model_info: Model information from LiteLLM
            model_name: The model identifier
            
        Returns:
            Configuration dictionary
        """
        model_data = model_info.get('model_info', {})
        
        config = {
            "model": model_info.get('model_name', model_name),
            "api_key": settings.LITELLM_API_KEY,  # Always use master key
            "max_tokens": model_data.get('max_tokens', 5000),  # Fallback
            "supports_image": model_data.get('supports_vision', False),
            "stream": cls._infer_stream_capability(model_name),
            "plans": model_data.get('access_groups', []),
            "family": cls._infer_family_from_name(model_name),
            "supports_function_calling": model_data.get('supports_function_calling', False),
            "supports_tool_choice": model_data.get('supports_tool_choice', False),
            "supports_audio_input": model_data.get('supports_audio_input', False),
            "supports_audio_output": model_data.get('supports_audio_output', False),
            "supports_pdf_input": model_data.get('supports_pdf_input', False),
            "supports_reasoning": model_data.get('supports_reasoning', False),
            "max_input_tokens": model_data.get('max_input_tokens'),
            "max_output_tokens": model_data.get('max_output_tokens'),
            "input_cost_per_token": model_data.get('input_cost_per_token'),
            "output_cost_per_token": model_data.get('output_cost_per_token'),
            "litellm_provider": model_data.get('litellm_provider', ''),
        }
        
        return config
    
    @classmethod
    def _infer_stream_capability(cls, model_name: str) -> bool:
        """
        Infer streaming capability from model name
        
        Args:
            model_name: The model identifier
            
        Returns:
            Boolean indicating if model supports streaming
        """
        model_lower = model_name.lower()
        
        # O1 and O3 models don't support streaming
        if "o1" in model_lower or "o3" in model_lower:
            return False
        
        # Everything else supports streaming
        return True
    
    @classmethod
    def _infer_family_from_name(cls, model_name: str) -> str:
        """
        Infer model family from model name
        
        Args:
            model_name: The model identifier
            
        Returns:
            Model family string
        """
        model_lower = model_name.lower()
        
        if "gpt" in model_lower or "openai" in model_lower:
            return "openai"
        elif "claude" in model_lower or "anthropic" in model_lower:
            return "anthropic"
        elif "gemini" in model_lower or "google" in model_lower:
            return "gemini"
        elif "sonar" in model_lower or "perplexity" in model_lower:
            return "perplexity"
        elif "deepseek" in model_lower:
            return "deepseek"
        else:
            return "unknown"
    
    @classmethod
    def _get_fallback_config(cls, model_name: str) -> Dict[str, Any]:
        """
        Get fallback configuration when LiteLLM API is unavailable
        
        Args:
            model_name: The model identifier
            
        Returns:
            Basic fallback configuration
        """
        log.warning(f"Using fallback config for {model_name}")
        
        return {
            "model": model_name,
            "api_key": settings.LITELLM_API_KEY,
            "max_tokens": 5000,
            "supports_image": False,
            "stream": cls._infer_stream_capability(model_name),
            "plans": ["free", "pro", "enterprise"],  # Default to all plans
            "family": cls._infer_family_from_name(model_name),
            "supports_function_calling": False,
            "supports_tool_choice": False,
            "supports_audio_input": False,
            "supports_audio_output": False,
            "supports_pdf_input": False,
            "supports_reasoning": False,
        }