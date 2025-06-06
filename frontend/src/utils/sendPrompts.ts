import { SurveyJson, Answers, Prompt, SendPromptResponse, Base64Images } from '@/app/(authenticated)/app/types';
import axiosInstance from "@/utils//axiosInstance";
import evaluateVisibility from "@/utils//evaluateVisibility";
import { ConditionalLogic } from "@/app/(authenticated)/app/types";
import groupPromptsByType from "@/utils//groupPromptsByType";
import injectValuesIntoPrompt from "@/utils//injectValuesIntoPrompt";
import { useConversationStore } from '@/store/conversationStore';
import delay from "./delay";
import { buildRequestBody, getPageConfig } from '@/utils/buildRequestBody';

const handleAIResponse = async (
   requestBody: any,
   userId: number | null,
   setState: (state: any) => void,
): Promise<SendPromptResponse> => {
   const store = useConversationStore.getState();
   try {
      const endpoint = !userId ? '/api/microapps/run/anonymous' : '/api/microapps/run';
      
      let responseData;
      
      if (!userId) {
         const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
               'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify(requestBody)
         });
         
         if (!response.ok) {
            let errorMessage;
            try {
               // Try to parse as JSON first
               const errorData = await response.json();
               errorMessage = typeof errorData === 'object' ? 
                  JSON.stringify(errorData) : 
                  String(errorData);
            } catch {
               // If parsing fails, use text response
               errorMessage = await response.text();
            }
            throw new Error(errorMessage || `HTTP error! Status: ${response.status}`);
         }
         
         const data = await response.json();
         responseData = data.data;
      } else {
         const api = axiosInstance()
         const response = await api.post(endpoint, requestBody);
         responseData = response.data.data;
      }
      
      const promptResponse = responseData.response;

      // Update the current run with all response data
      const runId = store.currentConversation?.runs[store.currentConversation?.runs.length - 1].id;
      if (runId) {
         store.updateRun(runId, {
            status: 'completed',
            run_passed: responseData.run_passed,
            run_score: responseData.run_score,
            no_submission: responseData.no_submission,
            cost: responseData.cost,
            credits: responseData.credits,
            session_id: responseData.session_id
         });
      }

      // Add the response message
      store.addMessage('assistant', promptResponse);
      
      await delay(1000);
      
      setState((state: any) => ({
         ...state,
         promptResponse,
         promptLoading: false,
         responses: [...(state.responses || []), promptResponse],
      }));
      
      return { 
         success: true, 
         response: promptResponse, 
         run_passed: responseData.run_passed,
         run_uuid: responseData.run_uuid || responseData.id  // Use run_uuid from response or fallback to id
      };
   } catch (error: any) {
      let errorResponse;
      
      // Handle the case where error.message contains the JSON string from our throw
      if (error instanceof Error && error.message) {
         try {
            // Try to parse the error message as JSON
            errorResponse = JSON.parse(error.message);
            if (errorResponse.error !== undefined) {
               errorResponse = errorResponse.error;
            }
         } catch {
            // If it's not valid JSON, use the message directly
            errorResponse = error.message;
         }
      } else {
         // Fall back to the original error handling
         errorResponse = structuredClone(error?.response?.data || {});
         errorResponse = Array.isArray(errorResponse) ? errorResponse[0] : errorResponse;
         errorResponse = typeof errorResponse === "object" ? errorResponse.error : errorResponse;
      }
      
      const errorMessage = typeof errorResponse === 'object' ? 
         JSON.stringify(errorResponse) : 
         String(errorResponse || 'Unknown error');
      
      setState((state: any) => ({
         ...state,
         sendPromptError: errorMessage,
         promptLoading: false
      }));

      // Update run status to failed on error
      const runId = store.currentConversation?.runs[store.currentConversation?.runs.length - 1].id;
      if (runId) {
         store.updateRun(runId, { 
            status: 'failed',
            run_passed: false
         });
      }

      return { success: false, error: errorMessage };
   }
};

/**
 * Updates a run on the server using the PATCH method
 * @param sessionId - The ID of the session to update
 * @param runId - The ID of the run to update
 * @param updateData - The data to update on the run
 * @param userId - The ID of the user (null for anonymous users)
 * @returns A promise that resolves to the updated run data
 */
export const updateRunUtil = async (
   runId: string,
   updateData: Record<string, any>,
   userId: number | null
): Promise<{ success: boolean; data?: any; error?: string }> => {
   const store = useConversationStore.getState();
   
   try {
      // Prepare the request payload
      const requestBody = {
         id: runId,
         ...updateData
      };
      
      let responseData;
      
      // Handle anonymous vs authenticated requests
      if (!userId) {
         const endpoint = '/api/microapps/run/anonymous';
         const response = await fetch(endpoint, {
            method: 'PATCH',
            headers: {
               'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify(requestBody)
         });
         
         if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
         }
         
         responseData = await response.json();
      } else {
         const api = axiosInstance();
         const response = await api.patch('/api/microapps/run', requestBody);
         responseData = response.data;
      }
      
      // Update the run in the local store
      store.updateRun(runId, {
         ...updateData,
         updatedAt: Date.now()
      });
      
      return { 
         success: true, 
         data: responseData 
      };
   } catch (error: any) {
      let errorResponse = structuredClone(error?.response?.data || {});
      errorResponse = Array.isArray(errorResponse) ? errorResponse[0] : errorResponse;
      errorResponse = typeof errorResponse === "object" ? errorResponse.error : errorResponse;
      
      const errorMessage = "Failed to update run: " + JSON.stringify(errorResponse);
      
      return { success: false, error: errorMessage };
   }
};

export const sendPromptsUtil = async (options: {
  prompts?: Prompt[] | null;
  answers?: Answers;
  images?: Base64Images;
  appId?: number;
  appConfig?: SurveyJson | null;
  pageIndex?: number;
  userId?: number | null;
  requestSkip?: boolean;
  set?: any;
  skipScoredRun?: boolean;
  hasFixedResponse?: boolean;
  fixedResponseText?: string;
  noSubmit?: boolean;
  transcriptionCost?: number;
}): Promise<SendPromptResponse> => {
const {
    prompts = null,
    answers = {},
    images = {},
    appId = 0,
    appConfig = null,
    pageIndex = 0,
    userId = null,
    skipScoredRun = false,
    requestSkip = false,
    set = (s: any) => s,
    noSubmit = false,
    transcriptionCost
  } = options;

  let {
    hasFixedResponse = false,
    fixedResponseText = ""
  } = options;

  const store = useConversationStore.getState();

    // Step 1: Filter prompts based on visibility conditions
    const visiblePrompts = (prompts || []).filter(prompt => 
       evaluateVisibility(prompt.conditionalLogic || {} as ConditionalLogic, answers)
    );
    
    // Step 2: Group visible prompts by their type (prompt, aiInstructions, fixedResponse)
    const groupedPrompts = groupPromptsByType(visiblePrompts);
    
    // Step 3: Inject values into all prompt groups at once
    const finalPrompts = {
        finalAiInstructions: groupedPrompts['aiInstructions'] ? 
            injectValuesIntoPrompt(groupedPrompts['aiInstructions'], answers) as Prompt[] : [],
        finalPrompt: groupedPrompts['prompt'] ? 
            injectValuesIntoPrompt(groupedPrompts['prompt'], answers) as Prompt[] : [],
        finalFixedResponses: groupedPrompts['fixedResponse'] ? 
            injectValuesIntoPrompt(groupedPrompts['fixedResponse'], answers) as Prompt[] : []
    };
    
    const aiConfig = {
      aiModel: appConfig?.aiConfig.aiModel || "gpt-4o-mini",
      temperature: appConfig?.aiConfig.temperature || 0.9,
      maxResponseTokens: appConfig?.aiConfig.maxResponseTokens || null,
      systemPrompt: appConfig?.aiConfig.systemPrompt || ""
    };

    const attachedFiles = appConfig?.attachedFiles || [];
   const page = appConfig?.phases?.[pageIndex] || null;
   const pageConfig = getPageConfig(page);

   //Create a run with current settings and 'pending' status
   //Creating a run will automatically add it to the conversation, if it exists. Or, it will create a new one if it doesn't.
   const run = {
      id: crypto.randomUUID(),
      run_uuid: crypto.randomUUID(),
      aiModel: aiConfig.aiModel,
      cost: 0,
      credits: 0,
      status: 'pending' as const,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: [],
      phaseIndex: pageIndex,  // Add the phase index to track which phase this run belongs to
      session_id: ''  // Add default empty session_id
   };
   store.addRun(run);

   const combinedAiInstructions = finalPrompts.finalAiInstructions
      .map(p => p.text)
      .filter(Boolean)
      .join('\n');

   const appHashId = appConfig?.hashId;

   // Add AI instructions as a message to the run
   if (combinedAiInstructions) {
      store.addMessage('instruction', combinedAiInstructions);
   }

   const combinedPrompt = finalPrompts.finalPrompt
      .map(p => p.text)
      .filter(Boolean)
      .join('\n');

   // Add user prompt as a message to the run
   if (combinedPrompt) {
      store.addMessage('user', combinedPrompt);
   }

   //If there are fixed responses, return the fixed response and exit.
   if (finalPrompts.finalFixedResponses.length > 0) {
     const combinedText = finalPrompts.finalFixedResponses
        .map(p => p.text)
        .filter(Boolean)
        .join('\n');
      store.addMessage('fixed_response', combinedText);
      hasFixedResponse = true;
      fixedResponseText = combinedText;
   }

   const requestBody = await buildRequestBody(
      combinedPrompt,
      combinedAiInstructions,
      appId,
      requestSkip,
      userId,
      aiConfig,
      pageConfig,
      images,
      appHashId,
      attachedFiles,
      skipScoredRun,
      hasFixedResponse,
      fixedResponseText,
      noSubmit,
      transcriptionCost,
      run.id
   );

   return handleAIResponse(requestBody, userId, set);
};