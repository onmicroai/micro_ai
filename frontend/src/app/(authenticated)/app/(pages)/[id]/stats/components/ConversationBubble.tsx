"use client";

import ReactMarkdownWrapper from "@/components/basic/ReactMarkownWrapper";
import { cn } from "@/utils/cn";

export type ConversationBubbleProps = {
  role: "user" | "assistant";
  text: string;
};

export function ConversationBubble({ role, text }: ConversationBubbleProps) {
  const isUser = role === "user";
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
          <div className="mt-2 text-sm leading-[18px] whitespace-pre-wrap break-words">
            <ReactMarkdownWrapper>{text || "-"}</ReactMarkdownWrapper>
          </div>
        </div>
      </div>
    </div>
  );
}
