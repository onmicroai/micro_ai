"use client";

import { useEffect, useState } from "react";
import { checkIsOwner, checkIsAdmin } from "@/utils/checkRoles";
import SkeletonLoader from "@/components/layout/loading/skeletonLoader";
import AccessDenied from "@/components/access-denied";
import DebugInformation from "@/components/DebugInformation";
import { Card } from "../../edit/[id]/components/ui/card";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from "recharts";
import { ThumbsUp, ThumbsDown, Download } from 'lucide-react';
import axiosInstance from "@/utils/axiosInstance";
import * as XLSX from 'xlsx';
import { format } from "date-fns";
import { useUserStore } from "@/store/userStore";

export default function StatsPage({ params }: { params: { id: string } }) {
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [conversations, setConversations] = useState<any[]>([]);
  const { user } = useUserStore();
  const userId = Number(user?.id);
  const hashId = params.id;

  useEffect(() => {

    const abortController = new AbortController();
    const signal = abortController.signal;

    const fetchData = async () => {


      try {
        const [ownerResult, adminResult] = await Promise.all([
          checkIsOwner(hashId, userId, signal),
          checkIsAdmin(hashId, userId, signal)
        ]);
        const api = axiosInstance();
        setIsAuthorized(ownerResult.isOwner || adminResult.isAdmin);

        if (ownerResult.isOwner || adminResult.isAdmin) {
          // Fetch both stats and conversations
          const [statsResponse, conversationsResponse] = await Promise.all([
            api.get(`/api/microapps/stats/run?hash_id=${hashId}`),
            api.get(`/api/microapps/stats/conversations?hash_id=${hashId}`)
          ]);
          
          setStats(statsResponse.data);
          setConversations(conversationsResponse.data.data);
        }
      } catch (error: any) {
         const errorName = error?.name;
         if (errorName && errorName !== 'AbortError' && errorName !== 'CanceledError') {
            console.error("Error:", error);
         }
      } finally {
         setIsLoading(false);
      }
    };

    if (userId) {
      fetchData();
    }

    return () => abortController.abort();
  }, [hashId, userId]);

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
        value: (stats_data.thumbs_up_count / total) * 100 
      },
      { 
        name: "Unsatisfied", 
        value: (stats_data.thumbs_down_count / total) * 100 
      }
    ];
  };

  const exportAllConversations = async () => {
    try {
      // Fetch details for all conversations
      const allConversationDetails = await Promise.all(
        conversations.map(async (conv) => {
          const response = await axiosInstance().get(
            `/api/microapps/stats/conversation-details?session_id=${conv.session_id}`
          );
          return {
            session_id: conv.session_id,
            start_time: conv.start_time,
            messages: response.data.data
          };
        })
      );

      // Prepare data for export
      const exportData = allConversationDetails.flatMap(conversation => {
        return conversation.messages.map((message: any) => ({
          'Session ID': conversation.session_id,
          'Start Time': format(new Date(conversation.start_time), "yyyy-MM-dd HH:mm:ss"),
          'Message Timestamp': format(new Date(message.timestamp), "yyyy-MM-dd HH:mm:ss"),
          'System Prompt': message.system_prompt,
          'Phase Instructions': message.phase_instructions,
          'User Message': message.user_prompt,
          'Assistant Response': message.response,
          'Rubric': message.rubric || '',
          'Score': message.run_score || '',
          'Passed': message.run_passed === null ? '' : message.run_passed ? 'Yes' : 'No'
        }));
      });

      // Create worksheet
      const ws = XLSX.utils.json_to_sheet(exportData);

      // Create workbook
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'All Conversations');

      // Generate filename
      const fileName = `all_conversations_${hashId}_${format(new Date(), 'yyyyMMdd_HHmmss')}.xlsx`;

      // Save file
      XLSX.writeFile(wb, fileName);
    } catch (error) {
      console.error('Error exporting conversations:', error);
      // You might want to add error handling UI here
    }
  };

  if (isLoading) return <SkeletonLoader />;
  if (!isAuthorized) return <AccessDenied />;

  const stats_data = stats?.data[0];
  const total = stats_data ? (stats_data.thumbs_up_count + stats_data.thumbs_down_count) : 0;
  const SATISFACTION_COLORS = total === 0 
    ? ["#9CA3AF"]  // gray for no data
    : ["#22c55e", "#ef4444"]; // green and red colors

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">App Statistics</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Key Metrics */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Key Metrics</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-gray-600 text-sm">Total Usage</p>
              <p className="text-2xl font-bold">
                {stats?.data[0]?.sessions || 0}
              </p>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-gray-600 text-sm">Unique Users</p>
              <p className="text-2xl font-bold">
                {stats?.data[0]?.unique_users || 0}
              </p>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-gray-600 text-sm">Total Cost (Credits)</p>
              <p className="text-2xl font-bold">
                {stats?.data[0]?.total_credits || '0'}
              </p>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-gray-600 text-sm">Avg. Cost per Usage (Credits)</p>
              <p className="text-2xl font-bold">
                {stats?.data[0]?.avg_credits_session || '0'}
              </p>
            </div>
          </div>
        </Card>

        {/* Add new Satisfaction Card */}
        <Card className="p-6">
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
                    <Cell key={`cell-${index}`} fill={SATISFACTION_COLORS[index % SATISFACTION_COLORS.length]} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-3xl font-bold">
                {stats?.data[0]?.net_satisfaction_score * 100|| 0}%
              </span>
            </div>
          </div>
        </Card>

        {/* Conversations Table */}
        <Card className="p-6 col-span-2">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Recent Conversations</h2>
            <button 
              onClick={exportAllConversations}
              className="text-gray-600 hover:text-gray-900 flex items-center gap-2"
            >
              <Download className="h-5 w-5" />
              <span>Export All</span>
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Timestamp
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Messages
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Credits
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Model
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Satisfaction
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
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
                      {conv.model}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {conv.satisfaction === 1 && (
                        <ThumbsUp className="h-5 w-5 text-green-500" />
                      )}
                      {conv.satisfaction === -1 && (
                        <ThumbsDown className="h-5 w-5 text-red-500" />
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <a 
                        href={`/app/${hashId}/stats/${conv.session_id}`}
                        className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                      >
                        View Conversation
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

      </div>

      {/* Debug Information */}
      {(isAuthorized) && (
         <DebugInformation
            surveyJson={null}
            currentConversation={null}
            conversations={null}
            answers={null}
            base64Images={null}
            statsData={stats}
            conversations_json={conversations}
         />
      )}
    </div>
  );
} 