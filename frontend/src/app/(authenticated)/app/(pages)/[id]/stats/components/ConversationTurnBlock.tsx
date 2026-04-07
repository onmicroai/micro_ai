"use client";

import { cn } from "@/utils/cn";
import { formatScoreGateTotal } from "@/utils/parseRunScoreTotal";
import type { ConversationMessage } from "@/utils/statsConversation";
import { formatStoredPrompt } from "@/utils/statsConversation";
import { ConversationBubble } from "./ConversationBubble";
import ReactMarkdownWrapper from "@/components/basic/ReactMarkdownWrapper";

export type ConversationTurnBlockProps = {
  message: ConversationMessage;
  formatTimestamp: (ts: string) => string;
  totalCreditsFallback: number;
};

function showScoreGate(message: ConversationMessage) {
  return (
    Boolean(message.scored_run) &&
    Boolean(message.run_score) &&
    typeof message.score_feedback === "string" &&
    message.score_feedback.trim() !== ""
  );
}

function userPromptRaw(message: ConversationMessage): string {
  const u = message.user_prompt as unknown;
  if (typeof u === "string") return u;
  return formatStoredPrompt(u);
}

function showUserPrompt(message: ConversationMessage) {
  const raw = userPromptRaw(message);
  if (showScoreGate(message) && raw === ".") return false;
  return Boolean(raw?.trim());
}

/** Run row that only renders score gate (dummy "." user turn). */
export function isConversationScoreOnly(message: ConversationMessage): boolean {
  return showScoreGate(message) && !showUserPrompt(message);
}

function ScoreGateSection({ message }: { message: ConversationMessage }) {
  return (
    <div className="border border-primary bg-[rgba(225,227,255,0.5)] p-4">
      <h4 className="text-base font-semibold leading-5">Score Gate</h4>
      <div className="mt-4 flex flex-wrap gap-10 text-sm">
        <div>
          <p className="text-[#4b5563]">Score</p>
          <p className="mt-2 font-medium">
            {formatScoreGateTotal(message.score_total, message.run_score)}
          </p>
        </div>
        <div>
          <p className="text-[#4b5563]">Minimum score</p>
          <p className="mt-2 font-medium">{message.minimum_score ?? "-"}</p>
        </div>
        <div>
          <p className="text-[#4b5563]">Run passed</p>
          <p
            className={cn(
              "mt-2 font-medium",
              message.run_passed === true ? "text-[#249953]" : "text-[#df3f46]"
            )}
          >
            {message.run_passed === null
              ? "-"
              : message.run_passed
              ? "Yes"
              : "No"}
          </p>
        </div>
      </div>
      {message.score_feedback ? (
        <div className="mt-4 bg-white p-3 text-sm leading-[18px] text-gray-600 whitespace-pre-wrap break-words">
          <ReactMarkdownWrapper>{message.score_feedback}</ReactMarkdownWrapper>
        </div>
      ) : null}
    </div>
  );
}

/** One user/assistant pair, timestamp row, and optional score gate (matches chatbot + Figma). */
export function ConversationTurnBlock({
  message,
  formatTimestamp,
  totalCreditsFallback,
}: ConversationTurnBlockProps) {
  const gate = showScoreGate(message);
  const user = showUserPrompt(message);

  if (gate && !user) {
    return <ScoreGateSection message={message} />;
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="space-y-4">
        {showUserPrompt(message) ? (
          <ConversationBubble role="user" text={userPromptRaw(message)} />
        ) : null}
        {!gate ? (
          <ConversationBubble role="assistant" text={message.response} />
        ) : null}
      </div>
      <div className="flex items-center justify-between text-sm leading-[18px] text-gray-600">
        <span>{formatTimestamp(message.timestamp)}</span>
        <span>
          Credits:{" "}
          {Number.isFinite(Number(message.credits))
            ? Number(message.credits).toLocaleString()
            : totalCreditsFallback}
        </span>
      </div>
      {gate ? <ScoreGateSection message={message} /> : null}
    </div>
  );
}
