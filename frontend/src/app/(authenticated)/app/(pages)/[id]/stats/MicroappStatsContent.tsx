"use client";

import { useEffect, useRef, useState } from "react";
import SkeletonLoader from "@/components/layout/loading/skeletonLoader";
import AccessDenied from "@/components/access-denied";
import DebugInformation from "@/components/DebugInformation";
import { Card } from "@/app/(authenticated)/app/(pages)/edit/[id]/components/ui/card";
// import { ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import {
  ThumbsUp,
  ThumbsDown,
  Download,
  MessageSquareText,
  ChevronRight,
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
import Link from "next/link";

export type MicroappStatsContentProps = {
  hashId: string;
  /** When true, tighter spacing for embedding under FormBuilder chrome */
  embedded?: boolean;
};

export default function MicroappStatsContent({
  hashId,
  embedded = false,
}: MicroappStatsContentProps) {
  const [dataLoading, setDataLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [conversations, setConversations] = useState<any[]>([]);

  const { shellLoading, isAuthorized } = useMicroappAccess(hashId, "edit");
  const fetchSeq = useRef(0);

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

  const calculateSatisfactionData = () => {
    const stats_data = stats?.data[0];
    if (!stats_data) return [];

    const total = stats_data.thumbs_up_count + stats_data.thumbs_down_count;

    if (total === 0) {
      return [{ name: "No Data", value: 100 }];
    }

    return [
      {
        name: "Satisfied",
        value: (stats_data.thumbs_up_count / total) * 100,
      },
      {
        name: "Unsatisfied",
        value: (stats_data.thumbs_down_count / total) * 100,
      },
    ];
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

  const stats_data = stats?.data[0];
  const total = stats_data
    ? stats_data.thumbs_up_count + stats_data.thumbs_down_count
    : 0;
  const SATISFACTION_COLORS =
    total === 0 ? ["#9CA3AF"] : ["#22c55e", "#ef4444"];

  const CARDS_ASSETS = [
    {
      title: "Avg time in app",
      value: stats?.data[0]?.sessions || 0,
      icon: <ClockSquareIcon />,
      subtitle: "min 00:35 | max: 5:35",
    },
    {
      title: "Avg Tokens",
      value: stats?.data[0]?.unique_users || 0,
      icon: <CoinsSquareIcon />,
      subtitle: "min 00:35 | max: 5:35",
    },
    {
      title: "Pass Rate",
      value: stats?.data[0]?.total_credits || "0",
      icon: <StaticSquareIcon />,
      subtitle: "min 00:35 | max: 5:35",
    },
    {
      title: "User Satisfaction",
      value: stats?.data[0]?.avg_credits_session || "0",
      icon: <LikeSquareIcon />,
      subtitle: "min 00:35 | max: 5:35",
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
        {/* <h1
        className={cn(
          "font-bold",
          embedded ? "text-2xl mb-4" : "text-3xl mb-8"
        )}
      >
        App Statistics
      </h1> */}

        <div className="flex flex-col gap-5">
          <div className="flex w-full gap-5">
            {/* <div className="bg-white p-4 rounded-lg flex-1">
              <p className="text-gray-600 text-sm">Total Usage</p>
              <p className="text-2xl font-bold">
                {stats?.data[0]?.sessions || 0}
              </p>
            </div> */}
            {/* <div className="bg-white p-4 rounded-lg flex-1">
              <p className="text-gray-600 text-sm">Unique Users</p>
              <p className="text-2xl font-bold">
                {stats?.data[0]?.unique_users || 0}
              </p>
            </div> */}
            {/* <div className="bg-white p-4 rounded-lg flex-1">
              <p className="text-gray-600 text-sm">Total Cost (Credits)</p>
              <p className="text-2xl font-bold">
                {stats?.data[0]?.total_credits || "0"}
              </p>
            </div> */}
            {CARDS_ASSETS.map((card, index) => (
              <div className="bg-white flex-1 p-4 space-y-5">
                <div className="flex">
                  <div key={index} className="w-full space-y-2">
                    <p className="text-gray-600 text-sm">{card.title}</p>
                    <p className="text-2xl font-bold">{card.value}</p>
                  </div>
                  <div>{card.icon}</div>
                </div>
                <p className="text-gray-600 text-xs">{card.subtitle}</p>
              </div>
            ))}
          </div>

          {/* <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">User Satisfaction</h2>
          <div className="h-[300px] relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={calculateSatisfactionData()}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                  startAngle={90}
                  endAngle={-270}
                >
                  {calculateSatisfactionData().map((_, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={
                        SATISFACTION_COLORS[index % SATISFACTION_COLORS.length]
                      }
                    />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-3xl font-bold">
                {stats?.data[0]?.net_satisfaction_score * 100 || 0}%
              </span>
            </div>
          </div>
        </Card> */}

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
                <span>Export All</span>
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
                    <tr key={conv.session_id} className="hover:bg-gray-50">
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
                      <td></td>
                      <td className="px-6 py-4 whitespace-nowrap flex justify-end">
                        <Link
                          href={`/app/${hashId}/stats/${conv.session_id}`}
                          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                        >
                          <ChevronRight />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

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
