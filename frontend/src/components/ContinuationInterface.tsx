"use client";

import React, { useMemo } from "react";
import ChatQuestion from "./QuestionTypes/ChatQuestion";
import { Element, Answers } from "@/app/(authenticated)/app/types";
import { useSurveyStore } from "@/store/runtimeSurveyStore";
import { useConversationStore } from "@/store/conversationStore";

interface ContinuationInterfaceProps {
  appId: number | null;
  userId: number | null;
  surveyJson: any;
  answers: Answers;
  isOwner: boolean;
  isAdmin: boolean;
  isExpanded: boolean;
  onToggleExpanded: () => void;
}

const ContinuationInterface: React.FC<ContinuationInterfaceProps> = ({
  appId,
  userId,
  surveyJson,
  answers,
  isOwner,
  isAdmin,
  isExpanded,
}) => {
  const { setInputValue: surveySetInputValue } = useSurveyStore();
  const conversationId = useConversationStore((s) => {
    if (!appId) return "";
    const appIdStr = String(appId);
    const userIdStr = userId != null ? String(userId) : undefined;
    const conv = s.conversations.find(
      (c) => c.metadata?.appId === appIdStr && c.metadata?.userId === userIdStr
    );
    return conv?.id ?? s.currentConversation?.id ?? "";
  });

  const elementName = `continuation_chat_${appId}_${userId}`;
  const continuationTryId = conversationId || undefined;

  // Create a synthetic chat element for continuation
  const continuationElement: Element = {
    id: elementName,
    name: elementName,
    type: "chat",
    label: "Continue the Conversation",
    description:
      "Have additional questions or want to refine your results? Chat with the AI below.",
    initialMessage:
      "Great! Let's continue. What would you like to ask or modify?",
    chatbotInstructions:
      surveyJson?.aiConfig?.systemPrompt ||
      "You are a helpful AI assistant. The user has completed a structured conversation and now wants to continue with follow-up questions or modifications. Be helpful and responsive to their requests.",
    maxMessages: 20, // Allow more messages for continuation
    enableTts: false, // Disable TTS for continuation by default
    avatarUrl: surveyJson?.aiConfig?.avatarUrl || undefined,
    isRequired: false,
  };

  // Create synthetic answers object for the chat, using existing answers if available
  const continuationAnswers: Answers = useMemo(
    () => ({
      [elementName]: {
        value: answers[elementName]?.value || [],
        otherValue: answers[elementName]?.otherValue || "",
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [answers[elementName]?.value, answers[elementName]?.otherValue],
  );

  // Create a setInputValue function that persists to the survey store
  const setInputValue = (
    name: string,
    value: any,
    otherValue: string,
    type: string,
  ) => {
    // Persist the chat history to the survey store so it survives page refreshes
    surveySetInputValue(name, value, otherValue, type);
  };

  return (
    <div className="mt-4">
      {isExpanded && (
        // Expanded chat interface
        <div className="space-y-4">
          {appId ? (
            // Chat Interface using existing ChatQuestion component
            <ChatQuestion
              element={continuationElement}
              answers={continuationAnswers}
              setInputValue={setInputValue}
              errors={[]}
              disabled={false}
              appId={appId}
              userId={userId}
              surveyJson={surveyJson}
              currentPhaseIndex={-1} // Special index for continuation
              isOwner={isOwner}
              isAdmin={isAdmin}
              activeTryId={continuationTryId}
              activeTryIndex={1}
            />
          ) : (
            // Loading state while appId is being loaded
            <div className="flex justify-center py-8">
              <div className="text-sm text-gray-500">
                Loading chat interface...
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ContinuationInterface;
