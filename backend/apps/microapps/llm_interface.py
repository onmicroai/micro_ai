from typing import Dict, Any, Optional
import litellm
import logging
from apps.utils.global_variables import UsageVariables
from .dynamic_model_service import DynamicModelService
import tempfile
import os
from litellm import speech
import requests
import json
from django.conf import settings
from .token_counter import token_counter

# Import LiteLLM utilities for cost calculation
try:
    from litellm import cost_per_token, model_cost as litellm_model_cost
except ImportError:
    cost_per_token = None
    litellm_model_cost = {}

log = logging.getLogger(__name__)

# LiteLLM intercepts this tool name, runs search, and finishes the completion
# itself. That path cannot stream: the proxy forces stream=False and returns
# one JSON body. Non-streaming callers still use it.
WEB_SEARCH_TOOL = {
    "type": "function",
    "function": {
        "name": "litellm_web_search",
        "description": "Search the web for current or factual information that is not already in the conversation.",
        "parameters": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "The search query to execute",
                }
            },
            "required": ["query"],
        },
    },
}

# Same contract as WEB_SEARCH_TOOL, but a name the proxy interceptor does not
# claim. Streaming callers run the search themselves, then stream the follow-up
# completion so the answer arrives token by token.
STREAMING_WEB_SEARCH_TOOL = {
    "type": "function",
    "function": {
        "name": "search_web",
        "description": WEB_SEARCH_TOOL["function"]["description"],
        "parameters": WEB_SEARCH_TOOL["function"]["parameters"],
    },
}

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
        self.model_family = DynamicModelService.get_model_family(self.model_name)
        
        # Set the API key for the model provider
        litellm.api_key = model_config.get("api_key")
        
        # Use dynamic model service to get configuration
        self.default_params = DynamicModelService.get_model_config(self.model_name)
        # Ensure the model path is set correctly for API calls
        self.default_params["model"] = model_config.get("model")

    def validate_params(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Validate the parameters for the model"""
        try:
            
            # Validate temperature (removed hard-coded limits, let models use their own defaults)
            if "temperature" in data:
                temp = float(data["temperature"])
                if temp < 0 or temp > 2:
                    return {"status": False, "message": "Temperature must be between 0 and 2"}

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
        
        # If a model is specified in data, get its full path from dynamic service
        if "model" in data:
            model_config = DynamicModelService.get_model_config(data["model"])
            params["model"] = model_config.get("model", self.default_params["model"])
        
        # Override with any user-provided values that exist in our params.
        # Skip nulls: a present-but-null field must not wipe a numeric default
        # (LiteLLM reports max_tokens as null).
        for key, value in data.items():
            if value is None or key not in params or key == "model":
                continue
            # Convert to appropriate type based on existing value's type
            if isinstance(params[key], bool):
                params[key] = bool(value)
            elif isinstance(params[key], int):
                params[key] = int(value)
            elif isinstance(params[key], float):
                params[key] = float(value)
            else:
                params[key] = value

        if not params.get("max_tokens"):
            params["max_tokens"] = 5000

        # Kept off the inherited defaults so only an explicit request opts in.
        if data.get("web_search"):
            params["web_search"] = True
        
        return params
    
        

    def get_model_message(self, messages: Any, data: Dict[str, Any]) -> list:
        try:
            return messages
        except Exception as e:
            log.error(e)
            return []

    def _make_proxy_request(
        self,
        params: Dict[str, Any],
        stream: bool = False,
        enable_thinking: bool = False,
        tools: Optional[list] = None,
        include_usage: bool = False,
        bypass_cache: bool = False,
    ) -> Any:
        """
        Make a request to the litellm proxy
        
        Args:
            params: Dictionary containing API parameters
            stream: Whether to stream the response
            enable_thinking: When True, enables extended thinking for Claude models
                             instead of the default disabled behaviour.
            
        Returns:
            Response object or generator for streaming
        """
        try:
            url = f"{settings.LITELLM_BASE_URL}/chat/completions"
            headers = {
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {settings.LITELLM_API_KEY}'
            }
            
            # Prepare the request payload
            payload = {
                "model": params["model"],
                "messages": params["messages"],
                #"temperature": params["temperature"],
                "max_tokens": params["max_tokens"],
                "stream": stream
            }

            
            # Add model-specific parameters based on model name if model is provided
            if "model" in params and params["model"]:
                model_name_lower = params["model"].lower()
                if "anthropic" in model_name_lower or "claude" in model_name_lower:
                    if enable_thinking:
                        payload["thinking"] = {"type": "enabled", "budget_tokens": 10000}
                    else:
                        payload["thinking"] = {"type": "disabled"}
                else:
                    payload["reasoning_effort"] = "low"
            
            if tools is not None:
                payload["tools"] = tools
            elif params.get("web_search"):
                payload["tools"] = [WEB_SEARCH_TOOL]

            # Search answers go stale; skip the shared response cache.
            if bypass_cache or tools is not None or params.get("web_search"):
                payload["cache"] = {"no-cache": True}

            if stream and include_usage:
                payload["stream_options"] = {"include_usage": True}

            if stream:
                # For streaming, return a generator
                response = requests.post(url, headers=headers, json=payload, stream=True)
                response.raise_for_status()
                
                def stream_generator():
                    for line in response.iter_lines():
                        if line:
                            line_str = line.decode('utf-8')
                            if line_str.startswith('data: '):
                                data_str = line_str[6:]  # Remove 'data: ' prefix
                                if data_str.strip() == '[DONE]':
                                    break
                                try:
                                    chunk_data = json.loads(data_str)
                                    yield chunk_data
                                except json.JSONDecodeError:
                                    continue
                
                return stream_generator()
            else:
                # For non-streaming, return the response
                response = requests.post(url, headers=headers, json=payload)
                response.raise_for_status()
                return response.json()
                
        except Exception as e:
            log.error(f"Error making proxy request: {str(e)}")
            raise e

    def _make_proxy_transcribe(self, params: Dict[str, Any]) -> Any:
        """
        Make a transcription request to the LiteLLM proxy

        Args:
            params: Dictionary containing transcription parameters

        Returns:
            Transcription response JSON
        """
        try:
            url = f"{settings.LITELLM_BASE_URL}/v1/audio/transcriptions"

            headers = {
                "Authorization": f"Bearer {settings.LITELLM_API_KEY}",
            }

            files = {
                "file": params["file"],
            }

            data = {
                "model": params["model"],
            }

            # Optional parameters
            for key in ("language", "prompt", "response_format", "temperature"):
                if key in params and params[key] is not None:
                    data[key] = params[key]

            response = requests.post(
                url,
                headers=headers,
                files=files,
                data=data,
                # TODO: Adjust timeout as needed
                timeout=60,
            )

            response.raise_for_status()
            return response.json()

        except Exception as e:
            log.error(f"Error making proxy transcription request: {str(e)}")
            raise
   
    def _make_proxy_tts(self, params: Dict[str, Any]) -> bytes:
       """
       Make a text-to-speech request via LiteLLM proxy

       Returns:
            Raw audio bytes
       """
       try:
           url = f"{settings.LITELLM_BASE_URL}/v1/audio/speech"

           headers = {
               "Authorization": f"Bearer {settings.LITELLM_API_KEY}",
               "Content-Type": "application/json",
           }

           payload = {
               "model": params["model"],
               "input": params["input"],
               "voice": params["voice"]
           }

           if params.get("instructions"):
               payload["instructions"] = params["instructions"]

           response = requests.post(
               url,
               headers=headers,
               json=payload,
               # TODO: Adjust timeout as needed
               timeout=60,
           )

           response.raise_for_status()
           return response.content

       except Exception as e:
           log.error(f"Error making proxy TTS request: {str(e)}")
           raise

    def get_response(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Get response from the model"""
        try:
            # Make the API call using litellm proxy
            response_data = self._make_proxy_request(params, stream=False)

            # Store response ID
            self.litellm_response_id = response_data.get("id")

            # Extract usage information
            usage = response_data.get("usage", {})
            
            # Calculate cost using standalone function
            transcription_cost = float(params.get("transcription_cost", 0))
            total_cost, credits = self.calculate_cost_from_usage(
                usage_data=usage,
                model=params["model"],
                transcription_cost=transcription_cost
            )
            
            return {
                "status": True,
                "data": {
                    "ai_response": response_data["choices"][0]["message"]["content"],
                    "prompt_tokens": usage.get("prompt_tokens", 0),
                    "completion_tokens": usage.get("completion_tokens", 0),
                    "total_tokens": usage.get("total_tokens", 0),
                    "cost": total_cost,
                    "credits": credits,
                    "litellm_response_id": self.litellm_response_id,
                }
            }
            
        except Exception as e:
            log.error(f"Error getting response from {self.model_name}: {str(e)}")
            return {"status": False, "message": str(e)}

    def _add_usage(self, usage: Any) -> None:
        if not isinstance(usage, dict):
            return
        if not isinstance(self.last_usage, dict):
            self.last_usage = {
                "prompt_tokens": 0,
                "completion_tokens": 0,
                "total_tokens": 0,
            }
        for key in ("prompt_tokens", "completion_tokens", "total_tokens"):
            self.last_usage[key] += int(usage.get(key) or 0)

    def _finish_stream_accounting(self, params: Dict[str, Any]) -> None:
        if self.last_usage is None:
            self.last_usage = token_counter.estimate_usage_for_streaming(
                messages=params.get("messages", []),
                full_content=self.full_content,
                model_name=params.get("model", ""),
            )
        transcription_cost = float(params.get("transcription_cost", 0))
        self.last_cost, self.last_credits = self.calculate_cost_from_usage(
            usage_data=self.last_usage,
            model=params["model"],
            transcription_cost=transcription_cost,
        )

    def _iter_completion_stream(self, response_stream):
        """Yield text deltas. Return any function-call deltas accumulated along the way."""
        tool_calls = []
        for chunk in response_stream:
            if not isinstance(chunk, dict):
                continue
            if chunk.get("id"):
                self.litellm_response_id = chunk["id"]
            if chunk.get("usage"):
                self._add_usage(chunk["usage"])

            choices = chunk.get("choices") or []
            if not choices or not isinstance(choices[0], dict):
                continue
            choice = choices[0]
            delta = choice.get("delta") or {}
            message = choice.get("message") or {}
            content = delta.get("content")
            if content is None:
                content = message.get("content") or ""
            if isinstance(content, str) and content:
                self.full_content += content
                yield content

            self._accumulate_tool_call_deltas(tool_calls, delta.get("tool_calls"))
            self._merge_complete_tool_calls(tool_calls, message.get("tool_calls"))

        return [call for call in tool_calls if call["name"] or call["arguments"]]

    @staticmethod
    def _accumulate_tool_call_deltas(tool_calls: list, deltas: Any) -> None:
        if not isinstance(deltas, list):
            return
        for delta in deltas:
            if not isinstance(delta, dict):
                continue
            index = delta.get("index", 0)
            if not isinstance(index, int) or index < 0:
                index = 0
            while len(tool_calls) <= index:
                tool_calls.append({"id": "", "name": "", "arguments": ""})
            slot = tool_calls[index]
            if delta.get("id"):
                slot["id"] = delta["id"]
            function = delta.get("function") or {}
            if function.get("name"):
                slot["name"] = function["name"]
            if function.get("arguments"):
                slot["arguments"] += function["arguments"]

    @staticmethod
    def _merge_complete_tool_calls(tool_calls: list, calls: Any) -> None:
        if not isinstance(calls, list):
            return
        for call in calls:
            if not isinstance(call, dict):
                continue
            function = call.get("function") or {}
            existing = next(
                (slot for slot in tool_calls if call.get("id") and slot["id"] == call["id"]),
                None,
            )
            if existing:
                if function.get("name"):
                    existing["name"] = function["name"]
                if function.get("arguments"):
                    existing["arguments"] = function["arguments"]
                continue
            tool_calls.append({
                "id": call.get("id") or "",
                "name": function.get("name") or "",
                "arguments": function.get("arguments") or "",
            })

    @staticmethod
    def _query_from_tool_arguments(arguments: str) -> str:
        text = arguments or ""
        try:
            parsed = json.loads(text)
        except json.JSONDecodeError:
            return text.strip()
        if isinstance(parsed, dict):
            return str(parsed.get("query") or parsed.get("q") or "").strip()
        return text.strip()

    @staticmethod
    def _tool_arguments_json(arguments: str) -> str:
        text = arguments or ""
        try:
            parsed = json.loads(text)
        except json.JSONDecodeError:
            return json.dumps({"query": text})
        if isinstance(parsed, dict):
            return json.dumps(parsed)
        return json.dumps({"query": text})

    def _search_web(self, query: str) -> str:
        query = (query or "").strip()
        if not query:
            return "No search query was provided."

        api_key = os.environ.get("TAVILY_API_KEY", "").strip()
        if len(api_key) >= 2 and api_key[0] == api_key[-1] and api_key[0] in "\"'":
            api_key = api_key[1:-1]
        if not api_key:
            log.error("TAVILY_API_KEY is not set; web search cannot run")
            return "Web search is unavailable."

        try:
            response = requests.post(
                "https://api.tavily.com/search",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "query": query,
                    "max_results": 5,
                    "search_depth": "basic",
                },
                timeout=30,
            )
            response.raise_for_status()
            data = response.json()
        except Exception as exc:
            log.error("Web search failed: %s", exc)
            return "Web search failed."

        parts = []
        answer = data.get("answer")
        if isinstance(answer, str) and answer.strip():
            parts.append(answer.strip())
        for index, result in enumerate(data.get("results") or [], 1):
            if not isinstance(result, dict):
                continue
            title = result.get("title") or "Result"
            url = result.get("url") or ""
            content = (result.get("content") or "")[:800]
            parts.append(f"[{index}] {title}\n{url}\n{content}".strip())
        return "\n\n".join(parts) if parts else "No results."

    def _assistant_tool_message(self, tool_calls: list) -> Dict[str, Any]:
        return {
            "role": "assistant",
            "content": None,
            "tool_calls": [
                {
                    "id": call["id"],
                    "type": "function",
                    "function": {
                        "name": call["name"] or STREAMING_WEB_SEARCH_TOOL["function"]["name"],
                        "arguments": self._tool_arguments_json(call["arguments"]),
                    },
                }
                for call in tool_calls
            ],
        }

    def _stream_web_search(self, params: Dict[str, Any]):
        """Let the model decide to search, then stream the answer that uses the results."""
        decision_params = {key: value for key, value in params.items() if key != "web_search"}
        decision_stream = self._make_proxy_request(
            decision_params,
            stream=True,
            tools=[STREAMING_WEB_SEARCH_TOOL],
            include_usage=True,
            bypass_cache=True,
        )
        tool_calls = yield from self._iter_completion_stream(decision_stream)

        if tool_calls:
            for index, call in enumerate(tool_calls):
                if not call["id"]:
                    call["id"] = f"search_web_{index}"
            messages = list(params.get("messages") or [])
            messages.append(self._assistant_tool_message(tool_calls))
            for call in tool_calls:
                messages.append({
                    "role": "tool",
                    "tool_call_id": call["id"],
                    "content": self._search_web(self._query_from_tool_arguments(call["arguments"])),
                })
            follow_up = {key: value for key, value in params.items() if key != "web_search"}
            follow_up["messages"] = messages
            answer_stream = self._make_proxy_request(
                follow_up,
                stream=True,
                include_usage=True,
                bypass_cache=True,
            )
            yield from self._iter_completion_stream(answer_stream)

        self._finish_stream_accounting(params)

    def stream_response(self, params: Dict[str, Any]):
        """
        A generator that yields model response chunks as soon as they arrive.

        This does **not** replace `get_response`.  Callers that want a streamed
        result should explicitly call `stream_response` instead of
        `get_response` and MUST pass `stream=True` in the `params` dict.

        On completion, the following instance attributes are set so that the
        caller can log usage / billing information once the stream is closed:

        * `self.last_usage`   – the final Usage object returned by LiteLLM (if
          available)
        * `self.last_cost`    – total cost (USD) including optional
          `transcription_cost`
        * `self.last_credits` – integer credits calculated from the cost
        * `self.full_content` – the concatenated text of all chunks
        """
        # Ensure downstream code can inspect these even if an error occurs
        self.last_usage = None
        self.last_cost = 0.0
        self.last_credits = 0
        self.full_content = ""
        self.litellm_response_id = None
        
        # Collect chunks for LiteLLM cost calculation
        collected_chunks = []

        try:
            # The proxy's web-search interceptor forces stream=False and returns
            # the finished answer in one body. Run the tool ourselves instead,
            # then stream the follow-up completion.
            if params.get("web_search"):
                yield from self._stream_web_search(params)
                return

            # Force streaming=True – caller is responsible for setting it but
            # we double-check so we don’t accidentally yield nothing.
            params = params.copy()
            params["stream"] = True

            # Initiate streaming completion using proxy
            response_stream = self._make_proxy_request(params, stream=True)

            # Iterate over the streaming chunks
            for chunk in response_stream:
                # Collect chunk for cost calculation
                collected_chunks.append(chunk)
                
                # Store LiteLLM response ID
                self.litellm_response_id = chunk["id"]
                
                # Process chunk from proxy response
                content = ""
                try:
                    content = chunk.get("choices", [{}])[0].get("delta", {}).get("content", "")
                except Exception:
                    content = ""

                if content:
                    self.full_content += content
                    yield content  # send chunk upstream immediately

                # Detect if this chunk carries full usage stats (varies by provider)
                if chunk.get("usage"):
                    self.last_usage = chunk["usage"]

            # If we never saw usage in a chunk, estimate it using token counting
            if self.last_usage is None:
                # Use token counter to estimate usage
                # IMPORTANT: Usage and costs with streaming and thinking models are not precise yet. It is an important path to keep track of improvments that will make our calculations more precise and fast. 
                self.last_usage = token_counter.estimate_usage_for_streaming(
                    messages=params.get("messages", []),
                    full_content=self.full_content,
                    model_name=params.get("model", "")
                )

            # Calculate cost using standalone function
            transcription_cost = float(params.get("transcription_cost", 0))
            self.last_cost, self.last_credits = self.calculate_cost_from_usage(
                usage_data=self.last_usage,
                model=params["model"],
                transcription_cost=transcription_cost
            )
            

        except Exception as e:
            log.error(f"Error streaming response from {self.model_name}: {str(e)}")
            # Propagate the exception to the caller – they can handle it just like
            # they would with get_response.
            raise e

    def calculate_credits(self, cost: float) -> int:
        """Calculate credits from cost (1 credit = $0.0001)"""
        credits = max(int(cost * UsageVariables.CREDITS_MULTIPLIER), UsageVariables.MINIMUM_CREDITS)
        return credits

    def calculate_cost_from_usage(self, usage_data: dict, model: str, transcription_cost: float = 0.0) -> tuple[float, int]:
        """
        Calculate cost and credits from usage data using LiteLLM's cost_per_token method.
        
        Args:
            usage_data: Dictionary containing token usage information
            model: The model identifier for cost calculation
            transcription_cost: Additional transcription cost to include
            
        Returns:
            Tuple of (total_cost, credits)
        """
        if cost_per_token is None or not usage_data:
            return 0.0, 0
        
        try:
            # Extract token counts
            if isinstance(usage_data, dict):
                prompt_tokens = usage_data.get("prompt_tokens", 0)
                completion_tokens = usage_data.get("completion_tokens", 0)
            else:
                prompt_tokens = getattr(usage_data, "prompt_tokens", 0)
                completion_tokens = getattr(usage_data, "completion_tokens", 0)

            
            # Calculate cost using LiteLLM's cost_per_token method
            prompt_cost, completion_cost_result = cost_per_token(
                model=model,
                prompt_tokens=prompt_tokens,
                completion_tokens=completion_tokens
            )
            
            llm_cost = prompt_cost + completion_cost_result
            total_cost = round(float(llm_cost) + transcription_cost, 6)
            credits = self.calculate_credits(total_cost)
            
            return total_cost, credits
            
        except Exception as e:
            log.error(f"Cost calculation failed: {e}")
            return 0.0, 0

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
            # Force non-streaming for score_response since it needs complete response
            api_params = api_params.copy()
            api_params["stream"] = False
            
            response_data = self._make_proxy_request(api_params, stream=False)
            
            # Store response ID
            self.litellm_response_id = response_data.get("id")
            
            usage = response_data.get("usage", {})
            
            # Calculate cost using standalone function
            total_cost, credits = self.calculate_cost_from_usage(
                usage_data=usage,
                model=api_params["model"],
                transcription_cost=0.0  # No transcription cost for scoring
            )
            from .score_utils import normalize_run_score_for_storage

            ai_score = normalize_run_score_for_storage(
                response_data["choices"][0]["message"]["content"]
            )
            score_result = False
            
            if self.extract_score(ai_score) >= minimum_score:
                score_result = True
                
            return {
                "prompt_tokens": usage.get("prompt_tokens", 0),
                "completion_tokens": usage.get("completion_tokens", 0),
                "total_tokens": usage.get("total_tokens", 0),
                "cost": total_cost,
                "credits": credits,
                "ai_score": ai_score,
                "score_result": score_result,
                "litellm_response_id": self.litellm_response_id
            }
            
        except Exception as e:
            log.error(f"Error getting scored response: {str(e)}")
            return {"status": False, "message": str(e)}

    
    def extract_score(self, response: Any) -> float:
        """
        Extract the total score from a JSON-formatted response string (or dict).

        Handles prose + fenced JSON from models that narrate before outputting JSON.
        """
        try:
            from .score_utils import parse_run_score_total

            v = parse_run_score_total(response)
            return float(v) if v is not None else 0.0
        except Exception as e:
            log.error(f"Error extracting score: {str(e)}")
            return 0.0

    def build_instruction(
        self,
        data: Dict[str, Any],
        messages: list,
        include_overall_feedback: bool = False,
    ) -> list:
        """
        Build scoring instruction message for the model.
        
        Args:
            data: Dictionary containing request data including rubric
            messages: List of existing conversation messages
            include_overall_feedback: When True, also request overall_rationale in JSON
            
        Returns:
            Updated list of messages with scoring instruction appended
        """
        try:
            rubric = str(data.get("rubric"))
            instruction = (
                "Score the previous user message using the rubric below. "
                "If the user message does not contain what you need for scoring, then you can check the fallback responses in the system prompt and use those if relevant."
                "Output ONLY valid JSON with no prose before or after. "
                "Use each rubric criterion name exactly as the JSON key. "
                'Each criterion value must be an object with numeric "score" and plain-language "rationale". '
                'Include a top-level "total" key with the sum of all criterion scores. '
            )
            if include_overall_feedback:
                custom_overall_instruction = str(
                    data.get("score_feedback_instructions", "") or ""
                ).strip()
                overall_instruction = (
                    custom_overall_instruction
                    if custom_overall_instruction
                    else "Provide a brief overall summary of what the learner did well and what to improve."
                )
                instruction += (
                    'Also include a top-level string key "overall_rationale" with plain-language overall feedback. '
                    + overall_instruction
                    + " "
                )
            example = (
                '{ "Criterion A": {"score": 3, "rationale": "..."}, '
                + (
                    '"overall_rationale": "...", '
                    if include_overall_feedback
                    else ""
                )
                + '"total": 8 }'
            )
            instruction += f"Example format: {example}. Rubric: {rubric}"
            messages.append({"role": "user", "content": instruction})
            return messages
        except Exception as e:
            log.error(f"Error building instruction: {str(e)}")
            return messages

    def stream_score_response(self, api_params: Dict[str, Any], minimum_score: float):
        """
        Stream a single scored response (scores + optional per-criterion rationale).

        Yields text chunks as they arrive. On completion sets:
        self.full_content, self.ai_score, self.score_result, usage/cost attrs.
        """
        self.last_usage = None
        self.last_cost = 0.0
        self.last_credits = 0
        self.full_content = ""
        self.litellm_response_id = None
        self.ai_score = ""
        self.score_result = False

        try:
            params = api_params.copy()
            params["stream"] = True
            response_stream = self._make_proxy_request(params, stream=True)
            collected_chunks = []

            for chunk in response_stream:
                collected_chunks.append(chunk)
                self.litellm_response_id = chunk.get("id")
                content = ""
                try:
                    content = chunk.get("choices", [{}])[0].get("delta", {}).get("content", "")
                except Exception:
                    content = ""

                if content:
                    self.full_content += content
                    yield content

                if chunk.get("usage"):
                    self.last_usage = chunk["usage"]

            if self.last_usage is None:
                self.last_usage = token_counter.estimate_usage_for_streaming(
                    messages=params.get("messages", []),
                    full_content=self.full_content,
                    model_name=params.get("model", ""),
                )

            from .score_utils import normalize_run_score_for_storage

            self.ai_score = normalize_run_score_for_storage(self.full_content)
            self.score_result = self.extract_score(self.ai_score) >= minimum_score

            self.last_cost, self.last_credits = self.calculate_cost_from_usage(
                usage_data=self.last_usage,
                model=params["model"],
                transcription_cost=0.0,
            )
        except Exception as e:
            log.error(f"Error streaming scored response from {self.model_name}: {str(e)}")
            raise e

    def build_score_explanation_instruction(self, data: Dict[str, Any], messages: list, score_json: str) -> list:
        """
        Build a user-friendly score explanation instruction message.
        
        Args:
            data: Dictionary containing request data including rubric
            messages: List of existing conversation messages
            score_json: The JSON string output from the scoring pass
            
        Returns:
            Updated list of messages with explanation instruction appended
        """
        try:
            custom_feedback_instruction = str(
                data.get("score_feedback_instructions", "") or ""
            ).strip()
            feedback_instruction = (
                custom_feedback_instruction
                if custom_feedback_instruction
                else "Call out what I did well and what can be improved, and why the score is what it is."
            )
            instruction = (
                "Explain the score in plain, user-friendly language. "
                "Use the rubric below and the score JSON to justify the result, but do not output JSON. "
                + feedback_instruction
                + " "
                f"Rubric: {str(data.get('rubric'))}. "
                f"Score JSON: {score_json}."
            )
            messages.append({"role": "user", "content": instruction})
            return messages
        except Exception as e:
            log.error(f"Error building score explanation instruction: {str(e)}")
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
                    # Make the API call to litellm with the file object
                    params: Dict[str, Any] = {
                        "model": "whisper-1",
                        "file": file,
                    }

                    response = self._make_proxy_transcribe(params)

                    # Debug logging
                    log.debug(f"LiteLLM response: {response}")

                    # Extract usage information and cost
                    usage = response.get("usage", {})
                    seconds = usage.get("seconds")

                    cost = None
                    if seconds is not None:
                        model_pricing = litellm_model_cost.get(params["model"], {})
                        cost_per_second = model_pricing.get("input_cost_per_second")
                        if cost_per_second is not None:
                            cost = seconds * cost_per_second
                        else:
                            cost = (seconds / 60) * 0.006  # Fallback to known Whisper cost if not available in litellm_model_cost
                    return {
                        "status": True,
                        "data": {
                            "text": response["text"],
                            "cost": cost
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
            params: Dict[str, Any] = {
               "model": "gpt-4o-mini-tts",
               "input": text,
               "voice": voice,
            }

            if instructions:
                  params["instructions"] = instructions

            audio_bytes = self._make_proxy_tts(params)
            return audio_bytes
            
        except Exception as e:
            log.error(f"Error in text_to_speech: {str(e)}")
            raise e