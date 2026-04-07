"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Download } from "lucide-react";
import SkeletonLoader from "@/components/layout/loading/skeletonLoader";
import { Button } from "@/components/Button";
import { cn } from "@/utils/cn";
import {
  ConversationMessage,
  SYSTEM_PROMPT_COLLAPSE_CHARS,
  formatConversationHeaderTimestamp,
  formatConversationTimestamp,
  getSessionSystemPromptText,
  groupConversationMessagesByPhase,
} from "@/utils/statsConversation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../../../edit/[id]/components/ui/dialog";
import { ChatPhaseCard } from "./ChatPhaseCard";
import {
  ConversationTurnBlock,
  isConversationScoreOnly,
} from "./ConversationTurnBlock";

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
  const phaseGroups = detail?.data?.length
    ? groupConversationMessagesByPhase(detail.data)
    : [];

  const creditsFallback = Number(selectedConversation?.total_credits || 0);

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

              {phaseGroups.map((group, gi) => {
                const useChatPhaseLayout = group.messages.some(
                  (m) => m.is_chat_run
                );

                if (useChatPhaseLayout) {
                  return (
                    <ChatPhaseCard
                      key={`phase-${gi}-${group.mergeKey}`}
                      phaseTitle={group.phaseTitle}
                      instructionsSource={group.messages[0]?.phase_instructions}
                      messages={group.messages}
                      formatTimestamp={formatConversationTimestamp}
                      totalCreditsFallback={creditsFallback}
                    />
                  );
                }

                const message = group.messages[0];
                const scoreOnly = isConversationScoreOnly(message);

                if (scoreOnly) {
                  return (
                    <div key={`row-${gi}`} className="mt-0">
                      <ConversationTurnBlock
                        message={message}
                        formatTimestamp={formatConversationTimestamp}
                        totalCreditsFallback={creditsFallback}
                      />
                    </div>
                  );
                }

                return (
                  <div key={`row-${gi}`} className="bg-white p-4">
                    <ConversationTurnBlock
                      message={message}
                      formatTimestamp={formatConversationTimestamp}
                      totalCreditsFallback={creditsFallback}
                    />
                  </div>
                );
              })}
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
