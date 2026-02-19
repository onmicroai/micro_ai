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
  onScore?: (scoreData: ScoreData) => void;
}

export interface ScoreData {
  run_score: string;
  run_passed: boolean;
  minimum_score: number;
  rubric: string;
  scored_run: boolean;
  score_explanation?: boolean;
  score_explanation_mode?: "always" | "failed_only" | "passed_only" | "never";
  score_feedback_enabled?: boolean;
  score_feedback_instructions?: string;
  run_uuid?: string;
  credits?: number;
  cost?: number;
}

// Decide endpoint once, can be extended to anonymous later
function getEndpoint(userId: number | null) {
  return userId ? "/api/microapps/run" : "/api/microapps/run";
}

export async function streamRun(
  payload: Record<string, unknown>,
  userId: number | null,
  { onChunk, onDone, onError, onScore }: StreamCallbacks,
  options?: { endpoint?: string }
): Promise<Response | null> {
  try {
    const endpoint = options?.endpoint ?? getEndpoint(userId);

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Request failed (${response.status})`);
    }

    // Check if response is streaming (SSE) or JSON
    const contentType = response.headers.get('content-type');
    if (!contentType?.includes('text/event-stream')) {
      return response;
    }

    if (!response.body) {
      throw new Error(`Stream response missing body`);
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
        handleEvent(rawEvent, onChunk, onDone, onScore);
      }
    }

    // Drain any remaining buffered event (rare)
    if (buffer.trim()) {
      handleEvent(buffer.trim(), onChunk, onDone, onScore);
    }

    onDone?.();
    return null;
  } catch (err) {
    console.error("streamRun error", err);
    onError?.(err);
    return null;
  }
}

function handleEvent(
  raw: string,
  onChunk: (t: string) => void,
  onDone?: (meta?: unknown) => void,
  onScore?: (scoreData: ScoreData) => void
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
    if (data !== "") {
      try {
        onDone?.(JSON.parse(data));
      } catch {
        onDone?.(data);
      }
    } else {
      onDone?.();
    }
  } else if (eventType === "score") {
    if (data !== "") {
      try {
        const scoreData = JSON.parse(data) as ScoreData;
        onScore?.(scoreData);
      } catch (e) {
        console.error("Failed to parse score data:", e);
      }
    }
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