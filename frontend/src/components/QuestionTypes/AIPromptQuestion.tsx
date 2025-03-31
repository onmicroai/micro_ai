"use client";

import React from 'react';
import { useSurveyStore } from "@/store/runtimeSurveyStore";
import eyeIconOpen from "./icons/eye_open.svg";
import eyeIconClosed from "./icons/eye_close.svg";
import Image from "next/image";

interface AIPromptQuestionProps {
   promptType: string;
   prompt: {
      name: string;
      text: string;
   };
   disabled: boolean;
   onToggle: (isVisible: boolean) => void;
   isVisible: boolean;
}

const getPromptLabel = (key: string) => {
   switch (key) {
      case 'prompt':
         return 'AI Prompt';
      case 'aiInstructions':
         return 'AI Instructions';
      case 'fixedResponse':
         return 'Fixed Response';
      default:
         return 'Prompt';
   }
};

const AIPromptQuestion: React.FC<AIPromptQuestionProps> = ({
   promptType,
   prompt,
   disabled,
   onToggle,
   isVisible
}) => {
   const { isPromptEmpty } = useSurveyStore();
   const promptProperty = prompt.text;

   // Don't show the AI prompt if it's empty
   if (isPromptEmpty(promptProperty)) {
      return null;
   }
   
   return (
      <button
         onClick={(e) => {
            e.preventDefault();
            onToggle(!isVisible);
         }}
         type="button"
         tabIndex={-1}
         className={`
            inline-flex items-center text-xs
            ${disabled 
               ? 'text-gray-400 cursor-not-allowed' 
               : 'text-gray-400 hover:text-gray-600'
            }
            transition-colors duration-150 ease-in-out
         `}
      >
         <span className="mr-1">
            {isVisible ? "Hide" : "Show"} {getPromptLabel(promptType)}
         </span>
         {isVisible ? (
            <Image
               src={eyeIconClosed}
               alt="hide"
               className="w-3.5 h-3.5 text-gray-400"
            />
         ) : (
            <Image
               src={eyeIconOpen}
               alt="show"
               className="w-3.5 h-3.5 text-gray-400"
            />
         )}
      </button>
   );
};

export default AIPromptQuestion;
