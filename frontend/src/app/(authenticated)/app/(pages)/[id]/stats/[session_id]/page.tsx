"use client";

import { useEffect, useState } from "react";
import { checkIsOwner } from "@/utils/checkRoles";
import SkeletonLoader from "@/components/layout/loading/skeletonLoader";
import AccessDenied from "@/components/access-denied";
import axiosInstance from "@/utils/axiosInstance";
import { Card } from "../../../edit/[id]/components/ui/card";
import { format } from "date-fns";
import * as XLSX from 'xlsx';
import { Button } from "@/components/Button";
import { useUserStore } from "@/store/userStore";

interface Message {
  timestamp: string;
  system_prompt: string;
  phase_instructions: string;
  user_prompt: string;
  response: string;
  rubric: string;
  run_score: number | null;
  run_passed: boolean | null;
}

export default function ConversationDetailPage({ 
  params 
}: { 
  params: { id: string; session_id: string } 
}) {
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [conversation, setConversation] = useState<any>(null);
  const { user } = useUserStore();
  const userId = Number(user?.id);
  const hashId = params.id;
  const sessionId = params.session_id;

  useEffect(() => {
    const abortController = new AbortController();
    const signal = abortController.signal;

    const fetchData = async () => {
      try {
        const isOwner = await checkIsOwner(hashId, userId, signal);
        setIsAuthorized(Boolean(isOwner));

        if (isOwner) {
          const response = await axiosInstance().get(
            `/api/microapps/stats/conversation-details?session_id=${sessionId}`
          );
          setConversation(response.data);
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
  }, [hashId, userId, sessionId]);

  const formatTimestamp = (timestamp: string) => {
    return format(new Date(timestamp), "MMM d, yyyy HH:mm:ss");
  };

  const exportToExcel = () => {
    if (!conversation?.data) return;

    // Prepare the data for export
    const exportData = conversation.data.map((message: Message) => ({
      Timestamp: formatTimestamp(message.timestamp),
      'System Prompt': message.system_prompt,
      'Phase Instructions': message.phase_instructions,
      'User Prompt': message.user_prompt,
      'Response': message.response,
      'Rubric': message.rubric || '',
      'Score': message.run_score || '',
      'Passed': message.run_passed === null ? '' : message.run_passed ? 'Yes' : 'No'
    }));

    // Create worksheet
    const ws = XLSX.utils.json_to_sheet(exportData);

    // Create workbook
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Conversation');

    // Generate filename with session ID and date
    const fileName = `conversation_${sessionId}_${format(new Date(), 'yyyyMMdd_HHmmss')}.xlsx`;

    // Save file
    XLSX.writeFile(wb, fileName);
  };

  if (isLoading) return <SkeletonLoader />;
  if (!isAuthorized) return <AccessDenied />;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Conversation Details</h1>
        <Button
          onClick={exportToExcel}
          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-2"
        >
          <svg 
            className="w-5 h-5" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
            />
          </svg>
          Export to Excel
        </Button>
      </div>
      
      <div className="space-y-6">
        {conversation?.data.map((message: Message, index: number) => (
          <Card key={index} className="p-6">
            <div className="text-sm text-gray-500 mb-4">
              {formatTimestamp(message.timestamp)}
            </div>

            {message.phase_instructions && (
              <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                <div className="text-sm font-medium text-gray-700">Phase Instructions:</div>
                <div className="text-gray-600">{message.phase_instructions}</div>
              </div>
            )}

            <div className="flex flex-col space-y-4">
              <div className="flex items-start">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                  <span className="text-blue-600">U</span>
                </div>
                <div className="ml-3 bg-blue-50 rounded-lg p-3 flex-grow">
                  <div className="text-sm font-medium text-gray-900">User</div>
                  <div className="text-gray-700">{message.user_prompt}</div>
                </div>
              </div>

              <div className="flex items-start">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                  <span className="text-green-600">A</span>
                </div>
                <div className="ml-3 bg-green-50 rounded-lg p-3 flex-grow">
                  <div className="text-sm font-medium text-gray-900">Assistant</div>
                  <div className="text-gray-700 whitespace-pre-wrap">{message.response}</div>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
} 