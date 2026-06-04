"use client";

import { summarizeApiMessages } from "@/utils/formatApiMessages";
import type { ApiMessage } from "@/store/conversationStore";
import { cn } from "@/utils/cn";

type ApiMessagesViewerProps = {
  messages: ApiMessage[] | undefined;
  pending?: boolean;
  className?: string;
};

const ROLE_STYLES: Record<string, string> = {
  system: "border-l-4 border-gray-400 bg-gray-50",
  user: "border-l-4 border-blue-300 bg-[#f5f6f9]",
  assistant: "border-l-4 border-indigo-300 bg-[rgba(225,227,255,0.5)]",
};

export function ApiMessagesViewer({
  messages,
  pending = false,
  className,
}: ApiMessagesViewerProps) {
  const blocks = summarizeApiMessages(messages);

  if (!blocks.length) {
    return (
      <p className={cn("text-sm text-gray-500 italic", className)}>
        {pending
          ? "Awaiting final API messages from server…"
          : "No API messages recorded for this turn."}
      </p>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      {blocks.map((block, index) => (
        <div
          key={`${block.role}-${index}`}
          className={cn(
            "rounded p-3 text-sm",
            ROLE_STYLES[block.role] ?? "border-l-4 border-gray-300 bg-gray-50"
          )}
        >
          <div className="font-semibold text-gray-800">{block.label}</div>
          <pre className="mt-2 whitespace-pre-wrap break-words font-sans text-gray-700 leading-relaxed">
            {block.text || "-"}
          </pre>
          {block.hasImages ? (
            <p className="mt-1 text-xs text-gray-500">
              Includes {block.imageCount} image attachment
              {block.imageCount === 1 ? "" : "s"} (omitted from display)
            </p>
          ) : null}
        </div>
      ))}
    </div>
  );
}
