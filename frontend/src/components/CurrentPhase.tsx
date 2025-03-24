"use client";

import { useState, useEffect, FormEvent} from "react";
import RenderQuestion from "./RenderQuestion";
import RenderPrompt from "./RenderPrompt";
import evaluateVisibility from "@/utils//evaluateVisibility";
import injectValuesIntoPrompt from "@/utils//injectValuesIntoPrompt";
import { useSurveyStore } from '../store/runtimeSurveyStore';
import { validateForm } from "@/utils//validateForms";
import { Answers, ConditionalLogic, SendPromptResponse } from "../app/(authenticated)/app/types";
import { Prompt, Element } from '../app/(authenticated)/app/types';
import {
   AIResponseDisplay,
   RunScoreDisplay,
   passedTheRubricMinScore,
} from '@/utils/phaseResultDisplay';
import { useConversationStore } from '@/store/conversationStore';
import SkeletonLoader from "@/components/layout/loading/skeletonLoader";

interface CurrentPhaseProps {
   appId: number;
   userId: number | null;
   answers: Answers;
   isOwner?: boolean;
   isAdmin?: boolean;
}

const CurrentPhase: React.FC<CurrentPhaseProps> = ({ appId, userId, answers, isOwner = false, isAdmin = false }) => {
   const [formAction, setFormAction] = useState<'submit' | 'skip' | 'noSubmit'>('submit');
   const {
      currentPhase,
      elements,
      errors,
      surveyJson,
      currentPhaseIndex,
      completedPhases,
      promptLoading,
      setImages,
      setCompletedPhases,
      setCurrentPhaseIndex,
      setCurrentPhase,
      setElements,
      setErrors,
      setInputValue,
      handleInputChange,
      setPrompt,
      setAiInstructions,
      sendPrompts
   } = useSurveyStore();

   const { currentConversation } = useConversationStore();

   useEffect(() => {
      if (currentPhase?.prompts) {
         const combinedPrompts = currentPhase.prompts
            .filter((prompt: Prompt) => prompt.type === 'prompt')
            .map((prompt: Prompt) => 
               injectValuesIntoPrompt(
                  prompt.text,
                  answers
               )
            )
            .join("\n");

         setPrompt(combinedPrompts);

         const combinedAiInstructions = currentPhase.prompts
            .filter((prompt: Prompt) => prompt.type === 'aiInstructions')
            .map((prompt: Prompt) => 
               injectValuesIntoPrompt(
                  prompt.text,
                  answers
               )
            )
            .join("\n");

         setAiInstructions(combinedAiInstructions);
      }
   }, [answers, currentPhase, setPrompt, setAiInstructions]);

   useEffect(() => {
      // Initialize default values only when the phase loads
      if (currentPhase?.elements) {
         currentPhase.elements.forEach((element: Element) => {
            // Skip if answer already exists
            if (answers[element.name]?.value !== undefined) {
               return;
            }

            if ('defaultValue' in element && element.defaultValue !== undefined) {
               if (element.type === 'checkbox') {
                  // Handle checkbox arrays
                  if (Array.isArray(element.defaultValue)) {
                     // Start with an empty array
                     let updatedAnswers: string[] = [];

                     element.defaultValue.forEach(value => {
                        // If "none" is selected, clear everything else
                        if (value === "none") {
                           updatedAnswers = ["none"];
                           return;
                        }

                        // Find the corresponding choice text
                        const choice = element.choices?.find(c => 
                           typeof c === 'string' ? c === value : c.value === value
                        );
                        const choiceText = typeof choice === 'string' ? choice : choice?.text || value;

                        // Add to answers array (excluding "none" if present)
                        updatedAnswers = updatedAnswers.filter(a => a !== "none");
                        updatedAnswers.push(choiceText);
                     });

                     setInputValue(element.name, updatedAnswers, "", "checkbox");
                  }
               } 
               else if (element.type === 'radio') {
                  // Find the corresponding choice text
                  const choice = element.choices?.find(c => 
                     typeof c === 'string' ? c === element.defaultValue : c.value === element.defaultValue
                  );
                  const mappedValue = typeof choice === 'string' ? choice : choice?.text || element.defaultValue;
                  
                  setInputValue(
                     element.name,
                     String(mappedValue), // Convert to string to fix type error
                     "",  // otherValue
                     "radiogroup"
                  );
               }
               else {
                  // Handle all other input types (text, number, slider, etc.)
                  setInputValue(
                     element.name,
                     element.defaultValue.toString(),
                     "",
                     element.type
                  );
               }
            }
         });
      }
   }, [currentPhase, setInputValue, answers]);

   /**
    * Checks if the current phase is an informational phase.
    * @returns {boolean} - True if the phase is informational, false otherwise.
    */
   const isInformationalPhase = () => {
      const promptsNumber = currentPhase?.prompts?.length;
      return promptsNumber === undefined || promptsNumber === 0;
   }

   /**
    * Handles the form submission.
    * @param event - The form event.
    */
   const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
      // Prevents the default form submission behavior which would refresh the page
      event.preventDefault();
      let AIResponse: SendPromptResponse = {success: false, run_passed: false};

      if (formAction === 'submit') {
         const newErrors = validateForm(elements, answers); 

         if (newErrors.length > 0) {
            setErrors(newErrors);
            return;
         }

         AIResponse = await sendPrompts(currentPhase?.prompts || null, answers, appId, surveyJson, currentPhaseIndex, userId, false);
      }

      if (formAction === 'skip') {
         AIResponse = await sendPrompts(null, answers, appId, surveyJson, currentPhaseIndex, userId, true);
      }

      if (formAction === 'noSubmit') {
         AIResponse = await sendPrompts(null, answers, appId, surveyJson, currentPhaseIndex, userId, false, true);
      }

      if (AIResponse.run_passed === false) {
         return;
      }


      setCompletedPhases([...completedPhases, currentPhaseIndex]);

      // Common logic for both submit and skip
      if (currentPhaseIndex < surveyJson!.phases.length - 1) {
         setCurrentPhaseIndex(currentPhaseIndex + 1);
      } else {
         setCurrentPhase(null);
         setElements(null);
      }
   };

   if (currentPhase === null) {
      return null;
   }

   return (
      <div>
         <form onSubmit={handleSubmit} className="space-y-6">
            {currentPhase.title && currentPhase.title.length > 0 && (
               <div>
                  <h2 className="text-base/7 font-semibold text-gray-900">{currentPhase.title}</h2>
                  <p className="mt-1 text-sm/6 text-gray-600">{currentPhase.description}</p>
               </div>
            )}
            {currentPhase.elements?.map((element: Element) => (
               <RenderQuestion
                  key={element.name}
                  errors={errors}
                  element={{
                     ...element,
                     isRequired: element.isRequired,
                     conditionalLogic: element.conditionalLogic,
                     type: element.type,
                  }} 
                  answers={answers}
                  disabled={false}
                  handleInputChange={handleInputChange}
                  setInputValue={setInputValue}
                  setImages={setImages}
                  visible={evaluateVisibility(
                     element.conditionalLogic || {} as ConditionalLogic,
                     answers
                  )}
                  appId={appId}
                  userId={userId}
                  surveyJson={surveyJson}
                  currentPhaseIndex={currentPhaseIndex}
               />
            ))}
            {currentPhase.prompts && (
               <div className="space-y-0">
                  <RenderPrompt
                     key="prompts"   
                     prompts={currentPhase.prompts}
                     answers={answers}
                     disabled={false}
                     isOwner={isOwner}
                     isAdmin={isAdmin}
                  />
               </div>
            )}

            {(() => {
               if (!currentConversation?.runs?.length) return null;
               // Get the most recent run for the current phase
               const currentRun = currentConversation.runs
                  .filter(run => run.phaseIndex === currentPhaseIndex)
                  .sort((a, b) => b.createdAt - a.createdAt)[0];
               
               if (!currentRun) return null;

               // Check if the current phase has a chat element
               const hasChatElement = currentPhase.elements?.some(
                  (element: Element) => element.type === 'chat'
               );
               
               return (
                  <>
                     {/* Only show AIResponseDisplay if there's no chat element */}
                     {!hasChatElement && <AIResponseDisplay run={currentRun} isOwner={isOwner} isAdmin={isAdmin} />}
                     <RunScoreDisplay run={currentRun} />
                     {!promptLoading && !passedTheRubricMinScore(currentRun) && (
                        <div className="mt-6 border rounded-lg p-4 bg-red-50">
                           <p className="text-sm/6 text-red-700">Did not pass the Minimum Score. Please try again.</p>
                        </div>
                     )}
                  </>
               );
            })()}

            <input type="hidden" name="formAction" value={formAction} />
            {surveyJson?.phases?.length !== completedPhases.length &&
               currentPhase.elements && currentPhase.elements.length > 0 && (
                  promptLoading ? (
                     <div className="mt-8 pt-4">
                        <SkeletonLoader />
                     </div>
                  ) : (
                     <div className="flex justify-between items-center mt-8 pt-4 border-t">
                        <div>
                           <button
                              type="submit"
                              className="px-6 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                              onClick={() => setFormAction(
                                 isInformationalPhase() ? 'noSubmit' : 'submit'
                              )}
                           >
                              {isInformationalPhase() ? "Continue" : "Submit"}
                           </button>
                        </div>
                        <div>
                           {currentPhase?.skipPhase && (
                              <button
                                 type="submit"
                                 className="px-6 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                                 onClick={() => setFormAction('skip')}
                              >
                                 Skip Phase
                              </button>
                           )}
                        </div>
                     </div>
                  )
               )}
         </form>
      </div>
   );
};

export default CurrentPhase;
