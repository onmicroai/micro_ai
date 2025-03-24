"use client";

import React, { ChangeEvent } from "react";
import { Element, ErrorObject, Answers, ConditionalLogic } from "@/app/(authenticated)/app/types";
import evaluateVisibility from "@/utils//evaluateVisibility";

interface TextAreaQuestionProps {
   element: Element;
   answers: Answers;
   handleInputChange: (e: ChangeEvent<HTMLTextAreaElement>) => void;
   errors: ErrorObject[];
   disabled: boolean;
}

const TextAreaQuestion = ({
   element,
   answers,
   handleInputChange,
   errors = [],
   disabled,
}: TextAreaQuestionProps) => {
   /**
    * Extracts the error message for a given question.
    * @param elementName - The name of the question.
    * @returns The error message or null if no error exists.
    */
   const getErrorMessage = (elementName: string): string | null => {
      const error = errors.find((error) => error.element === elementName);
      return error ? error.error : null;
   };

   const errorMessage = getErrorMessage(element.name);
   const hasError = !!errorMessage;

   /**
    * Automatically adjusts the textarea height based on content
    */
   const handleAutoHeight = (e: ChangeEvent<HTMLTextAreaElement>) => {
      e.target.style.height = 'auto';
      e.target.style.height = `${e.target.scrollHeight}px`;
      handleInputChange(e);
   };

   return (
      <div
         key={element.name}
         className={`mb-6 ${
            evaluateVisibility(element.conditionalLogic || {} as ConditionalLogic, answers)
               ? ''
               : 'hidden'
         }`}
      >
         <label
            htmlFor={element.name}
            className="block text-sm/6 font-medium text-gray-900"
         >
            {element.label || element.name}
            {element.isRequired === true && (
               <span className="text-red-500 ml-1">*</span>
            )}
            {element.readOnly && (
               <span className="ml-2 text-sm text-gray-500 italic">
                  (read-only)
               </span>
            )}
         </label>
         
         {element.description && (
            <p className="mt-1 text-sm/6 text-gray-600">
               {element.description}
            </p>
         )}
         
         <textarea
            id={element.name}
            name={element.name}
            className={`
               block w-full mt-2 items-center rounded-md px-3 py-1.5 outline-1 -outline-offset-1 outline outline-gray-300 sm:text-sm/6
               ${hasError 
                  ? 'border-red-300 text-red-900 placeholder-red-300 focus:ring-red-500 focus:border-red-500' 
                  : 'outline-gray-300 placeholder:text-gray-500 focus:outline-2 focus:-outline-offset-2 focus:outline-primary-600'
               }
               ${disabled || element.readOnly ? 'bg-gray-50 text-gray-500' : 'bg-white'}
               transition duration-150 ease-in-out
               min-h-[100px] overflow-hidden resize-none
            `}
            value={answers[element.name]?.value || ''}
            onChange={handleAutoHeight}
            placeholder={element.placeholder}
            disabled={disabled || element.readOnly}
            rows={1}
         />
         
         {hasError && (
            <p className="mt-1 text-sm text-red-600">
               {errorMessage}
            </p>
         )}
      </div>
   );
};

export default TextAreaQuestion;
