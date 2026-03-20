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

import { authorizedFetch } from "./authorizedFetch";
import { readSseResponse } from "./readSseStream";

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

    const response = await authorizedFetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Request failed (${response.status})`);
    }

    const contentType = response.headers.get("content-type");
    if (!contentType?.includes("text/event-stream")) {
      return response;
    }

    for await (const { event, data } of readSseResponse(response)) {
      dispatchStreamRunEvent(event, data, onChunk, onDone, onScore);
    }

    onDone?.();
    return null;
  } catch (err) {
    console.error("streamRun error", err);
    onError?.(err);
    return null;
  }
}

function dispatchStreamRunEvent(
  eventType: string,
  data: string,
  onChunk: (t: string) => void,
  onDone?: (meta?: unknown) => void,
  onScore?: (scoreData: ScoreData) => void
) {
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
    if (data !== "") {
      try {
        const decodedChunk = JSON.parse(data);
        onChunk(decodedChunk);
      } catch {
        onChunk(data);
      }
    }
  }
}
