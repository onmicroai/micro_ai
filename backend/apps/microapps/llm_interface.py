from typing import Dict, Any, Optional
import litellm
from django.conf import settings
import logging
from apps.utils.global_variables import UsageVariables, AIModelConstants
import re
import tempfile
import os
from pathlib import Path
from litellm import speech

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
                - stream: Whether to stream the response
        """
        self.model_config = model_config
        self.model_name = model_config.get('model', '')
        self.model_family = AIModelConstants.get_model_family(self.model_name)
        
        # Set the API key for the model provider
        litellm.api_key = model_config.get("api_key")
        
        # Use our new inheritance logic to get all defaults and overrides
        self.default_params = AIModelConstants.get_configs(self.model_name)
        # Ensure the model path is set correctly for API calls
        self.default_params["model"] = model_config.get("model")

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
        """Get default parameters, with proper inheritance chain:
        1. BASE_DEFAULTS (lowest priority)
        2. Family defaults (from AIModelFamilyDefaults)
        3. Model-specific defaults (from AIModelConstants)
        4. User-provided data (highest priority)
        """
        # Start with base defaults
        params = self.default_params.copy()
        
        # Add required parameters that may not be in defaults
        params["messages"] = data.get("messages", [])
        
        # If a model is specified in data, get its full path from AIModelConstants
        if "model" in data:
            model_config = AIModelConstants.get_configs(data["model"])
            params["model"] = model_config.get("model", self.default_params["model"])
        
        # Override with any user-provided values that exist in our params
        for key, value in data.items():
            if key in params and key != "model":  # Skip model as we handled it above
                # Convert to appropriate type based on existing value's type
                if isinstance(params[key], bool):
                    params[key] = bool(value)
                elif isinstance(params[key], int):
                    params[key] = int(value)
                elif isinstance(params[key], float):
                    params[key] = float(value)
                else:
                    params[key] = value
        
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

            # Extract usage information
            usage = response.usage
            
            # Calculate costs
            llm_cost = response._hidden_params["response_cost"]
            transcription_cost = float(params.get("transcription_cost", 0))
            total_cost = round(llm_cost + transcription_cost, 6)
            
            # Calculate credits (assuming 1 credit = $0.0001)
            credits = self.calculate_credits(total_cost)
            
            return {
                "status": True,
                "data": {
                    "ai_response": response.choices[0].message.content,
                    "prompt_tokens": usage.prompt_tokens,
                    "completion_tokens": usage.completion_tokens,
                    "total_tokens": usage.total_tokens,
                    "cost": total_cost,
                    "credits": credits,
                }
            }
            
        except Exception as e:
            log.error(f"Error getting response from {self.model_name}: {str(e)}")
            return {"status": False, "message": str(e)}

    def calculate_credits(self, cost: float) -> int:
        """Calculate credits from cost (1 credit = $0.0001)"""
        credits = max(int(cost * UsageVariables.CREDITS_MULTIPLIER), UsageVariables.MINIMUM_CREDITS)
        return credits

    def score_response(self, api_params: Dict[str, Any], minimum_score: float) -> Dict[str, Any]:
        """
        Get a scored response from the model.
        
        Args:
            api_params: Dictionary containing API parameters
            minimum_score: Minimum score required to pass
            
        Returns:
            Dictionary containing:
                - completion_tokens: Number of tokens in completion
                - prompt_tokens: Number of tokens in prompt
                - total_tokens: Total tokens used
                - ai_score: The score response from the AI
                - score_result: Boolean indicating if score meets minimum
        """
        try:
            response = litellm.completion(
                model=api_params["model"],
                messages=api_params["messages"],
                temperature=api_params["temperature"],
                top_p=api_params["top_p"],
                max_tokens=api_params["max_tokens"],
                presence_penalty=api_params["presence_penalty"],
                frequency_penalty=api_params["frequency_penalty"],
                stream=api_params["stream"],
                drop_params=True
            )
            
            usage = response.usage
            total_cost = response._hidden_params["response_cost"]
            credits = self.calculate_credits(total_cost)
            ai_score = response.choices[0].message.content
            score_result = False
            
            if self.extract_score(ai_score) >= minimum_score:
                score_result = True
                
            return {
                "prompt_tokens": usage.prompt_tokens,
                "completion_tokens": usage.completion_tokens,
                "total_tokens": usage.total_tokens,
                "cost": total_cost,
                "credits": credits,
                "ai_score": ai_score,
                "score_result": score_result
            }
            
        except Exception as e:
            log.error(f"Error getting scored response: {str(e)}")
            return {"status": False, "message": str(e)}

    def extract_score(self, response: str) -> int:
        """
        Extract the total score from a JSON-formatted response string.
        
        Args:
            response: The response string containing a JSON object with a 'total' field
            
        Returns:
            The total score as an integer, or 0 if no valid score found
        """
        try:
            pattern = r'"total":\s*"?(\d+)"?'
            match = re.search(pattern, response)
            if match:
                return int(match.group(1))
            return 0
        except Exception as e:
            log.error(f"Error extracting score: {str(e)}")
            return 0

    def build_instruction(self, data: Dict[str, Any], messages: list) -> list:
        """
        Build scoring instruction message for the model.
        
        Args:
            data: Dictionary containing request data including rubric
            messages: List of existing conversation messages
            
        Returns:
            Updated list of messages with scoring instruction appended
        """
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
            log.error(f"Error building instruction: {str(e)}")
            return messages

    def transcribe_audio(self, audio_file: bytes) -> Dict[str, Any]:
        """
        Transcribe audio using LiteLLM's Whisper implementation.
        
        Args:
            audio_file: The audio file content in bytes
            
        Returns:
            Dictionary containing:
                - status: Boolean indicating success
                - data: Dictionary containing:
                    - text: The transcribed text
                    - cost: The cost of the transcription
        """
        try:
            # Create a temporary file to ensure proper file handling
            with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as temp_file:
                temp_file.write(audio_file)
                temp_file.flush()
                
                # Open the file in binary read mode for the API call
                with open(temp_file.name, 'rb') as file:
                    # Make the API call using litellm with the file object
                    response = litellm.transcription(
                        model="whisper-1",
                        file=file
                    )

                    # Debug logging
                    log.debug(f"LiteLLM response: {response}")

                    # Extract usage information and cost
                    total_cost = response._hidden_params["response_cost"]
                    
                    return {
                        "status": True,
                        "data": {
                            "text": response.text,
                            "cost": total_cost
                        }
                    }
            
        except Exception as e:
            log.error(f"Error transcribing audio: {str(e)}")
            return {"status": False, "message": str(e)}
        finally:
            # Clean up the temporary file
            if 'temp_file' in locals():
                try:
                    os.unlink(temp_file.name)
                except Exception as e:
                    log.error(f"Error cleaning up temporary file: {str(e)}")

    def text_to_speech(self, text: str, voice: str = 'alloy', instructions: Optional[str] = None) -> bytes:
        """
        Convert text to speech using OpenAI's TTS model
        
        Args:
            text (str): The text to convert to speech
            voice (str): The voice to use (default: 'alloy')
            instructions (Optional[str]): Optional voice instructions
            
        Returns:
            bytes: The audio data in MP3 format
        """
        try:
            # Get model config
            model_config = AIModelConstants.get_configs('gpt-4o-mini-tts')
            
            # Set API key from config
            os.environ["OPENAI_API_KEY"] = model_config.get('api_key', '')
            
            # Make the TTS request
            response = speech(
                model="openai/gpt-4o-mini-tts",
                voice=voice,
                input=text,
                instructions=instructions
            )
            
            # Get the audio data
            print("RESPONSE", response)
            print("HIDDEN PARAMS", response._hidden_params)

            audio_data = response.content
            
            return audio_data
            
        except Exception as e:
            log.error(f"Error in text_to_speech: {str(e)}")
            raise e