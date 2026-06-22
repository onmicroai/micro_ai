"use client";

import ReactMarkdownWrapper from "@/components/basic/ReactMarkdownWrapper";
import { cn } from "@/utils/cn";
import { FileText } from "lucide-react";
import type { UserAttachmentRecord } from "@/utils/statsConversation";

export type ConversationBubbleProps = {
  role: "user" | "assistant";
  text: string;
  attachments?: UserAttachmentRecord[];
};

function AttachmentChips({
  attachments,
}: {
  attachments: UserAttachmentRecord[];
}) {
  if (!attachments.length) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {attachments.map((att, i) => (
        <span
          key={`${att.filename}-${i}`}
          className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-gray-600"
          title={att.filename}
        >
          <FileText className="h-3.5 w-3.5 shrink-0 text-gray-400" />
          <span className="max-w-[180px] truncate">{att.filename}</span>
          {att.word_count != null && (
            <span className="text-gray-400">
              ({att.word_count.toLocaleString()} words)
            </span>
          )}
        </span>
      ))}
    </div>
  );
}

export function ConversationBubble({
  role,
  text,
  attachments = [],
}: ConversationBubbleProps) {
  const isUser = role === "user";
  const hasText = Boolean(text?.trim());
  const hasAttachments = isUser && attachments.length > 0;

  return (
    <div className="flex w-full items-end gap-3">
      <div
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-base leading-5 text-gray-600",
          isUser ? "bg-[#f5f6f9]" : "bg-[rgba(225,227,255,0.5)]"
        )}
      >
        {isUser ? "U" : "A"}
      </div>
      <div className="min-w-0 flex-1">
        <div
          className={cn(
            "w-full p-3",
            isUser ? "bg-[#f5f6f9]" : "bg-[rgba(225,227,255,0.5)]"
          )}
        >
          <div className="text-sm font-semibold leading-[18px]">
            {isUser ? "User" : "Assistant"}
          </div>
          {hasText && (
            <div className="mt-2 text-sm leading-[18px] whitespace-pre-wrap break-words">
              <ReactMarkdownWrapper>{text}</ReactMarkdownWrapper>
            </div>
          )}
          {hasAttachments && <AttachmentChips attachments={attachments} />}
          {!hasText && !hasAttachments && (
            <div className="mt-2 text-sm leading-[18px] text-gray-500">-</div>
          )}
        </div>
      </div>
    </div>
  );
}
