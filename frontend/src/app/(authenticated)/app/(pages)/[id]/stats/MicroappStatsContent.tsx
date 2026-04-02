"use client";

import { useEffect, useRef, useState } from "react";
import SkeletonLoader from "@/components/layout/loading/skeletonLoader";
import AccessDenied from "@/components/access-denied";
import DebugInformation from "@/components/DebugInformation";
import {
  ThumbsUp,
  ThumbsDown,
  Download,
  MessageSquareText,
  ChevronRight,
  ClipboardList,
} from "lucide-react";
import axiosInstance from "@/utils/axiosInstance";
import * as XLSX from "xlsx";
import { format } from "date-fns";
import { useMicroappAccess } from "@/hooks/useMicroappAccess";
import { cn } from "@/utils/cn";
import ClockSquareIcon from "@/components/icons/ClockSquareIcon";
import CoinsSquareIcon from "@/components/icons/CoinsSquareIcon";
import StaticSquareIcon from "@/components/icons/StatisticSquareIcon";
import LikeSquareIcon from "@/components/icons/LikeSquareIcon";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../../edit/[id]/components/ui/dialog";
import { Card } from "../../edit/[id]/components/ui/card";
import { Button } from "@/components/Button";

export type MicroappStatsContentProps = {
  hashId: string;
  /** When true, tighter spacing for embedding under FormBuilder chrome */
  embedded?: boolean;
};

type ConversationMessage = {
  timestamp: string;
  system_prompt: string;
  phase_instructions: string;
  user_prompt: string;
  response: string;
  rubric: string;
  run_score: number | null;
  run_passed: boolean | null;
};

const formatDuration = (seconds: number) => {
  const safeSeconds =
    Number.isFinite(seconds) && seconds > 0 ? Math.round(seconds) : 0;
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = safeSeconds % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
};

export default function MicroappStatsContent({
  hashId,
  embedded = false,
}: MicroappStatsContentProps) {
  const [dataLoading, setDataLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [conversations, setConversations] = useState<any[]>([]);
  const [conversationDialogOpen, setConversationDialogOpen] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
    null
  );
  const [conversationDetail, setConversationDetail] = useState<{
    data: ConversationMessage[];
  } | null>(null);
  const [conversationDetailLoading, setConversationDetailLoading] =
    useState(false);

  const { shellLoading, isAuthorized } = useMicroappAccess(hashId, "edit");
  const fetchSeq = useRef(0);
  const conversationFetchSeq = useRef(0);

  useEffect(() => {
    if (shellLoading) {
      return;
    }
    if (!isAuthorized) {
      setDataLoading(false);
      setStats(null);
      setConversations([]);
      return;
    }

    const seq = ++fetchSeq.current;
    const abortController = new AbortController();
    const signal = abortController.signal;

    const load = async () => {
      setDataLoading(true);
      try {
        const api = axiosInstance();
        const [statsResponse, conversationsResponse] = await Promise.all([
          api.get(`/api/microapps/stats/run?hash_id=${hashId}`, { signal }),
          api.get(`/api/microapps/stats/conversations?hash_id=${hashId}`, {
            signal,
          }),
        ]);
        if (seq !== fetchSeq.current) {
          return;
        }
        setStats(statsResponse.data);
        setConversations(conversationsResponse.data.data);
      } catch (error: unknown) {
        const errorName =
          error && typeof error === "object" && "name" in error
            ? String((error as { name?: string }).name)
            : "";
        if (
          errorName &&
          errorName !== "AbortError" &&
          errorName !== "CanceledError"
        ) {
          console.error("Error:", error);
        }
      } finally {
        if (seq === fetchSeq.current) {
          setDataLoading(false);
        }
      }
    };

    void load();

    return () => abortController.abort();
  }, [hashId, shellLoading, isAuthorized]);

  useEffect(() => {
    if (
      !conversationDialogOpen ||
      !selectedSessionId ||
      shellLoading ||
      !isAuthorized
    ) {
      return;
    }

    const seq = ++conversationFetchSeq.current;
    const abortController = new AbortController();
    const signal = abortController.signal;

    const load = async () => {
      setConversationDetailLoading(true);
      setConversationDetail(null);
      try {
        const response = await axiosInstance().get(
          `/api/microapps/stats/conversation-details?session_id=${selectedSessionId}`,
          { signal }
        );
        if (seq !== conversationFetchSeq.current) {
          return;
        }
        setConversationDetail(response.data);
      } catch (error: unknown) {
        const errorName =
          error && typeof error === "object" && "name" in error
            ? String((error as { name?: string }).name)
            : "";
        if (
          errorName &&
          errorName !== "AbortError" &&
          errorName !== "CanceledError"
        ) {
          console.error("Error:", error);
        }
      } finally {
        if (seq === conversationFetchSeq.current) {
          setConversationDetailLoading(false);
        }
      }
    };

    void load();

    return () => abortController.abort();
  }, [conversationDialogOpen, selectedSessionId, shellLoading, isAuthorized]);

  const openConversationDialog = (sessionId: string) => {
    setSelectedSessionId(sessionId);
    setConversationDialogOpen(true);
  };

  const onConversationDialogOpenChange = (open: boolean) => {
    setConversationDialogOpen(open);
    if (!open) {
      setSelectedSessionId(null);
      setConversationDetail(null);
    }
  };

  const formatConversationTimestamp = (timestamp: string) =>
    format(new Date(timestamp), "MMM d, yyyy HH:mm:ss");

  const exportConversationToExcel = () => {
    if (!conversationDetail?.data || !selectedSessionId) {
      return;
    }

    const exportData = conversationDetail.data.map((message) => ({
      Timestamp: formatConversationTimestamp(message.timestamp),
      "System Prompt": message.system_prompt,
      "Phase Instructions": message.phase_instructions,
      "User Prompt": message.user_prompt,
      Response: message.response,
      Rubric: message.rubric || "",
      Score: message.run_score ?? "",
      Passed:
        message.run_passed === null ? "" : message.run_passed ? "Yes" : "No",
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Conversation");
    const fileName = `conversation_${selectedSessionId}_${format(
      new Date(),
      "yyyyMMdd_HHmmss"
    )}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  const exportAllConversations = async () => {
    try {
      const allConversationDetails = await Promise.all(
        conversations.map(async (conv) => {
          const response = await axiosInstance().get(
            `/api/microapps/stats/conversation-details?session_id=${conv.session_id}`
          );
          return {
            session_id: conv.session_id,
            start_time: conv.start_time,
            messages: response.data.data,
          };
        })
      );

      const exportData = allConversationDetails.flatMap((conversation) => {
        return conversation.messages.map((message: any) => ({
          "Session ID": conversation.session_id,
          "Start Time": format(
            new Date(conversation.start_time),
            "yyyy-MM-dd HH:mm:ss"
          ),
          "Message Timestamp": format(
            new Date(message.timestamp),
            "yyyy-MM-dd HH:mm:ss"
          ),
          "System Prompt": message.system_prompt,
          "Phase Instructions": message.phase_instructions,
          "User Message": message.user_prompt,
          "Assistant Response": message.response,
          Rubric: message.rubric || "",
          Score: message.run_score || "",
          Passed:
            message.run_passed === null
              ? ""
              : message.run_passed
              ? "Yes"
              : "No",
        }));
      });

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "All Conversations");
      const fileName = `all_conversations_${hashId}_${format(
        new Date(),
        "yyyyMMdd_HHmmss"
      )}.xlsx`;
      XLSX.writeFile(wb, fileName);
    } catch (error) {
      console.error("Error exporting conversations:", error);
    }
  };

  if (shellLoading || dataLoading) {
    return <SkeletonLoader />;
  }
  if (!isAuthorized) {
    return <AccessDenied />;
  }

  const row = stats?.data?.[0] ?? {};

  const avgSessionSeconds = Number(row.avg_session_seconds || 0);
  const minSessionSeconds = Number(row.min_session_seconds || 0);
  const maxSessionSeconds = Number(row.max_session_seconds || 0);

  const avgTokens = Number(row.avg_tokens_per_run || 0);
  const minTokens = Number(row.min_tokens_per_run || 0);
  const maxTokens = Number(row.max_tokens_per_run || 0);

  const passRatePct = Number(row.pass_rate_percent ?? 0);
  const passPct = Number(row.pass_percent ?? 0);
  const failPct = Number(row.fail_percent ?? 0);

  const satisfactionPct = Number(row.satisfaction_percent ?? 0);
  const likesPct = Number(row.likes_percent ?? 0);
  const dislikesPct = Number(row.dislikes_percent ?? 0);

  const themes = Array.isArray(row.themes) ? row.themes.slice(0, 6) : [];

  const formatPct = (n: number) =>
    Number.isFinite(n) ? `${n % 1 === 0 ? n : n.toFixed(1)}%` : "0%";

  const CARDS_ASSETS = [
    {
      title: "Avg time in app",
      value: formatDuration(avgSessionSeconds),
      icon: <ClockSquareIcon />,
      subtitle: `min ${formatDuration(
        minSessionSeconds
      )} | max ${formatDuration(maxSessionSeconds)}`,
    },
    {
      title: "Avg tokens",
      value: avgTokens.toLocaleString(),
      icon: <CoinsSquareIcon />,
      subtitle: `min ${minTokens.toLocaleString()} | max ${maxTokens.toLocaleString()}`,
    },
    {
      title: "Pass rate",
      value: formatPct(passRatePct),
      icon: <StaticSquareIcon />,
      subtitle: `pass ${formatPct(passPct)} | fail ${formatPct(failPct)}`,
    },
    {
      title: "User satisfaction",
      value: formatPct(satisfactionPct),
      icon: <LikeSquareIcon />,
      subtitle: `likes ${formatPct(likesPct)} | dislikes ${formatPct(
        dislikesPct
      )}`,
    },
  ];

  const CONVERSATION_TABLE_COLUMNS = [
    "Timestamp",
    "Messages",
    "Credits",
    "Model",
    "Satisfaction",
    "PASS/FAILS",
    "",
  ];

  return (
    <div className="bg-secondary-grey-100 h-full">
      <div className={cn("container mx-auto px-", embedded ? "py-4" : "py-8")}>
        <div className="flex flex-col gap-5">
          <div className="flex w-full gap-5">
            {CARDS_ASSETS.map((card, index) => (
              <div key={index} className="bg-white flex-1 p-4 space-y-5">
                <div className="flex">
                  <div className="w-full space-y-2">
                    <p className="text-gray-600 text-sm">{card.title}</p>
                    <p className="text-2xl font-bold">{card.value}</p>
                  </div>
                  <div>{card.icon}</div>
                </div>
                <p className="text-gray-600 text-xs">{card.subtitle}</p>
              </div>
            ))}
          </div>

          {themes.length > 0 && (
            <div className="bg-white p-4">
              <div className="flex items-center gap-2 mb-4">
                <ClipboardList className="text-primary" />
                <h6 className="text-md font-semibold">Themes</h6>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {themes.map(
                  (
                    theme: { title: string; description: string },
                    index: number
                  ) => (
                    <div
                      key={`${theme.title}-${index}`}
                      className="bg-secondary-grey-100 p-3 space-y-2.5"
                    >
                      <p className="font-semibold text-sm text-gray-900">
                        {theme.title}
                      </p>
                      <p className="text-sm text-gray-600">
                        {theme.description}
                      </p>
                    </div>
                  )
                )}
              </div>
            </div>
          )}

          <div className="bg-white p-4">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <div>
                  <MessageSquareText className="text-primary" />
                </div>

                <h6 className="text-md font-semibold">Conversations</h6>
              </div>

              <button
                type="button"
                onClick={exportAllConversations}
                className="text-gray-600 hover:text-gray-900 flex items-center gap-2"
              >
                <Download className="h-5 w-5" />
                <span className="text-sm">Export All</span>
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-secondary-grey-100 text-xs text-gray-500 uppercase tracking-wider">
                  <tr>
                    {CONVERSATION_TABLE_COLUMNS.map((title, index) => (
                      <th
                        key={index}
                        className="px-6 py-3 text-left font-semibold"
                      >
                        {title}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {conversations.map((conv) => (
                    <tr
                      key={conv.session_id}
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => openConversationDialog(conv.session_id)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(conv.start_time).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {conv.messages_count}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {conv.total_credits}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <span className="px-2.5 py-0.5 bg-secondary-grey-100 rounded-md">
                          {conv.model}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {conv.satisfaction === 1 && (
                          <ThumbsUp className="h-5 w-5 text-green-500" />
                        )}
                        {conv.satisfaction === -1 && (
                          <ThumbsDown className="h-5 w-5 text-red-500" />
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className="text-green-600">
                          {Number(conv.passes || 0)} passes
                        </span>{" "}
                        /{" "}
                        <span className="text-red-600">
                          {Number(conv.fails || 0)} fails
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap flex justify-end text-gray-400">
                        <ChevronRight
                          className="h-5 w-5 text-primary"
                          aria-hidden
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <Dialog
          open={conversationDialogOpen}
          onOpenChange={onConversationDialogOpenChange}
        >
          <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col gap-0 overflow-hidden p-0 sm:rounded-lg">
            <DialogHeader className="shrink-0 border-b px-6 py-4 pr-12 text-left">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                <DialogTitle className="text-lg font-semibold">
                  Conversation
                  {selectedSessionId ? (
                    <span className="mt-1 block font-mono text-xs font-normal text-muted-foreground">
                      {selectedSessionId}
                    </span>
                  ) : null}
                </DialogTitle>
                <Button
                  type="button"
                  onClick={exportConversationToExcel}
                  disabled={
                    !conversationDetail?.data?.length ||
                    conversationDetailLoading
                  }
                  className="shrink-0 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 w-fit"
                >
                  <Download className="h-4 w-4" />
                  Export to Excel
                </Button>
              </div>
            </DialogHeader>
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
              {conversationDetailLoading ? (
                <div className="flex justify-center py-12">
                  <SkeletonLoader />
                </div>
              ) : conversationDetail?.data?.length ? (
                <div className="space-y-4">
                  {conversationDetail.data.map(
                    (message: ConversationMessage, index: number) => (
                      <Card key={index} className="p-4 sm:p-6">
                        <div className="text-sm text-gray-500 mb-4">
                          {formatConversationTimestamp(message.timestamp)}
                        </div>

                        {message.phase_instructions ? (
                          <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                            <div className="text-sm font-medium text-gray-700">
                              Phase Instructions:
                            </div>
                            <div className="text-gray-600">
                              {message.phase_instructions}
                            </div>
                          </div>
                        ) : null}

                        <div className="flex flex-col space-y-4">
                          <div className="flex items-start">
                            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                              <span className="text-blue-600">U</span>
                            </div>
                            <div className="ml-3 bg-blue-50 rounded-lg p-3 flex-grow min-w-0">
                              <div className="text-sm font-medium text-gray-900">
                                User
                              </div>
                              <div className="text-gray-700 break-words">
                                {message.user_prompt}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-start">
                            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                              <span className="text-green-600">A</span>
                            </div>
                            <div className="ml-3 bg-green-50 rounded-lg p-3 flex-grow min-w-0">
                              <div className="text-sm font-medium text-gray-900">
                                Assistant
                              </div>
                              <div className="text-gray-700 whitespace-pre-wrap break-words">
                                {message.response}
                              </div>
                            </div>
                          </div>
                        </div>
                      </Card>
                    )
                  )}
                </div>
              ) : (
                <p className="text-center text-sm text-muted-foreground py-12">
                  No messages in this conversation.
                </p>
              )}
            </div>
          </DialogContent>
        </Dialog>

        <DebugInformation
          surveyJson={null}
          currentConversation={null}
          conversations={null}
          answers={null}
          base64Images={null}
          statsData={stats}
          conversations_json={conversations}
        />
      </div>
    </div>
  );
}
