"use client";

import type { ConversationMessage } from "@/utils/statsConversation";
import { formatStoredPrompt } from "@/utils/statsConversation";
import { ChatInstructionsCollapsible } from "./ChatInstructionsCollapsible";
import { ConversationTurnBlock } from "./ConversationTurnBlock";

export type ChatPhaseCardProps = {
  phaseTitle: string;
  instructionsSource: unknown;
  messages: ConversationMessage[];
  formatTimestamp: (ts: string) => string;
  totalCreditsFallback: number;
};

/**
 * Figma: phase title + bordered Chat Instructions + stacked chat turns (40px between turns).
 */
export function ChatPhaseCard({
  phaseTitle,
  instructionsSource,
  messages,
  formatTimestamp,
  totalCreditsFallback,
}: ChatPhaseCardProps) {
  const instructionsText = formatStoredPrompt(instructionsSource).trim();
  const heading = phaseTitle.trim() || "Chat";

  return (
    <div className="flex flex-col gap-4 bg-white p-4 sm:p-5">
      <h4 className="text-base font-semibold leading-5">{heading}</h4>
      <div className="flex flex-col gap-5">
        {instructionsText ? (
          <ChatInstructionsCollapsible text={instructionsText} />
        ) : null}
        <div className="flex flex-col gap-10">
          {messages.map((message, index) => (
            <ConversationTurnBlock
              key={`${message.timestamp}-${index}`}
              message={message}
              formatTimestamp={formatTimestamp}
              totalCreditsFallback={totalCreditsFallback}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
