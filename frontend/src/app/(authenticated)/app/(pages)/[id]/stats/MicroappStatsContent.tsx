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
import { parseRunScoreTotal } from "@/utils/parseRunScoreTotal";
import {
  type ConversationMessage,
  formatConversationTimestamp,
  formatStoredPrompt,
} from "@/utils/statsConversation";
import ClockSquareIcon from "@/components/icons/ClockSquareIcon";
import CoinsSquareIcon from "@/components/icons/CoinsSquareIcon";
import StaticSquareIcon from "@/components/icons/StatisticSquareIcon";
import LikeSquareIcon from "@/components/icons/LikeSquareIcon";
import { ConversationDetailsDialog } from "./components/ConversationDetailsDialog";

export type MicroappStatsContentProps = {
  hashId: string;
  /** When true, tighter spacing for embedding under FormBuilder chrome */
  embedded?: boolean;
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

  const openConversationDialog = (sessionId: string | number) => {
    setSelectedSessionId(String(sessionId));
    setConversationDialogOpen(true);
  };

  const onConversationDialogOpenChange = (open: boolean) => {
    setConversationDialogOpen(open);
    if (!open) {
      setSelectedSessionId(null);
      setConversationDetail(null);
    }
  };

  const exportConversationToExcel = () => {
    if (!conversationDetail?.data || !selectedSessionId) {
      return;
    }

    const exportData = conversationDetail.data.map((message) => ({
      Timestamp: formatConversationTimestamp(message.timestamp),
      "System Prompt": formatStoredPrompt(message.system_prompt),
      "Phase Instructions": message.phase_instructions,
      "User Prompt": formatStoredPrompt(message.user_prompt),
      Response: message.response,
      Rubric: message.rubric || "",
      Score: message.score_total ?? parseRunScoreTotal(message.run_score) ?? "",
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
          "System Prompt": formatStoredPrompt(message.system_prompt),
          "Phase Instructions": message.phase_instructions,
          "User Message": formatStoredPrompt(message.user_prompt),
          "Assistant Response": message.response,
          Rubric: message.rubric || "",
          Score:
            message.score_total ?? parseRunScoreTotal(message.run_score) ?? "",
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

  const avgCreditsPerRun = Number(
    (row.avg_credits_per_run ?? row.avg_tokens_per_run) || 0
  );
  const minCreditsPerRun = Number(
    (row.min_credits_per_run ?? row.min_tokens_per_run) || 0
  );
  const maxCreditsPerRun = Number(
    (row.max_credits_per_run ?? row.max_tokens_per_run) || 0
  );

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
      title: "Avg credits",
      value: avgCreditsPerRun.toLocaleString(),
      icon: <CoinsSquareIcon />,
      subtitle: `min ${minCreditsPerRun.toLocaleString()} | max ${maxCreditsPerRun.toLocaleString()}`,
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
  const selectedConversation = conversations.find(
    (conv) => String(conv.session_id ?? "") === selectedSessionId
  );

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
                  {conversations.map((conv) => {
                    const rowSessionId = String(conv.session_id ?? "");
                    const isOpenInDialog =
                      conversationDialogOpen &&
                      selectedSessionId === rowSessionId;
                    const selectedCell = isOpenInDialog
                      ? "bg-sky-100 hover:bg-sky-200/90"
                      : "";
                    return (
                      <tr
                        key={rowSessionId}
                        aria-selected={isOpenInDialog}
                        className={cn(
                          "cursor-pointer transition-colors",
                          !isOpenInDialog && "hover:bg-gray-50"
                        )}
                        onClick={() => openConversationDialog(conv.session_id)}
                      >
                        <td
                          className={cn(
                            "px-6 py-4 whitespace-nowrap text-sm text-gray-500",
                            selectedCell
                          )}
                        >
                          {new Date(conv.start_time).toLocaleString()}
                        </td>
                        <td
                          className={cn(
                            "px-6 py-4 whitespace-nowrap text-sm text-gray-500",
                            selectedCell
                          )}
                        >
                          {conv.messages_count}
                        </td>
                        <td
                          className={cn(
                            "px-6 py-4 whitespace-nowrap text-sm text-gray-500",
                            selectedCell
                          )}
                        >
                          {conv.total_credits}
                        </td>
                        <td
                          className={cn(
                            "px-6 py-4 whitespace-nowrap text-sm text-gray-500",
                            selectedCell
                          )}
                        >
                          <span className="px-2.5 py-0.5 bg-secondary-grey-100 rounded-md">
                            {conv.model}
                          </span>
                        </td>
                        <td
                          className={cn(
                            "px-6 py-4 whitespace-nowrap",
                            selectedCell
                          )}
                        >
                          {conv.satisfaction === 1 && (
                            <ThumbsUp className="h-5 w-5 text-green-500" />
                          )}
                          {conv.satisfaction === -1 && (
                            <ThumbsDown className="h-5 w-5 text-red-500" />
                          )}
                        </td>
                        <td
                          className={cn(
                            "px-6 py-4 whitespace-nowrap text-sm",
                            selectedCell
                          )}
                        >
                          <span className="text-green-600">
                            {Number(conv.passes || 0)} passes
                          </span>{" "}
                          /{" "}
                          <span className="text-red-600">
                            {Number(conv.fails || 0)} fails
                          </span>
                        </td>
                        <td
                          className={cn(
                            "px-6 py-4 whitespace-nowrap flex justify-end",
                            selectedCell,
                            isOpenInDialog ? "text-sky-700" : "text-gray-400"
                          )}
                        >
                          <ChevronRight className="h-5 w-5" aria-hidden />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <ConversationDetailsDialog
          open={conversationDialogOpen}
          onOpenChange={onConversationDialogOpenChange}
          loading={conversationDetailLoading}
          detail={conversationDetail}
          selectedConversation={selectedConversation ?? null}
          onExportExcel={exportConversationToExcel}
        />

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
