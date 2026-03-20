/**
 * Incremental Server-Sent Events parsing: frames on \n\n, leftover buffer at EOF.
 * Matches typical Django / SSE deployments (event: + data: lines).
 */

export interface ParsedSseEvent {
  /** SSE event name; default "message" if omitted */
  event: string;
  /** Concatenated data: payload (multiline data: joined with \n) */
  data: string;
}

/**
 * Parse one SSE event block (without trailing \n\n).
 */
export function parseSseEventBlock(raw: string): ParsedSseEvent {
  const lines = raw.split("\n");
  let eventType = "message";
  const dataLines: string[] = [];

  for (const l of lines) {
    if (l.startsWith("event:")) {
      eventType = l.slice(6).trim();
    } else if (l.startsWith("data:")) {
      dataLines.push(l.slice(5));
    }
  }

  return { event: eventType, data: dataLines.join("\n") };
}

/**
 * Read a fetch Response body as SSE events until the stream closes.
 */
export async function* readSseResponse(
  response: Response
): AsyncGenerator<ParsedSseEvent, void, unknown> {
  if (!response.body) {
    throw new Error("SSE response missing body");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    buffer += decoder.decode(value, { stream: true });

    let idx: number;
    while ((idx = buffer.indexOf("\n\n")) !== -1) {
      const rawEvent = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      if (rawEvent.trim() !== "") {
        yield parseSseEventBlock(rawEvent);
      }
    }
  }

  if (buffer.trim() !== "") {
    yield parseSseEventBlock(buffer.trim());
  }
}
