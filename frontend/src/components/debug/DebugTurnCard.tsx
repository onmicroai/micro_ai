"use client";

import { useState } from "react";
import { FaChevronDown, FaChevronUp } from "react-icons/fa";
import type { Run } from "@/store/conversationStore";
import { ConversationBubble } from "@/app/(authenticated)/app/(pages)/[id]/stats/components/ConversationBubble";
import ReactMarkdownWrapper from "@/components/basic/ReactMarkdownWrapper";
import { ApiMessagesViewer } from "./ApiMessagesViewer";
import { cn } from "@/utils/cn";

export type DebugTurnCardProps = {
  turnNumber: number;
  run: Run;
  phaseTitle: string;
  defaultExpanded?: boolean;
};

function formatCost(cost: number): string {
  if (!Number.isFinite(cost)) return "-";
  return `$${cost.toFixed(6)}`;
}

function getUserPromptText(run: Run): string {
  const userMsg = run.messages.find((m) => m.role === "user");
  return userMsg?.content?.trim() ?? "";
}

function getAssistantResponseText(run: Run): string {
  const assistantMsg = run.messages.find((m) => m.role === "assistant");
  return assistantMsg?.content ?? "";
}

function statusBadgeClass(status: Run["status"]): string {
  switch (status) {
    case "completed":
      return "bg-green-100 text-green-800";
    case "running":
      return "bg-blue-100 text-blue-800";
    case "failed":
      return "bg-red-100 text-red-800";
    default:
      return "bg-gray-100 text-gray-700";
  }
}

export function DebugTurnCard({
  turnNumber,
  run,
  phaseTitle,
  defaultExpanded = false,
}: DebugTurnCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [showApiInput, setShowApiInput] = useState(true);

  const userText = getUserPromptText(run);
  const responseText = getAssistantResponseText(run);
  const hasFixedResponse = run.messages.some((m) => m.role === "fixed_response");
  const timestamp = new Date(run.createdAt).toLocaleString();

  return (
    <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left hover:bg-gray-50"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-gray-900">Turn {turnNumber}</span>
            <span
              className={cn(
                "rounded px-2 py-0.5 text-xs font-medium capitalize",
                statusBadgeClass(run.status)
              )}
            >
              {run.status}
            </span>
            {phaseTitle ? (
              <span className="text-sm text-gray-600 truncate">{phaseTitle}</span>
            ) : null}
          </div>
          <div className="mt-1 flex flex-wrap gap-3 text-xs text-gray-500">
            <span>{run.aiModel || "—"}</span>
            <span>
              Credits:{" "}
              {Number.isFinite(run.credits) ? run.credits.toLocaleString() : "—"}
            </span>
            <span>Cost: {formatCost(run.cost)}</span>
          </div>
        </div>
        {expanded ? (
          <FaChevronDown className="shrink-0 text-gray-500" />
        ) : (
          <FaChevronUp className="shrink-0 text-gray-500" />
        )}
      </button>

      {expanded ? (
        <div className="border-t border-gray-100 px-4 py-4 space-y-4">
          <p className="text-xs text-gray-500">{timestamp}</p>

          {hasFixedResponse ? (
            <p className="text-sm text-amber-700 bg-amber-50 rounded p-2">
              Fixed response — no LLM API call.
            </p>
          ) : null}

          {(userText || responseText) && !hasFixedResponse ? (
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Quick view
              </p>
              {userText ? (
                <ConversationBubble role="user" text={userText} />
              ) : null}
              {responseText || run.status === "running" ? (
                <ConversationBubble
                  role="assistant"
                  text={responseText || "(streaming…)"}
                />
              ) : null}
            </div>
          ) : null}

          {!hasFixedResponse ? (
            <div>
              <button
                type="button"
                onClick={() => setShowApiInput((s) => !s)}
                className="flex items-center gap-2 text-sm font-semibold text-gray-800"
              >
                Final API input
                {showApiInput ? (
                  <FaChevronDown className="h-3 w-3" />
                ) : (
                  <FaChevronUp className="h-3 w-3" />
                )}
              </button>
              {showApiInput ? (
                <div className="mt-2">
                  <ApiMessagesViewer
                    messages={run.apiMessages}
                    pending={
                      !run.apiMessages?.length &&
                      (run.status === "pending" || run.status === "running")
                    }
                  />
                </div>
              ) : null}
            </div>
          ) : null}

          <div>
            <p className="text-sm font-semibold text-gray-800 mb-2">Raw response</p>
            <div className="rounded bg-gray-50 p-3 text-sm leading-relaxed text-gray-700 whitespace-pre-wrap break-words max-h-64 overflow-auto">
              {responseText ? (
                <ReactMarkdownWrapper>{responseText}</ReactMarkdownWrapper>
              ) : run.status === "running" ? (
                <span className="italic text-gray-500">Streaming…</span>
              ) : (
                <span className="text-gray-500">—</span>
              )}
            </div>
          </div>

          {run.score_expected || run.run_score ? (
            <div className="rounded border border-primary/30 bg-[rgba(225,227,255,0.35)] p-3 text-sm">
              <p className="font-semibold">Score gate</p>
              <p className="mt-1 text-gray-600">
                Passed:{" "}
                {run.run_passed === undefined
                  ? "—"
                  : run.run_passed
                    ? "Yes"
                    : "No"}
              </p>
              {run.run_score ? (
                <pre className="mt-2 text-xs whitespace-pre-wrap break-all max-h-32 overflow-auto">
                  {run.run_score}
                </pre>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
