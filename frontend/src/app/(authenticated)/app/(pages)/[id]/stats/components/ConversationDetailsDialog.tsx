"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Download } from "lucide-react";
import SkeletonLoader from "@/components/layout/loading/skeletonLoader";
import { Button } from "@/components/Button";
import { cn } from "@/utils/cn";
import { formatScoreGateTotal } from "@/utils/parseRunScoreTotal";
import {
  ConversationMessage,
  SYSTEM_PROMPT_COLLAPSE_CHARS,
  formatConversationHeaderTimestamp,
  formatConversationTimestamp,
  getSessionSystemPromptText,
} from "@/utils/statsConversation";
import { ConversationBubble } from "./ConversationBubble";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../../../edit/[id]/components/ui/dialog";

export type SelectedConversationRow = {
  session_id?: string | number;
  start_time?: string;
  model?: string;
  passes?: number;
  fails?: number;
  total_credits?: number;
} | null;

export type ConversationDetailsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loading: boolean;
  detail: { data: ConversationMessage[] } | null;
  selectedConversation: SelectedConversationRow;
  onExportExcel: () => void;
};

export function ConversationDetailsDialog({
  open,
  onOpenChange,
  loading,
  detail,
  selectedConversation,
  onExportExcel,
}: ConversationDetailsDialogProps) {
  const [systemPromptExpanded, setSystemPromptExpanded] = useState(false);

  useEffect(() => {
    if (!open) {
      setSystemPromptExpanded(false);
    }
  }, [open]);

  const sessionSystemPromptText = getSessionSystemPromptText(detail?.data);

  const showScoreGate = (message: ConversationMessage) => {
    return (
      message.scored_run &&
      message.run_score &&
      typeof message.score_feedback === "string" &&
      message.score_feedback.trim() !== ""
    );
  };

  const showUserPrompt = (message: ConversationMessage) => {
    if (showScoreGate(message) && message.user_prompt === ".") return false;

    return message.user_prompt;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        overlayStyle={{ backgroundColor: "rgba(0, 0, 0, 0.5)" }}
        className="max-w-5xl max-h-[90vh] flex flex-col gap-0 overflow-hidden p-0 sm:rounded-lg"
      >
        <div className="min-h-0 flex-1 overflow-y-auto bg-secondary-grey-100">
          {loading ? (
            <div className="flex justify-center py-12">
              <SkeletonLoader />
            </div>
          ) : detail?.data?.length ? (
            <div className="space-y-5 p-5">
              <div className="bg-white p-5">
                <DialogHeader className="pb-5 pr-12 text-left border-b">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <DialogTitle className="text-2xl leading-8 font-semibold">
                        Conversation details
                      </DialogTitle>
                      <div className="mt-2 text-sm text-gray-600">
                        {selectedConversation?.start_time
                          ? formatConversationHeaderTimestamp(
                              selectedConversation.start_time
                            )
                          : "-"}
                      </div>
                    </div>
                    <Button
                      type="button"
                      onClick={onExportExcel}
                      disabled={!detail?.data?.length || loading}
                      className="shrink-0 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-2"
                    >
                      <Download className="h-4 w-4" />
                      Export to Excel
                    </Button>
                  </div>
                </DialogHeader>
                <div className="mt-5 flex flex-wrap gap-8 text-sm">
                  <div className="space-y-2">
                    <p className="text-gray-600">Model</p>
                    <span className="inline-flex items-center rounded bg-secondary-grey-100 px-2.5 py-0.5 text-xs text-gray-600">
                      {selectedConversation?.model || "-"}
                    </span>
                  </div>
                  <div className="space-y-2">
                    <p className="text-gray-600">User ID</p>
                    <p className="font-medium text-[#0f1114]">
                      {detail.data[0]?.user_id ?? "-"}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-gray-600">Pass/Fail</p>
                    <p>
                      <span className="text-[#249953]">
                        {Number(selectedConversation?.passes || 0)} passes
                      </span>{" "}
                      /{" "}
                      <span className="text-[#df3f46]">
                        {Number(selectedConversation?.fails || 0)} fails
                      </span>
                    </p>
                  </div>
                </div>
              </div>
              {sessionSystemPromptText ? (
                <div className="bg-white p-4 sm:p-5">
                  <h4 className="text-base leading-5 font-semibold">
                    System prompt
                  </h4>
                  <p
                    className={cn(
                      "mt-4 text-sm leading-[18px] text-gray-600 whitespace-pre-wrap break-words",
                      !systemPromptExpanded &&
                        sessionSystemPromptText.length >
                          SYSTEM_PROMPT_COLLAPSE_CHARS &&
                        "line-clamp-6"
                    )}
                  >
                    {sessionSystemPromptText}
                  </p>
                  {sessionSystemPromptText.length >
                  SYSTEM_PROMPT_COLLAPSE_CHARS ? (
                    <button
                      type="button"
                      className="mt-3 inline-flex items-center gap-1 text-sm text-primary"
                      onClick={() => setSystemPromptExpanded((e) => !e)}
                    >
                      {systemPromptExpanded ? (
                        <>
                          <ChevronUp className="h-4 w-4" />
                          Show less
                        </>
                      ) : (
                        <>
                          <ChevronDown className="h-4 w-4" />
                          Show more
                        </>
                      )}
                    </button>
                  ) : null}
                </div>
              ) : null}
              {detail.data.map((message, index) => (
                <>
                  {!(showScoreGate(message) && !showUserPrompt(message)) && (
                    <div key={index} className="bg-white p-4">
                      <div className="space-y-4">
                        {showUserPrompt(message) && (
                          <ConversationBubble
                            role="user"
                            text={message.user_prompt}
                          />
                        )}
                        {!showScoreGate(message) ? (
                          <ConversationBubble
                            role="assistant"
                            text={message.response}
                          />
                        ) : (
                          <></>
                        )}
                      </div>
                      <div className="mt-5 flex items-center justify-between text-sm text-gray-600">
                        <span>
                          {formatConversationTimestamp(message.timestamp)}
                        </span>
                        <span>
                          Credits:{" "}
                          {Number.isFinite(Number(message.credits))
                            ? Number(message.credits).toLocaleString()
                            : Number(selectedConversation?.total_credits || 0)}
                        </span>
                      </div>
                    </div>
                  )}

                  {showScoreGate(message) ? (
                    <div className="mt-4 border border-primary bg-[rgba(225,227,255,0.5)] p-4">
                      <h4 className="text-base font-semibold leading-5">
                        Score Gate
                      </h4>
                      <div className="mt-4 flex flex-wrap gap-10 text-sm">
                        <div>
                          <p className="text-gray-600">Score</p>
                          <p className="mt-2 font-medium">
                            {formatScoreGateTotal(
                              message.score_total,
                              message.run_score
                            )}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-600">Minimum score</p>
                          <p className="mt-2 font-medium">
                            {message.minimum_score ?? "-"}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-600">Run passed</p>
                          <p
                            className={cn(
                              "mt-2 font-medium",
                              message.run_passed === true
                                ? "text-[#249953]"
                                : "text-[#df3f46]"
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
                          {message.score_feedback}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </>
              ))}
            </div>
          ) : (
            <p className="text-center text-sm text-muted-foreground py-12">
              No messages in this conversation.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
