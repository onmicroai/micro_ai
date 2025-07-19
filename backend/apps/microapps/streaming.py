from typing import Generator
from .llm_interface import UnifiedLLMInterface


def litellm_sse_generator(
    iface: UnifiedLLMInterface,
    params: dict,
) -> Generator[str, None, None]:
    """Wrap :pymeth:`UnifiedLLMInterface.stream_response` output in
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
        for chunk in iface.stream_response(params):
            # SSE requires \n\n after each event block.
            yield f"data: {chunk}\n\n"

        # Signal end of stream
        yield "event: done\n" "data: ok\n\n"
    finally:
        # Nothing special, but could be used for cleanup/logging.
        pass 