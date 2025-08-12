from typing import Generator
import json
import asyncio
from .llm_interface import UnifiedLLMInterface
import logging as log

def litellm_sse_generator(
    iface: UnifiedLLMInterface,
    params: dict,
    on_completion_callback=None,
) -> Generator[str, None, None]:
    """Async wrapper for :pymeth:`UnifiedLLMInterface.stream_response` output in
    Server-Sent Events (SSE) lines.

    Usage::

        generator = litellm_sse_generator(iface, params)
        return StreamingHttpResponse(generator, content_type="text/event-stream")

    Each chunk becomes::

        data: <text>\n\n
    When the stream finishes we send a *done* event so the browser knows the
    connection can be closed gracefully::

        event: done\n
data: ok\n\n
    The caller may inspect ``iface.last_usage / last_cost / last_credits`` once
    the generator exhausts.
    """
    # Ensure stream flag is on so our iface yields something.
    params = params.copy()
    params["stream"] = True

    try:
        chunk_count = 0
        for chunk in iface.stream_response(params):
            chunk_count += 1
            # SSE requires \n\n after each event block.
            yield f"data:{json.dumps(chunk)}\n\n"

        # Signal end of stream
        yield "event: done\n" "data: ok\n\n"
        
        if on_completion_callback:
            try:
                response_data = {
                    "ai_response": getattr(iface, 'full_content', ''),
                    "prompt_tokens": iface.last_usage.prompt_tokens if iface.last_usage else 0,
                    "completion_tokens": iface.last_usage.completion_tokens if iface.last_usage else 0,
                    "total_tokens": iface.last_usage.total_tokens if iface.last_usage else 0,
                    "cost": iface.last_cost if hasattr(iface, 'last_cost') else 0,
                    "credits": iface.last_credits if hasattr(iface, 'last_credits') else 0,
                }
                
                # This will run in a separate thread to avoid blocking
                import threading
                def run_callback():
                    try:
                        loop = asyncio.new_event_loop()
                        asyncio.set_event_loop(loop)
                        loop.run_until_complete(on_completion_callback(response_data))
                        loop.close()
                    except Exception as callback_error:
                        raise callback_error
                
                # Run callback in background thread so it doesn't block streaming
                callback_thread = threading.Thread(target=run_callback)
                callback_thread.daemon = True
                callback_thread.start()
                
            except Exception as e:
                log.error(f"Error in streaming callback: {e}")
                raise
                
    except Exception as e:
        log.error(f"Error in streaming: {e}")
        raise 