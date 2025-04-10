import { AttachedFile } from '@/app/(authenticated)/app/(pages)/edit/[id]/types';
import { SurveyPage, Base64Images } from '@/app/(authenticated)/app/types';
import { useConversationStore } from '@/store/conversationStore';

interface AIConfig {
   aiModel: string;
   temperature: number;
   maxResponseTokens: number | null;
   systemPrompt: string;
}

const getPageConfig = (page: SurveyPage | null) => {
   return {
      scoredPhase: page?.scoredPhase || false,
      rubric: page?.rubric || "",
      minScore: page?.minScore || 0
   };
};

/**
 * Builds the request body for the AI API call.
 * @param finalPrompt The final prompt to send to the AI.
 * @param finalAiInstructions The final AI instructions to send to the AI.
 * @param appId The app ID.
 * @param requestSkip Whether to skip the request.
 * @param userId The user ID.
 * @param aiConfig The AI config.
 * @param pageConfig The page config.
 * @param images The images to send to the AI.
 * @param appHashId The app hash ID.
 * @param skipScoredRun Whether to skip the scored run.
 * @param noSubmit Whether to skip the submission.
 * @returns 
 */
export const buildRequestBody = async (
   finalPrompt: string,
   finalAiInstructions: string,
   appId: number,
   requestSkip: boolean,
   userId: number | null,
   aiConfig: AIConfig,
   pageConfig: ReturnType<typeof getPageConfig>,
   images: Base64Images,
   appHashId: string | undefined,
   attachedFiles: AttachedFile[],
   skipScoredRun: boolean = false,
   hasFixedResponse: boolean = false,
   fixedResponseText: string = "",
   noSubmit: boolean = false
) => {
   const store = useConversationStore.getState();
   const currentConversation = store.currentConversation;

   let conversationHistory = currentConversation?.runs.flatMap(run => 
      run.messages.filter(msg => 
         msg.role === 'assistant' || msg.role === 'user'
      )
   ) || [];

   if (finalPrompt) {
      const lastUserIndex = [...conversationHistory].reverse().findIndex(msg => msg.role === 'user');
      if (lastUserIndex !== -1) {
         conversationHistory = conversationHistory.slice(0, conversationHistory.length - lastUserIndex - 1);
      }
   }

   const historyMessages = conversationHistory.map(msg => ({
      role: msg.role,
      content: msg.content,
   }));

   // Add dummy user message if first message exists and is not from user
   if (historyMessages.length == 0 || historyMessages[0].role !== 'user') {
      historyMessages.unshift({
         role: "user",
         content: ".",
      });
   }

   // First, fetch all text file contents
   const fileContents = await Promise.all(
      attachedFiles.map(async file => {
         const textUrl = `https://${process.env.NEXT_PUBLIC_CLOUDFRONT_DOMAIN}/microapps/${appId}/files/text/${file.text_filename}`;
         try {
            const response = await fetch(textUrl);
            const text = await response.text();
            return {
               filename: file.original_filename,
               description: file.description || 'No description provided',
               content: text
            };
         } catch (error) {
            console.error(`Failed to fetch text for ${file.original_filename}:`, error);
            return null;
         }
      })
   );

   // Build context string from files
   const contextString = fileContents
      .filter(file => file !== null)
      .map(file => `
File: ${file!.filename}
Description: ${file!.description}
============
${file!.content}
============
`)
      .join('\n\n');

   const requestBody: any = {
      model: aiConfig.aiModel,
      messages: [
         // System prompt (if exists)
         ...(aiConfig.systemPrompt ? [{
            role: "system",
            content: aiConfig.systemPrompt,
         }] : []),
         // Context documents as assistant message
         {
            role: "assistant",
            content: `Context Documents:\n${contextString}`,
         },
         // Rest of the conversation
         ...historyMessages,
         ...(finalAiInstructions ? [{ 
            role: "assistant",
            content: finalAiInstructions,
         }] : []),
         ...(Object.keys(images).length > 0 
           ? [{
               role: "user" as const,
               content: [
                 ...Object.values(images).flatMap(imageData => 
                   Object.values(imageData).map(base64 => ({
                     type: "image_url",
                     image_url: {
                       url: base64
                     }
                   }))
                 ),
                 {
                   type: "text",
                   text: finalPrompt
                 }
               ]
             }]
           : [{
               role: "user",
               content: finalPrompt,
             }]
         ),
      ],
      ma_id: Number(appId),
      stream: false,
      request_skip: requestSkip,
      no_submission: noSubmit,
   };

   if (userId !== null) {
      requestBody.user_id = Number(userId);
   }

   if (pageConfig.scoredPhase) {
      requestBody.scored_run = pageConfig.scoredPhase;
      requestBody.rubric = pageConfig.rubric;
      requestBody.minimum_score = pageConfig.minScore;
   }

   if (skipScoredRun) {
      requestBody.scored_run = false;
   }

   if (aiConfig.temperature !== undefined) {
      requestBody.temperature = Number(aiConfig.temperature);
   }

   if (aiConfig.maxResponseTokens !== undefined) {
      requestBody.max_response_tokens = Number(aiConfig.maxResponseTokens);
   }

   if (aiConfig.systemPrompt !== undefined) {
      requestBody.system_prompt = aiConfig.systemPrompt;
   }

   if (finalAiInstructions !== undefined) {
      requestBody.phase_instructions = finalAiInstructions;
   }

   if (finalPrompt !== undefined) {
      requestBody.user_prompt = finalPrompt;
   }

   if (appHashId !== undefined) {
      requestBody.app_hash_id = appHashId;
   }

   if (hasFixedResponse) {
      requestBody.fixed_response = fixedResponseText;
      requestBody.no_submission = true;
      requestBody.scored_run = false;
      requestBody.has_fixed_response = true;
   }

   const conversationId = store.ensureConversation();
   requestBody.session_id = conversationId;

   return requestBody;
};

export { getPageConfig };
export type { AIConfig }; 