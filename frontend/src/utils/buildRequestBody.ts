import { PageConfigOverride } from "@/app/(authenticated)/app/types";
import {
  SurveyPage,
  Base64Images,
} from "@/app/(authenticated)/app/types";
import { useConversationStore } from "@/store/conversationStore";
import {
  formatAttachmentsBlock,
  formatUserAttachmentsMetadata,
  type FormAttachmentPayload,
} from "@/utils/gatherFormAttachments";

interface AIConfig {
  aiModel: string;
  temperature: number;
  maxResponseTokens: number | null;
  systemPrompt: string;
}

interface BuildRequestBodyOptions {
  finalPrompt: string;
  finalAiInstructions: string;
  appId: number;
  requestSkip: boolean;
  userId: number | null;
  aiConfig: AIConfig;
  pageConfig: PageConfigOverride;
  images: Base64Images;
  appHashId: string | undefined;
  skipScoredRun?: boolean;
  hasFixedResponse?: boolean;
  fixedResponseText?: string;
  noSubmit?: boolean;
  transcriptionCost?: number;
  run_uuid?: string;
  scoreExplanation?: boolean;
  scoreExplanationMode?: "always" | "failed_only" | "passed_only" | "never";
  activeTryId?: string;
  phaseTitle?: string;
  runSource?: "default" | "chat";
  isPreview?: boolean;
  /**
   * Fallback context block describing the app's visible, answered fields.
   * Injected as a system message so the AI is aware of form values even when
   * the creator did not reference them via placeholders in the prompt.
   */
  formContext?: string;
  /** File attachments from Long Text fields (text sent to AI, metadata persisted). */
  formAttachments?: FormAttachmentPayload[];
}

const getPageConfig = (page: SurveyPage | null): PageConfigOverride => {
  return {
    scoredPhase: page?.scoredPhase || false,
    rubric: page?.rubric || "",
    minScore: page?.minScore || 0,
    scoreExplanation: page?.scoreExplanation ?? true,
    scoreExplanationMode: page?.scoreExplanationMode ?? "always",
    scoreFeedbackEnabled: page?.scoreFeedbackEnabled ?? true,
    scoreFeedbackInstructions: page?.scoreFeedbackInstructions ?? "",
  };
};

/**
 * Builds the request body for the AI API call.
 * @param options The options used to assemble the request body.
 * @returns The request body object sent to the run/score endpoints.
 */
export const buildRequestBody = async (options: BuildRequestBodyOptions) => {
  const {
    finalPrompt,
    finalAiInstructions,
    appId,
    requestSkip,
    userId,
    aiConfig,
    pageConfig,
    images,
    appHashId,
    skipScoredRun = false,
    hasFixedResponse = false,
    fixedResponseText = "",
    noSubmit = false,
    transcriptionCost,
    run_uuid,
    scoreExplanation,
    scoreExplanationMode,
    activeTryId,
    phaseTitle,
    runSource,
    isPreview,
    formContext,
    formAttachments = [],
  } = options;

  const store = useConversationStore.getState();
  const scopedRuns = store.getRunsForTry(activeTryId);

  let conversationHistory = scopedRuns.flatMap((run) =>
    run.messages.filter(
      (msg) => msg.role === "assistant" || msg.role === "user",
    ),
  );

  if (finalPrompt) {
    const lastUserIndex = [...conversationHistory]
      .reverse()
      .findIndex((msg) => msg.role === "user");
    if (lastUserIndex !== -1) {
      conversationHistory = conversationHistory.slice(
        0,
        conversationHistory.length - lastUserIndex - 1,
      );
    }
  }

  const historyMessages = [
    ...conversationHistory.map((msg) => ({
      role: msg.role,
      content: msg.content,
    })),
  ];

  // Add dummy user message if first message exists and is not from user
  if (historyMessages.length == 0 || historyMessages[0].role !== "user") {
    historyMessages.unshift({
      role: "user",
      content: ".",
    });
  }

  const attachmentBlock = formatAttachmentsBlock(formAttachments);
  const userMessageText = finalPrompt
    ? `${finalPrompt}${attachmentBlock}`
    : attachmentBlock || finalPrompt;

  const requestBody: any = {
    model: aiConfig.aiModel,
    messages: [
      // System prompt (if exists)
      ...(aiConfig.systemPrompt
        ? [
            {
              role: "system",
              content: aiConfig.systemPrompt,
            },
          ]
        : []),
      // Fallback form context (if any visible, answered fields exist)
      ...(formContext
        ? [
            {
              role: "system",
              content: formContext,
            },
          ]
        : []),
      // Rest of the conversation including context documents
      ...historyMessages,
      ...(finalAiInstructions
        ? [
            {
              role: "assistant",
              content: finalAiInstructions,
            },
          ]
        : []),
      ...(Object.keys(images).length > 0
        ? [
            {
              role: "user" as const,
              content: [
                ...Object.values(images).flatMap((imageData) =>
                  Object.values(imageData).map((base64) => ({
                    type: "image_url",
                    image_url: {
                      url: base64,
                    },
                  })),
                ),
                {
                  type: "text",
                  text: userMessageText,
                },
              ],
            },
          ]
        : [
            {
              role: "user",
              content: userMessageText,
            },
          ]),
    ],
    ma_id: Number(appId),

    request_skip: requestSkip,
    no_submission: noSubmit,
    run_uuid: run_uuid,
  };

  if (userId !== null) {
    requestBody.user_id = Number(userId);
  }

  if (pageConfig.scoredPhase) {
    requestBody.scored_run = pageConfig.scoredPhase;
    requestBody.rubric = pageConfig.rubric;
    requestBody.minimum_score = pageConfig.minScore;
    requestBody.score_explanation =
      scoreExplanation ?? pageConfig.scoreExplanation ?? true;
    requestBody.score_explanation_mode =
      scoreExplanationMode ?? pageConfig.scoreExplanationMode ?? "always";
    requestBody.score_feedback_enabled =
      pageConfig.scoreFeedbackEnabled ?? true;
    requestBody.score_feedback_instructions =
      pageConfig.scoreFeedbackInstructions ?? "";
  }

  if (skipScoredRun) {
    requestBody.scored_run = false;
  }

  if (aiConfig.temperature !== undefined) {
    requestBody.temperature = Number(aiConfig.temperature);
  }

  if (aiConfig.maxResponseTokens !== undefined) {
    requestBody.max_response_tokens = Number(aiConfig.maxResponseTokens);
  }

  if (aiConfig.systemPrompt !== undefined) {
    requestBody.system_prompt = aiConfig.systemPrompt;
  }

  if (finalAiInstructions !== undefined) {
    requestBody.phase_instructions = finalAiInstructions;
  }

  if (finalPrompt !== undefined) {
    requestBody.user_prompt = finalPrompt;
  }

  if (appHashId !== undefined) {
    requestBody.app_hash_id = appHashId;
  }

  if (hasFixedResponse) {
    requestBody.fixed_response = fixedResponseText;
    requestBody.no_submission = true;
    requestBody.scored_run = false;
    requestBody.has_fixed_response = true;
  }

  if (transcriptionCost !== undefined) {
    requestBody.transcription_cost = transcriptionCost;
  }

  const conversationId = store.ensureConversation();
  requestBody.session_id = conversationId;

  requestBody.phase_title = (phaseTitle ?? "").slice(0, 255);
  requestBody.is_chat_run = runSource === "chat";
  requestBody.is_preview = Boolean(isPreview);

  if (formAttachments.length > 0) {
    requestBody.user_attachments = formatUserAttachmentsMetadata(formAttachments);
  }

  return requestBody;
};

export { getPageConfig };
export type { AIConfig };
