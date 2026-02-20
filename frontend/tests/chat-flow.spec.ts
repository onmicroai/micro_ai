/**
 * Chat flow: voice message (audio file) → /transcribe (STT) → /run (AI) → /tts (TTS).
 *
 * We send a real audio file via the chat's test hook; the real /transcribe request is sent
 * (no mock), so you get real speech-to-text from the backend.
 *
 * Verifies: transcribe request includes audio payload; response has text and cost; /run has transcription_cost; /tts returns audio.
 */
import { test, expect } from "@playwright/test";
import path from "path";
import { TEST_IDS } from "@/constants/testIds";
import {
  collectRunUuids,
  verifyRunsPersistedAndCharged,
} from "./utils/runVerification";

const SIMULATED_VOICE_MESSAGE_TEXT =
  "I want to have a conversation about the space";
const EXPECTED_STT_WORDS = [
  "I",
  "want",
  "to",
  "have",
  "a",
  "conversation",
  "about",
  "the",
  "space",
];
const STT_MATCH_THRESHOLD = 0.95;

function wordMatchRatio(transcribed: string, expectedWords: string[]): number {
  const lower = transcribed.toLowerCase();
  const matched = expectedWords.filter((w) => lower.includes(w.toLowerCase()));
  return matched.length / expectedWords.length;
}

test.describe("Chat audio flow (transcribe → run → tts)", () => {
  test("simulated voice message: transcribe, run, and tts succeed", async ({
    page,
    request,
  }) => {
    const runUuids = collectRunUuids(page);

    const transcribeRequestPromise = page.waitForRequest(
      (req) =>
        req.url().includes("/api/microapps/transcribe/") &&
        req.method() === "POST",
      { timeout: 30000 }
    );

    const transcribeResponsePromise = page.waitForResponse(
      (res) =>
        res.url().includes("/api/microapps/transcribe/") &&
        res.request().method() === "POST" &&
        res.status() === 200,
      { timeout: 30000 }
    );

    const runRequestPromise = page.waitForRequest(
      (req) =>
        req.url().includes("/api/microapps/run") && req.method() === "POST",
      { timeout: 30000 }
    );

    const ttsResponsePromise = page.waitForResponse(
      (res) =>
        res.url().includes("/api/microapps/tts/") &&
        res.request().method() === "POST" &&
        res.status() === 200,
      { timeout: 30000 }
    );

    await page.goto(process.env.TEST_APP_URL || "");

    const chatInput = page.getByTestId(TEST_IDS.CHAT_AUDIO_UPLOAD_INPUT);
    await expect(chatInput).toBeAttached({ timeout: 15000 });

    // Simulate user sending a voice message: use fixture audio (content doesn't matter; we mock transcribe response)
    const audioPath = path.resolve(__dirname, "fixtures/stt.wav");
    await chatInput.setInputFiles(audioPath);
    await page.waitForTimeout(2000);

    const [transcribeRequest, transcribeResponse, runRequest, ttsResponse] =
      await Promise.all([
        transcribeRequestPromise,
        transcribeResponsePromise,
        runRequestPromise,
        ttsResponsePromise,
      ]);

    // Transcribe request must include the audio in the payload (real request – visible in Network when Preserve log is on)
    expect(transcribeRequest.method()).toBe("POST");
    expect(transcribeRequest.url()).toMatch(/transcribe/);
    const contentType =
      transcribeRequest.headers()["content-type"] ||
      transcribeRequest.headers()["Content-Type"] ||
      "";
    expect(
      contentType.toLowerCase().includes("multipart/form-data"),
      "Transcribe request should send multipart/form-data (audio file)"
    ).toBe(true);

    // STT response: text and cost (normalize for trailing punctuation, e.g. backend adds a period)
    const transcribeBody = await transcribeResponse.json();
    const normalizeText = (s: string) => s?.trim().replace(/\.$/, "") ?? "";
    expect(normalizeText(transcribeBody?.text)).toBe(
      normalizeText(SIMULATED_VOICE_MESSAGE_TEXT)
    );
    expect(typeof transcribeBody?.cost).toBe("number");
    expect(transcribeBody?.cost).toBeGreaterThan(0);

    const transcribedText = String(transcribeBody?.text ?? "");
    const ratio = wordMatchRatio(transcribedText, EXPECTED_STT_WORDS);
    expect(
      ratio >= STT_MATCH_THRESHOLD,
      `STT text should contain ≥${
        STT_MATCH_THRESHOLD * 100
      }% of expected words. Got: "${transcribedText}", ratio: ${ratio}`
    ).toBe(true);

    const runPostData = runRequest.postDataJSON();
    expect(
      runPostData,
      "Run request should include transcription_cost (STT)"
    ).toHaveProperty("transcription_cost");
    expect(typeof runPostData.transcription_cost).toBe("number");
    expect(runPostData.transcription_cost).toBeGreaterThan(0);

    const ttsContentType =
      ttsResponse.headers()["content-type"] ||
      ttsResponse.headers()["Content-Type"] ||
      "";
    expect(
      ttsContentType.toLowerCase().includes("audio"),
      `TTS response should be audio. Got content-type: ${ttsContentType}`
    ).toBe(true);

    await verifyRunsPersistedAndCharged(runUuids, request, {
      apiBaseUrl: process.env.TEST_API_BASE_URL || "",
      page,
      expect,
      settleDelayMs: 2000,
    });
  });
});
