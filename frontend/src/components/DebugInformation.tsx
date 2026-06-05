"use client";

import { FaChevronUp, FaChevronDown } from "react-icons/fa";
import { useState } from "react";
import { SurveyJson } from "../app/(authenticated)/app/types";
import type { Conversation } from "../store/conversationStore";
import { DebugConversationPanel } from "./debug/DebugConversationPanel";
import { cn } from "@/utils/cn";

interface DebugInformationProps {
  surveyJson?: SurveyJson | null;
  currentConversation?: Conversation | null;
  conversations?: Conversation[] | null;
  answers?: any;
  base64Images?: any;
  statsData?: any;
  conversations_json?: any;
}

type DebugTab = "turns" | "raw";

function RawJsonSection({
  title,
  data,
}: {
  title: string;
  data: unknown;
}) {
  if (data == null) return null;
  return (
    <div className="debug-section">
      <h3 className="text-sm font-semibold mb-2">{title}</h3>
      <pre className="bg-gray-100 p-3 rounded overflow-x-auto whitespace-pre-wrap break-all max-h-64 text-xs">
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}

export default function DebugInformation({
  surveyJson,
  currentConversation,
  conversations,
  answers,
  base64Images,
  statsData,
  conversations_json,
}: DebugInformationProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<DebugTab>("turns");

  const hasRuntimeTurns = (currentConversation?.runs?.length ?? 0) > 0;

  return (
    <div className="fixed bottom-0 right-0 p-4 bg-white border rounded-tl shadow-lg max-w-[90vw] md:max-w-4xl z-50">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 text-gray-600 hover:text-gray-800"
      >
        <span>Debug Info</span>
        {isOpen ? <FaChevronDown /> : <FaChevronUp />}
      </button>

      {isOpen && (
        <div className="mt-4 flex flex-col max-h-[80vh]">
          <div className="flex gap-1 border-b border-gray-200 mb-4 shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab("turns")}
              className={cn(
                "px-3 py-2 text-sm font-medium rounded-t",
                activeTab === "turns"
                  ? "bg-gray-100 text-gray-900 border border-b-0 border-gray-200 -mb-px"
                  : "text-gray-600 hover:text-gray-800"
              )}
            >
              AI Turns
              {hasRuntimeTurns ? (
                <span className="ml-1.5 text-xs text-gray-500">
                  ({currentConversation!.runs.length})
                </span>
              ) : null}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("raw")}
              className={cn(
                "px-3 py-2 text-sm font-medium rounded-t",
                activeTab === "raw"
                  ? "bg-gray-100 text-gray-900 border border-b-0 border-gray-200 -mb-px"
                  : "text-gray-600 hover:text-gray-800"
              )}
            >
              Raw JSON
            </button>
          </div>

          <div className="min-h-0 overflow-auto space-y-4">
            {activeTab === "turns" ? (
              <DebugConversationPanel
                conversation={currentConversation}
                surveyJson={surveyJson}
              />
            ) : (
              <>
                <RawJsonSection title="Survey JSON" data={surveyJson} />
                <RawJsonSection
                  title="Current Conversation"
                  data={currentConversation}
                />
                <RawJsonSection title="All Conversations" data={conversations} />
                <RawJsonSection title="Answers" data={answers} />
                <RawJsonSection title="Base64 Images" data={base64Images} />
                <RawJsonSection title="Stats Data" data={statsData} />
                <RawJsonSection
                  title="Conversations JSON"
                  data={conversations_json}
                />
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
