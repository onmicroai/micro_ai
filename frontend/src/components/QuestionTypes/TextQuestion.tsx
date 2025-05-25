"use client";

import React, { ChangeEvent } from "react";
import { Element, ErrorObject, Answers, ConditionalLogic } from "@/app/(authenticated)/app/types";
import evaluateVisibility from "@/utils//evaluateVisibility";
import { handleInputDoubleClick } from "@/utils/inputHandlers";

interface TextQuestionProps {
   element: Element;
   answers: Answers;
   handleInputChange: (e: ChangeEvent<HTMLInputElement>) => void;
   errors: ErrorObject[];
   disabled: boolean;
}

const TextQuestion = ({
   element,
   answers,
   handleInputChange,
   errors = [],
   disabled,
}: TextQuestionProps) => {
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

   const onDoubleClick = (e: React.MouseEvent<HTMLInputElement>) => {
      handleInputDoubleClick({
         input: e.currentTarget,
         placeholder: element.placeholder,
         disabled,
         readOnly: element.readOnly,
         name: element.name,
         handleInputChange,
      });
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
         
            <input
               id={element.id}
               name={element.name}
               className={`
                  block w-full mt-2 items-center rounded-md px-3 py-1.5 outline-1 -outline-offset-1 outline outline-gray-300 sm:text-sm/6
                  ${hasError 
                     ? 'outline-red-300 text-red-900 placeholder-red-300 focus:ring-red-500 focus:border-red-500' 
                     : 'outline-gray-300 placeholder:text-gray-500 focus:outline-2 focus:-outline-offset-2 focus:outline-primary-600'
                  }
                  ${disabled || element.readOnly ? 'bg-gray-50 text-gray-500' : 'bg-white'}
                  transition duration-150 ease-in-out
               `}
               value={answers[element.name]?.value || ''}
               onChange={handleInputChange}
               onDoubleClick={onDoubleClick}
               placeholder={element.placeholder}
               disabled={disabled || element.readOnly}
            />
         
         {hasError && (
            <p className="mt-1 text-sm text-red-600">
               {errorMessage}
            </p>
         )}
      </div>
   );
};

export default TextQuestion;
