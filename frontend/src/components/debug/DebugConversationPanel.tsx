"use client";

import type { Conversation } from "@/store/conversationStore";
import type { SurveyJson } from "@/app/(authenticated)/app/types";
import { DebugTurnCard } from "./DebugTurnCard";

type DebugConversationPanelProps = {
  conversation: Conversation | null | undefined;
  surveyJson?: SurveyJson | null;
};

export function DebugConversationPanel({
  conversation,
  surveyJson,
}: DebugConversationPanelProps) {
  const runs = [...(conversation?.runs ?? [])].sort(
    (a, b) => a.createdAt - b.createdAt
  );

  if (!runs.length) {
    return (
      <p className="text-sm text-gray-500 py-4">
        No AI turns yet. Interact with the app to record runs.
      </p>
    );
  }

  const phases = surveyJson?.phases ?? [];

  return (
    <div className="space-y-4">
      {runs.map((run, index) => {
        const phaseTitle =
          phases[run.phaseIndex]?.title?.trim() ||
          (run.phaseIndex != null ? `Phase ${run.phaseIndex + 1}` : "");
        const isLatest = index === runs.length - 1;
        return (
          <DebugTurnCard
            key={run.id}
            turnNumber={index + 1}
            run={run}
            phaseTitle={phaseTitle}
            defaultExpanded={isLatest}
          />
        );
      })}
    </div>
  );
}
