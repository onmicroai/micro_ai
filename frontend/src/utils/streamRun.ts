/*
 * streamRun.ts – Helper to POST to the Django /run/stream endpoint and read
 * Server-Sent Events incrementally.
 *
 * Usage:
 *   streamRun({ ...payload }, {
 *     onChunk: (text) => appendToUI(text),
 *     onDone: (final) => console.log("stream complete", final),
 *     onError: (err) => console.error(err)
 *   });
 */

export interface StreamCallbacks {
  onChunk: (text: string) => void;
  onDone?: (meta?: unknown) => void;
  onError?: (err: unknown) => void;
}

// Decide endpoint once, can be extended to anonymous later
function getEndpoint(userId: number | null) {
  return userId ? "/api/microapps/run/stream" : "/api/microapps/run/stream";
}

export async function streamRun(
  payload: Record<string, unknown>,
  userId: number | null,
  { onChunk, onDone, onError }: StreamCallbacks
) {
  try {
    const endpoint = getEndpoint(userId);

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify(payload),
    });

    if (!response.ok || !response.body) {
      throw new Error(`Stream request failed (${response.status})`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // Process complete SSE event blocks (\n\n delimiter)
      let idx;
      while ((idx = buffer.indexOf("\n\n")) !== -1) {
        const rawEvent = buffer.slice(0, idx); // keep exact spacing
        buffer = buffer.slice(idx + 2); // remove delimiter but keep rest
        handleEvent(rawEvent, onChunk, onDone);
      }
    }

    // Drain any remaining buffered event (rare)
    if (buffer.trim()) {
      handleEvent(buffer.trim(), onChunk, onDone);
    }

    onDone?.();
  } catch (err) {
    console.error("streamRun error", err);
    onError?.(err);
  }
}

function handleEvent(
  raw: string,
  onChunk: (t: string) => void,
  onDone?: (meta?: unknown) => void
) {
  // Split by newline, strip leading prefixes
  const lines = raw.split(/\n/);
  let eventType = "message";
  const dataLines: string[] = [];

  for (const l of lines) {
    if (l.startsWith("event:")) {
      eventType = l.slice(6).trim();
    } else if (l.startsWith("data:")) {
      // Preserve leading spaces exactly as sent
      dataLines.push(l.slice(5));
    }
  }

  const data = dataLines.join("\n");

  if (eventType === "done") {
    onDone?.(data);
  } else if (eventType === "message" || eventType === "") {
    // Regular data chunk
    if (data !== "") {
      try {
        const decodedChunk = JSON.parse(data);
        onChunk(decodedChunk);
      } catch (e) {
        // Fallback for non-JSON data
        onChunk(data);
      }
    }
  }
} 