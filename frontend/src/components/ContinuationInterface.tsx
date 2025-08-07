"use client";

import React, { useState, ChangeEvent, useEffect } from "react";
import TextQuestion from "./QuestionTypes/TextQuestion";
import { AIResponseDisplay } from "@/utils/phaseResultDisplay";
import { sendPromptsUtil } from "@/utils/sendPrompts";
import { useConversationStore } from "@/store/conversationStore";
import { Element, Answers, Prompt } from "@/app/(authenticated)/app/types";
import { toast } from "react-toastify";

interface ContinuationInterfaceProps {
   appId: number | null;
   userId: number | null;
   surveyJson: any;
   answers: Answers;
   isOwner: boolean;
   isAdmin: boolean;
}

const ContinuationInterface: React.FC<ContinuationInterfaceProps> = ({
   appId,
   userId,
   surveyJson,
   answers,
   isOwner,
   isAdmin,
}) => {
   const [continuationRunId, setContinuationRunId] = useState<string | null>(null);
   const [inputValue, setInputValue] = useState('');
   const [isLoading, setIsLoading] = useState(false);
   const { currentConversation } = useConversationStore();

   // Watch for the continuation run in the conversation store
   useEffect(() => {
      if (continuationRunId && currentConversation?.runs) {
         const run = currentConversation.runs.find(r => r.id === continuationRunId);
         if (run && run.status === 'completed') {
            // The run is complete and has messages, so we can display it
            // The AIResponseDisplay will handle finding the assistant message
         }
      }
   }, [currentConversation, continuationRunId]);

   // Create a synthetic element for the text input
   const continuationElement: Element = {
      id: 'continuation_input',
      name: 'continuation_input',
      type: 'text',
      label: 'Continue the conversation',
      description: 'Ask follow-up questions or request modifications to your results.',
      placeholder: 'e.g., "Make this shorter" or "Can you explain this further?"',
      isRequired: false,
      readOnly: false,
   };

   // Create synthetic answers object for the input
   const continuationAnswers: Answers = {
      continuation_input: {
         value: inputValue,
         otherValue: '',
         type: 'text'
      }
   };

   const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
      setInputValue(e.target.value);
   };

   const handleSubmit = async () => {
      if (!inputValue.trim() || !appId || !surveyJson || isLoading) {
         return;
      }

      setIsLoading(true);

      try {
         // Create the prompt for continuation
         const prompts: Prompt[] = [
            {
               id: `continuation-${Date.now()}`,
               name: 'continuation_message',
               type: 'prompt',
               text: inputValue,
            }
         ];

         // Send the prompt using existing infrastructure
         const response = await sendPromptsUtil({
            prompts,
            answers,
            appId,
            appConfig: surveyJson,
            pageIndex: -1, // Special index for continuation
            userId,
            requestSkip: false,
            skipScoredRun: true, // Skip scoring for continuation
         });

         if (response.success) {
            // Use the run ID returned by sendPromptsUtil
            if (response.runId) {
               setContinuationRunId(response.runId);
            }
            setInputValue(''); // Clear input after successful submission
         } else {
            toast.error('Failed to get response. Please try again.');
         }
      } catch (error) {
         console.error('Error in chat continuation:', error);
         toast.error('An error occurred. Please try again.');
      } finally {
         setIsLoading(false);
      }
   };

   const handleKeyPress = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
         e.preventDefault();
         handleSubmit();
      }
   };

   return (
      <div className="mt-6 space-y-4">
         <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="text-lg font-medium text-blue-900">
               Continue the Conversation
            </h3>
            <p className="text-sm text-blue-700 mt-1">
               Have additional questions or want to refine your results? Ask below.
            </p>
         </div>

         {/* Text Input using existing TextQuestion */}
         <div onKeyPress={handleKeyPress}>
            <TextQuestion
               element={continuationElement}
               answers={continuationAnswers}
               handleInputChange={handleInputChange}
               errors={[]}
               disabled={isLoading}
            />
         </div>

         {/* Submit Button */}
         <div className="flex justify-end">
            <button
               onClick={handleSubmit}
               disabled={!inputValue.trim() || isLoading}
               className="px-6 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
               {isLoading ? 'Sending...' : 'Send'}
            </button>
         </div>

         {/* AI Response Display using existing component */}
         {continuationRunId && currentConversation?.runs && (
            <div className="mt-6">
               {currentConversation.runs
                  .filter(run => run.id === continuationRunId && run.status === 'completed')
                  .map(run => (
                     <AIResponseDisplay 
                        key={run.id}
                        run={run} 
                        isOwner={isOwner} 
                        isAdmin={isAdmin} 
                     />
                  ))}
            </div>
         )}
      </div>
   );
};

export default ContinuationInterface; 