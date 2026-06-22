import {
  SurveyJson,
  Answers,
  Prompt,
  SendPromptResponse,
  Base64Images,
  PageConfigOverride,
} from "@/app/(authenticated)/app/types";
import axiosInstance from "@/utils//axiosInstance";
import evaluateVisibility from "@/utils//evaluateVisibility";
import { ConditionalLogic } from "@/app/(authenticated)/app/types";
import groupPromptsByType from "@/utils//groupPromptsByType";
import injectValuesIntoPrompt from "@/utils//injectValuesIntoPrompt";
import {
  useConversationStore,
  type ApiMessage,
  type Run,
} from "@/store/conversationStore";
import delay from "./delay";
import { buildRequestBody, getPageConfig } from "@/utils/buildRequestBody";
import { buildFormContext } from "@/utils/buildFormContext";
import { gatherFormAttachments } from "@/utils/gatherFormAttachments";
import { streamRun, type ScoreData } from "@/utils/streamRun";
import { formatApiErrorPayload, mapKnownErrorText } from "@/utils/apiErrorMessage";

function serverMetaToRunUpdates(
  source: Record<string, unknown>,
): Partial<Run> {
  const updates: Partial<Run> = {};
  if (typeof source.cost === "number") updates.cost = source.cost;
  if (typeof source.credits === "number") updates.credits = source.credits;
  if (typeof source.run_passed === "boolean") updates.run_passed = source.run_passed;
  if (typeof source.run_score === "string") {
    updates.run_score = source.run_score;
  } else if (source.run_score && typeof source.run_score === "object") {
    updates.run_score = JSON.stringify(source.run_score);
  }
  if (typeof source.score_explanation === "boolean")
    updates.score_explanation = source.score_explanation;
  if (typeof source.score_explanation_mode === "string")
    updates.score_explanation_mode = source.score_explanation_mode as Run["score_explanation_mode"];
  if (typeof source.score_feedback_enabled === "boolean")
    updates.score_feedback_enabled = source.score_feedback_enabled;
  if (typeof source.score_feedback_instructions === "string")
    updates.score_feedback_instructions = source.score_feedback_instructions;
  const apiMessages = source.api_messages ?? source.apiMessages;
  if (Array.isArray(apiMessages)) {
    updates.apiMessages = apiMessages as ApiMessage[];
  }
  return updates;
}

/**
 * Applies a completed (non-streaming) JSON run response to the store and UI.
 * Shared by the streaming-JSON path and the non-streaming fallback path so the
 * run-completion logic lives in exactly one place.
 */
const finalizeRunResponse = async (
  responseData: any,
  runId: string | undefined,
  runTryId: string | undefined,
  setState: (state: any) => void,
): Promise<SendPromptResponse> => {
  const store = useConversationStore.getState();
  const promptResponse = responseData.response;

  if (runId) {
    store.updateRun(runId, {
      status: "completed",
      run_passed: responseData.run_passed,
      run_score: responseData.run_score,
      no_submission: responseData.no_submission,
      cost: responseData.cost,
      credits: responseData.credits,
      session_id: responseData.session_id,
      ...serverMetaToRunUpdates(responseData as Record<string, unknown>),
    });
  }

  if (promptResponse?.trim()) {
    store.addMessage("assistant", promptResponse, runId, runTryId);
  }

  await delay(1000);

  setState((state: any) => ({
    ...state,
    promptResponse,
    promptLoading: false,
    responses: [...(state.responses || []), promptResponse],
  }));

  return {
    success: true,
    response: promptResponse,
    run_passed: responseData.run_passed,
    run_uuid: responseData.run_uuid,
  };
};

const handleAIResponse = async (
  requestBody: any,
  userId: number | null,
  setState: (state: any) => void,
  runId?: string,
): Promise<SendPromptResponse> => {
  const store = useConversationStore.getState();

  // Always try unified endpoint first - backend decides streaming based on model
  try {
    let accumulated = "";
    // mark current run as running (was pending)
    if (runId) {
      store.updateRun(runId, { status: "running" });
    }

    // In streaming mode, streamRun may return before the stream finishes.
    // We must only resolve this function when onDone/onError fires.
    let streamCompleted = false;
    let streamResult: SendPromptResponse | null = null;
    let streamError: string | null = null;
    let resolveDone: (() => void) | null = null;
    const donePromise = new Promise<void>((resolve) => {
      resolveDone = resolve;
    });

    // Score events are full snapshots, so bursts arriving within one frame can
    // be coalesced last-wins: at most one store update + render per frame.
    let pendingScoreData: ScoreData | null = null;
    let scoreFrame: number | null = null;
    const applyPendingScore = () => {
      scoreFrame = null;
      const scoreData = pendingScoreData;
      pendingScoreData = null;
      if (!scoreData) return;

      setState((state: any) => ({
        ...state,
        scoreData: scoreData,
        showScoreResults: true,
      }));

      if (runId) {
        useConversationStore.getState().updateRun(runId, {
          scoreData: scoreData,
          ...(scoreData.run_passed !== undefined
            ? { run_passed: scoreData.run_passed }
            : {}),
          run_score: scoreData.run_score,
          ...serverMetaToRunUpdates(
            scoreData as unknown as Record<string, unknown>,
          ),
        });
      }
    };
    const flushPendingScore = () => {
      if (scoreFrame !== null) {
        cancelAnimationFrame(scoreFrame);
      }
      applyPendingScore();
    };
    const discardPendingScore = () => {
      if (scoreFrame !== null) {
        cancelAnimationFrame(scoreFrame);
        scoreFrame = null;
      }
      pendingScoreData = null;
    };

    const response = await streamRun(
      requestBody,
      userId,
      {
        onChunk: (chunk) => {
          if (requestBody?.scored_run) {
            return;
          }
          accumulated += chunk;

          // Update run message incrementally
          if (runId) {
            const run = useConversationStore
              .getState()
              .currentConversation?.runs.find((r) => r.id === runId);
            if (run) {
              const msgs = [...run.messages];
              const idx = msgs.findIndex((m) => m.role === "assistant");
              if (idx === -1) {
                msgs.push({
                  role: "assistant",
                  content: chunk,
                  timestamp: Date.now(),
                } as any);
              } else {
                msgs[idx] = {
                  ...msgs[idx],
                  content: msgs[idx].content + chunk,
                  timestamp: Date.now(),
                } as any;
              }
              store.updateRun(runId, { messages: msgs });
            }
          }

          // Update UI state incrementally
          setState({
            promptResponse: accumulated,
          });
        },
        onScore: (scoreData) => {
          pendingScoreData = scoreData;
          if (scoreFrame === null) {
            scoreFrame = requestAnimationFrame(applyPendingScore);
          }
        },
        onDone: (meta?: unknown) => {
          if (streamCompleted) return;
          // Apply any score snapshot still waiting on a frame before
          // finalizing, so the final state can't be overwritten afterwards.
          flushPendingScore();
          // Finalize run: status + server meta merged into a single update
          // (one re-render instead of two).
          if (runId) {
            const metaUpdates =
              meta && typeof meta === "object"
                ? serverMetaToRunUpdates(meta as Record<string, unknown>)
                : {};
            store.updateRun(runId, { status: "completed", ...metaUpdates });
          }
          setState((state: any) => ({
            ...state,
            promptResponse: accumulated,
            promptLoading: false,
          }));
          streamCompleted = true;
          const latestRun = runId
            ? useConversationStore
                .getState()
                .currentConversation?.runs.find((r) => r.id === runId)
            : undefined;
          streamResult = {
            success: true,
            response: accumulated,
            run_passed: latestRun?.run_passed,
            run_uuid: runId,
          };
          resolveDone?.();
        },
        onError: (err) => {
          console.error(err);
          // A queued partial snapshot is stale once the stream has failed.
          discardPendingScore();
          if (runId) {
            store.updateRun(runId, { status: "failed" });
          }
          setState((state: any) => ({
            ...state,
            sendPromptError: mapKnownErrorText(String(err)),
            promptLoading: false,
          }));
          streamCompleted = true;
          streamError = String(err);
          resolveDone?.();
        },
      },
      {
        endpoint: requestBody?.scored_run ? "/api/microapps/score" : undefined,
      },
    );

    // If response is not null, it means backend returned JSON (non-streaming)
    if (response) {
      const data = await response.json();
      return await finalizeRunResponse(
        data.data,
        runId,
        requestBody?.run_try_id,
        setState,
      );
    }

    // Streaming path (response is undefined): wait for onDone/onError.
    if (!streamCompleted) {
      await donePromise;
    }
    if (streamError) {
      return {
        success: false,
        error: streamError,
        run_passed: false,
        run_uuid: runId,
      };
    }
    return (streamResult || {
      success: true,
      response: accumulated,
      run_passed: true,
      run_uuid: runId,
    }) as SendPromptResponse;
  } catch (streamError: any) {
    console.log(
      "Streaming attempt failed, falling back to standard request:",
      streamError,
    );
  }

  // Fallback to non-streaming request (for anonymous users or if streaming failed)
  try {
    const endpoint = requestBody?.scored_run
      ? "/api/microapps/score"
      : !userId
        ? "/api/microapps/run/anonymous"
        : "/api/microapps/run";

    let responseData;

    if (!userId) {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        let errorMessage;
        try {
          const errorData = await response.json();
          errorMessage = formatApiErrorPayload(errorData, response.status);
        } catch {
          errorMessage = formatApiErrorPayload(null, response.status);
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      responseData = data.data;
    } else {
      const api = axiosInstance();
      const response = await api.post(endpoint, requestBody);
      responseData = response.data.data;
    }

    return await finalizeRunResponse(
      responseData,
      runId,
      requestBody?.run_try_id,
      setState,
    );
  } catch (error: any) {
    let errorResponse;

    // Handle the case where error.message contains the JSON string from our throw
    if (error instanceof Error && error.message) {
      try {
        // Try to parse the error message as JSON
        errorResponse = JSON.parse(error.message);
        if (errorResponse.error !== undefined) {
          errorResponse = errorResponse.error;
        }
      } catch {
        // If it's not valid JSON, use the message directly
        errorResponse = error.message;
      }
    } else {
      // Fall back to the original error handling
      errorResponse = structuredClone(error?.response?.data || {});
      errorResponse = Array.isArray(errorResponse)
        ? errorResponse[0]
        : errorResponse;
      errorResponse =
        typeof errorResponse === "object" ? errorResponse.error : errorResponse;
    }

    const errorMessage = formatApiErrorPayload(
      typeof errorResponse === "object"
        ? errorResponse
        : { error: String(errorResponse || "Unknown error") },
    );

    setState((state: any) => ({
      ...state,
      sendPromptError: errorMessage,
      promptLoading: false,
    }));

    // Update run status to failed on error
    if (runId) {
      store.updateRun(runId, {
        status: "failed",
        run_passed: false,
      });
    }

    return { success: false, error: errorMessage };
  }
};

/**
 * Updates a run on the server using the PATCH method
 * @param sessionId - The ID of the session to update
 * @param runId - The ID of the run to update
 * @param updateData - The data to update on the run
 * @param userId - The ID of the user (null for anonymous users)
 * @returns A promise that resolves to the updated run data
 */
export const updateRunUtil = async (
  runId: string,
  updateData: Record<string, any>,
  userId: number | null,
): Promise<{ success: boolean; data?: any; error?: string }> => {
  const store = useConversationStore.getState();

  try {
    // Prepare the request payload
    const requestBody = {
      id: runId, // Use the same runId for backend lookup
      ...updateData,
    };

    let responseData;

    // Handle anonymous vs authenticated requests
    if (!userId) {
      const endpoint = "/api/microapps/run/anonymous";
      const response = await fetch(endpoint, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `HTTP error! Status: ${response.status}, Response: ${errorText}`,
        );
      }

      responseData = await response.json();
    } else {
      const api = axiosInstance();
      const response = await api.patch("/api/microapps/run", requestBody);
      responseData = response.data;
    }

    // Update the run in the local store using the same runId
    // Extract only the frontend-relevant fields from the backend response
    const backendData = responseData.data || responseData;
    const relevantUpdates = {
      ...updateData, // Original updates we sent
      updatedAt: Date.now(),
      // Include calculated fields from backend response
      ...(backendData.cost !== undefined && { cost: backendData.cost }),
      ...(backendData.credits !== undefined && {
        credits: backendData.credits,
      }),
    };

    store.updateRun(runId, relevantUpdates);

    return {
      success: true,
      data: responseData,
    };
  } catch (error: any) {
    let errorResponse = structuredClone(error?.response?.data || {});
    errorResponse = Array.isArray(errorResponse)
      ? errorResponse[0]
      : errorResponse;
    errorResponse =
      typeof errorResponse === "object" ? errorResponse.error : errorResponse;

    const errorMessage =
      "Failed to update run: " + JSON.stringify(errorResponse);

    return { success: false, error: errorMessage };
  }
};

export const sendPromptsUtil = async (options: {
  prompts?: Prompt[] | null;
  answers?: Answers;
  images?: Base64Images;
  appId?: number;
  appConfig?: SurveyJson | null;
  pageIndex?: number;
  userId?: number | null;
  requestSkip?: boolean;
  set?: any;
  skipScoredRun?: boolean;
  hasFixedResponse?: boolean;
  fixedResponseText?: string;
  noSubmit?: boolean;
  pageConfigOverride?: PageConfigOverride;
  transcriptionCost?: number;
  scoreExplanation?: boolean;
  scoreExplanationMode?: "always" | "failed_only" | "passed_only" | "never";
  defaultAiModel?: string;
  runSource?: "default" | "chat";
  /** Builder Preview tab: marks runs for exclusion from owner statistics. */
  isPreview?: boolean;
  runtimeMeta?: {
    tryId?: string;
    tryIndex?: number;
  };
}): Promise<SendPromptResponse> => {
  const {
    prompts = null,
    answers = {},
    images = {},
    appId = 0,
    appConfig = null,
    pageIndex = 0,
    userId = null,
    skipScoredRun = false,
    requestSkip = false,
    set = (s: any) => s,
    noSubmit = false,
    pageConfigOverride,
    transcriptionCost,
    scoreExplanation,
    scoreExplanationMode,
    runSource = "default",
    isPreview = false,
    runtimeMeta,
  } = options;

  let { hasFixedResponse = false, fixedResponseText = "" } = options;

  const store = useConversationStore.getState();

  // Step 1: Filter prompts based on visibility conditions
  const visiblePrompts = (prompts || []).filter((prompt) =>
    evaluateVisibility(
      prompt.conditionalLogic || ({} as ConditionalLogic),
      answers,
    ),
  );

  // Step 2: Group visible prompts by their type (prompt, aiInstructions, fixedResponse)
  const groupedPrompts = groupPromptsByType(visiblePrompts);

  // Step 3: Inject values into all prompt groups at once
  const elementsForMapping = (appConfig?.elements || []) as any;
  const finalPrompts = {
    finalAiInstructions: groupedPrompts["aiInstructions"]
      ? (injectValuesIntoPrompt(
          groupedPrompts["aiInstructions"],
          answers,
          elementsForMapping,
        ) as Prompt[])
      : [],
    finalPrompt: groupedPrompts["prompt"]
      ? (injectValuesIntoPrompt(
          groupedPrompts["prompt"],
          answers,
          elementsForMapping,
        ) as Prompt[])
      : [],
    finalFixedResponses: groupedPrompts["fixedResponse"]
      ? (injectValuesIntoPrompt(
          groupedPrompts["fixedResponse"],
          answers,
          elementsForMapping,
        ) as Prompt[])
      : [],
  };

  const aiConfig = {
    aiModel: appConfig?.aiConfig.aiModel || options.defaultAiModel || "",
    temperature: appConfig?.aiConfig.temperature || 0.9,
    maxResponseTokens: appConfig?.aiConfig.maxResponseTokens || null,
    systemPrompt: appConfig?.aiConfig.systemPrompt || "",
  };

  const page = appConfig?.phases?.[pageIndex] || null;
  const pageConfig = pageConfigOverride ?? getPageConfig(page);
  const phaseTitle = page?.title ?? "";

  // Whole-app fallback context: every visible, answered field, so the AI is
  // aware of the form values even when the creator didn't wire placeholders in.
  const allElements =
    appConfig?.elements ??
    appConfig?.phases?.flatMap((p) => p.elements) ??
    [];
  const formContext = buildFormContext(allElements, answers);
  const formAttachments = gatherFormAttachments(allElements, answers);

  //Create a run with current settings and 'pending' status
  //Creating a run will automatically add it to the conversation, if it exists. Or, it will create a new one if it doesn't.
  const run = {
    id:
      crypto.randomUUID?.() ??
      `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    aiModel: aiConfig.aiModel,
    cost: 0,
    credits: 0,
    status: "pending" as const,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    messages: [],
    phaseIndex: pageIndex, // Add the phase index to track which phase this run belongs to
    tryId: runtimeMeta?.tryId,
    tryIndex: runtimeMeta?.tryIndex,
    session_id: "", // Add default empty session_id
  };
  store.addRun(run);

  const combinedAiInstructions = finalPrompts.finalAiInstructions
    .map((p) => p.text)
    .filter(Boolean)
    .join("\n");

  const appHashId = appConfig?.hashId;

  // Add AI instructions as a message to the run
  if (combinedAiInstructions) {
    store.addMessage(
      "instruction",
      combinedAiInstructions,
      run.id,
      runtimeMeta?.tryId,
    );
  }

  const combinedPrompt = finalPrompts.finalPrompt
    .map((p) => p.text)
    .filter(Boolean)
    .join("\n");

  // Add user prompt as a message to the run
  if (combinedPrompt) {
    store.addMessage("user", combinedPrompt, run.id, runtimeMeta?.tryId);
  }

  //If there are fixed responses, return the fixed response and exit.
  if (finalPrompts.finalFixedResponses.length > 0) {
    const combinedText = finalPrompts.finalFixedResponses
      .map((p) => p.text)
      .filter(Boolean)
      .join("\n");
    store.addMessage(
      "fixed_response",
      combinedText,
      run.id,
      runtimeMeta?.tryId,
    );
    hasFixedResponse = true;
    fixedResponseText = combinedText;
  }

  const requestBody = await buildRequestBody({
    finalPrompt: combinedPrompt,
    finalAiInstructions: combinedAiInstructions,
    appId,
    requestSkip,
    userId,
    aiConfig,
    pageConfig,
    images,
    appHashId,
    skipScoredRun,
    hasFixedResponse,
    fixedResponseText,
    noSubmit,
    transcriptionCost,
    run_uuid: run.id,
    scoreExplanation,
    scoreExplanationMode,
    activeTryId: runtimeMeta?.tryId,
    phaseTitle,
    runSource,
    isPreview,
    formContext,
    formAttachments,
  });
  requestBody.run_try_id = runtimeMeta?.tryId;
  if (run?.id) {
    const isScoredRun = Boolean(requestBody?.scored_run);
    store.updateRun(run.id, {
      score_expected: isScoredRun,
      // Seed scoreData with the locally known rubric so the score UI can render
      // named criterion skeletons immediately on submit, instead of generic
      // placeholders that get remounted when the first SSE score event arrives.
      ...(isScoredRun
        ? {
            scoreData: {
              run_score: "",
              minimum_score: Number(requestBody?.minimum_score) || 0,
              rubric:
                typeof requestBody?.rubric === "string"
                  ? requestBody.rubric
                  : "",
              scored_run: true,
            },
          }
        : {}),
      score_explanation: requestBody?.score_explanation ?? undefined,
      score_explanation_mode: requestBody?.score_explanation_mode ?? undefined,
      score_feedback_enabled: requestBody?.score_feedback_enabled ?? undefined,
      score_feedback_instructions:
        requestBody?.score_feedback_instructions ?? undefined,
      apiMessages: Array.isArray(requestBody.messages)
        ? (requestBody.messages as ApiMessage[])
        : undefined,
    });
  }
  const result = await handleAIResponse(requestBody, userId, set, run.id);
  return { ...result, run_uuid: run.id };
};
