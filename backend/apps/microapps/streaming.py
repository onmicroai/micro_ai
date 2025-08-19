from typing import AsyncGenerator
import json
import asyncio
from .llm_interface import UnifiedLLMInterface
import logging as log
from asgiref.sync import sync_to_async

async def litellm_sse_generator(
    iface: UnifiedLLMInterface,
    params: dict,
    on_completion_callback=None,
) -> AsyncGenerator[str, None]:
    """Asynchronous SSE generator for both development and production
    
    Args:
        iface (UnifiedLLMInterface): The LLM interface instance that handles API calls
        params (dict): Parameters for the LLM API call containing:
            - model (str): The model identifier (e.g., "gpt-4", "claude-3")
            - messages (list): List of message objects with 'role' and 'content'
            - temperature (float, optional): Sampling temperature (0.0-2.0)
            - max_tokens (int, optional): Maximum tokens to generate
            - stream (bool): Will be set to True automatically for streaming
        on_completion_callback (callable, optional): Async function to call when streaming completes.
            Should accept a single parameter (response_data dict) containing:
            - ai_response (str): Complete AI response text
            - prompt_tokens (int): Number of input tokens used
            - completion_tokens (int): Number of output tokens generated
            - total_tokens (int): Total tokens used
            - cost (float): Cost in USD for the API call
            - credits (int): Credits consumed for the run
    
    Yields:
        str: Server-Sent Event formatted strings in the format:
            - "data:{json_chunk}\\n\\n" for each content chunk
            - "event: done\\ndata: ok\\n\\n" when streaming completes
    
    Raises:
        Exception: Re-raises any exceptions from the LLM interface or callback
        
    Usage::
        generator = litellm_sse_generator(iface, params)
        return StreamingHttpResponse(generator, content_type="text/event-stream")
    
    Note:
        The caller may inspect ``iface.last_usage / last_cost / last_credits`` once
        the generator exhausts.
    """
    # Ensure stream flag is on so our iface yields something.
    params = params.copy()
    params["stream"] = True

    try:
        for chunk in iface.stream_response(params):
            # SSE requires \n\n after each event block.
            yield f"data:{json.dumps(chunk)}\n\n"
            await asyncio.sleep(0)

        # Call completion callback with usage data if provided
        score_data = None
        if on_completion_callback:
            try:
                # Create response data structure matching get_response format
                response_data = {
                    "ai_response": getattr(iface, 'full_content', ''),
                    "prompt_tokens": iface.last_usage.prompt_tokens if iface.last_usage else 0,
                    "completion_tokens": iface.last_usage.completion_tokens if iface.last_usage else 0,
                    "total_tokens": iface.last_usage.total_tokens if iface.last_usage else 0,
                    "cost": iface.last_cost if hasattr(iface, 'last_cost') else 0,
                    "credits": iface.last_credits if hasattr(iface, 'last_credits') else 0,
                }
                # Sync callback with Django ORM needs to run in a thread
                # (save_streaming_run is always sync)
                score_data = await sync_to_async(on_completion_callback)(response_data)
            except Exception as e:
                log.error(f"Error in streaming callback: {e}")
                raise
        
        if score_data:
            yield f"event: score\ndata: {json.dumps(score_data)}\n\n"
        
        yield "event: done\ndata: ok\n\n"
                
    except Exception as e:
        log.error(f"Error in streaming: {e}")
        raise