"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/utils/cn";
import { CHAT_INSTRUCTIONS_COLLAPSE_CHARS } from "@/utils/statsConversation";

export type ChatInstructionsCollapsibleProps = {
  text: string;
};

export function ChatInstructionsCollapsible({
  text,
}: ChatInstructionsCollapsibleProps) {
  const [expanded, setExpanded] = useState(false);
  const long = text.length > CHAT_INSTRUCTIONS_COLLAPSE_CHARS;
  const contentRef = useRef<HTMLParagraphElement | null>(null);
  const [expandedHeight, setExpandedHeight] = useState<number>(0);
  const collapsedHeight = 72; // 4 lines * 18px line-height

  useEffect(() => {
    if (!long) return;
    const el = contentRef.current;
    if (!el) return;
    setExpandedHeight(el.scrollHeight);
  }, [text, expanded, long]);

  return (
    <div className="flex w-full flex-col gap-2.5 border border-[#d7d9dd] p-3">
      <div className="text-sm font-semibold leading-[18px]">
        Chat Instructions:
      </div>
      <div
        className="overflow-hidden transition-[max-height,opacity] duration-300 ease-out"
        style={{
          maxHeight: long
            ? expanded
              ? `${Math.max(expandedHeight, collapsedHeight)}px`
              : `${collapsedHeight}px`
            : undefined,
          opacity: expanded || !long ? 1 : 0.96,
        }}
      >
        <p
          ref={contentRef}
          className={cn(
            "text-sm leading-[18px] text-[#21262d] whitespace-pre-wrap break-words",
            !expanded && long && "line-clamp-4"
          )}
        >
          {text}
        </p>
      </div>
      {long ? (
        <button
          type="button"
          className="inline-flex items-center gap-2 text-sm text-primary"
          onClick={() => setExpanded((e) => !e)}
        >
          {expanded ? (
            <>
              <ChevronUp className="h-4 w-4 shrink-0" />
              Show less
            </>
          ) : (
            <>
              <ChevronDown className="h-4 w-4 shrink-0" />
              Show more
            </>
          )}
        </button>
      ) : null}
    </div>
  );
}
