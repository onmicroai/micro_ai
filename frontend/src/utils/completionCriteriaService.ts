import axiosInstance from "@/utils/axiosInstance";
import { useConversationStore } from "@/store/conversationStore";
import { CompletionCriterion } from "@/app/(authenticated)/app/types";

export type CompletionCriteriaResults = Record<string, boolean>;

export interface CheckCompletionCriteriaOptions {
  appId: number;
  runUuid: string;
  criteria: CompletionCriterion[];
  userId?: number | null;
}

export interface CheckCompletionCriteriaResponse {
  results: CompletionCriteriaResults;
  cost: number;
  credits: number;
}

export async function checkCompletionCriteria({
  appId,
  runUuid,
  criteria,
  userId,
}: CheckCompletionCriteriaOptions): Promise<CheckCompletionCriteriaResponse> {
  const payload = {
    app_id: appId,
    run_uuid: runUuid,
    criteria: criteria.map((criterion) => ({
      id: criterion.id,
      text: criterion.text,
    })),
  };

  let responseData: CheckCompletionCriteriaResponse;

  if (userId) {
    const api = axiosInstance();
    const response = await api.post(
      "/api/microapps/completion-criteria/",
      payload,
    );
    responseData = response.data;
  } else {
    const response = await fetch(
      "/api/microapps/completion-criteria/anonymous/",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    if (!response.ok) {
      throw new Error("Completion criteria request failed");
    }
    responseData = await response.json();
  }

  const store = useConversationStore.getState();
  store.updateRun(runUuid, {
    cost: responseData.cost,
    credits: responseData.credits,
  });

  return responseData;
}
