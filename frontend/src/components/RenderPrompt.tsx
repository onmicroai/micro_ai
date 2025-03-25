"use client";
import React, { useState } from "react";
import { Prompt } from "@/app/(authenticated)/app/types";
import AIPromptQuestion from "./QuestionTypes/AIPromptQuestion";
import evaluateVisibility from "@/utils//evaluateVisibility";
import { ConditionalLogic } from "@/app/(authenticated)/app/types";
import groupPromptsByType from "@/utils//groupPromptsByType";
import injectValuesIntoPrompt from "@/utils//injectValuesIntoPrompt";

interface RenderPromptProps {
   prompts: Prompt[];
   answers: Record<string, any>;
   disabled: boolean;
   isOwner?: boolean;
   isAdmin?: boolean;
}

const RenderPrompt = ({
   prompts,
   answers,
   disabled,
   isOwner = false,
   isAdmin = false,
}: RenderPromptProps) => {
   const [visibilityState, setVisibilityState] = useState<Record<string, boolean>>({});

   // If not owner or admin, return null
   if (!isOwner && !isAdmin) {
      return null;
   }

   // Step 1: Filter prompts based on visibility conditions
   const visiblePrompts = prompts.filter(prompt => 
      evaluateVisibility(prompt.conditionalLogic || {} as ConditionalLogic, answers)
   );

   // Step 2: Group visible prompts by their type (prompt, aiInstructions, fixedResponse)
   const groupedPrompts = groupPromptsByType(visiblePrompts);


   // Step 3: Inject values into the prompts

   const processPromptGroup = (prompts: Prompt[] = []) => 
      injectValuesIntoPrompt(prompts, answers) as Prompt[];

   const renderTextarea = (type: string, prompts: Prompt[]) => {
      const combinedText = prompts
         .map(p => p.text)
         .filter(Boolean)
         .join('\n');

      if (!visibilityState[type]) return null;

      return (
         <div key={`textarea-${type}`} className="w-full mt-3">
            <textarea
               value={combinedText}
               readOnly
               disabled={disabled}
               className={`
               block w-full mt-2 items-center rounded-md px-3 py-1.5 outline-1 -outline-offset-1 outline outline-gray-300 sm:text-sm/6
               outline-gray-300 placeholder:text-gray-500 focus:outline-2 focus:-outline-offset-2 focus:outline-primary-600
               bg-gray-50 text-gray-500
               transition duration-150 ease-in-out
               min-h-[100px]
            `}
            />
         </div>
      );
   };

   const renderPromptGroup = (type: string, prompts: Prompt[]) => {
      const combinedText = prompts
         .map(p => p.text)
         .filter(Boolean)
         .join('\n');

      return (
         <AIPromptQuestion
            key={type}
            promptType={type}
            prompt={{
               name: type,
               text: combinedText,
            }}
            disabled={disabled}
            isVisible={visibilityState[type] || false}
            onToggle={(isVisible) => setVisibilityState(prev => ({ ...prev, [type]: isVisible }))}
         />
      );
   };

   return (
      <div className="relative -mt-5">
         <div className="flex justify-between items-center mb-2">
            {processPromptGroup(groupedPrompts['prompt']) && renderPromptGroup('prompt', processPromptGroup(groupedPrompts['prompt']))}
            {processPromptGroup(groupedPrompts['aiInstructions']) && renderPromptGroup('aiInstructions', processPromptGroup(groupedPrompts['aiInstructions']))}
            {processPromptGroup(groupedPrompts['fixedResponse']) && renderPromptGroup('fixedResponse', processPromptGroup(groupedPrompts['fixedResponse']))}
         </div>
         <div className="w-full">
            {processPromptGroup(groupedPrompts['prompt']) && renderTextarea('prompt', processPromptGroup(groupedPrompts['prompt']))}
            {processPromptGroup(groupedPrompts['aiInstructions']) && renderTextarea('aiInstructions', processPromptGroup(groupedPrompts['aiInstructions']))}
            {processPromptGroup(groupedPrompts['fixedResponse']) && renderTextarea('fixedResponse', processPromptGroup(groupedPrompts['fixedResponse']))}
         </div>
      </div>
   );
};

export default RenderPrompt;