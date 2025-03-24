"use client";

import React from "react";
import { ErrorObject, Element, Answers, setInputValue, ConditionalLogic } from "@/app/(authenticated)/app/types";
import evaluateVisibility from "@/utils//evaluateVisibility";


interface BooleanQuestionProps {
   element: Element;
   answers: Answers;
   setInputValue: setInputValue;
   errors: ErrorObject[];
   disabled: boolean;
}

const BooleanQuestion = ({
   element,
   answers,
   setInputValue,
   errors = [],
   disabled,
}: BooleanQuestionProps) => {

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
    * Determines if a boolean question should be checked.
    * @returns True if the boolean question should be checked, false otherwise.
    */
   const isBooleanChecked = (): boolean => {
      const answer = answers[element.name];
      const value = answer?.value === "true";
      
      if (element.swapOrder) {
         return !value;
      }

      return value;
   };

   /**
    * Handles the change event for the Switch component.
    * @param checked - The new checked state of the switch.
    */
   const handleSwitchChange = (checked: boolean) => {
      let value = checked.toString();
      
      if (element.swapOrder) {
         value = checked ? "false" : "true";
      }
      
      setInputValue(element.name, value, "", "boolean");
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

         <div className={`
            flex mt-2 items-center space-x-3
            ${disabled || element.readOnly ? 'opacity-60' : ''}
         `}>
            <button
               type="button"
               role="switch"
               aria-checked={isBooleanChecked()}
               onClick={() => !disabled && !element.readOnly && handleSwitchChange(!isBooleanChecked())}
               className={`
                  relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent
                  transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2
                  ${hasError 
                     ? 'focus:ring-red-500 bg-red-100' 
                     : 'focus:ring-primary'
                  }
                  ${isBooleanChecked() 
                     ? hasError ? 'bg-red-600' : 'bg-primary' 
                     : 'bg-gray-200'
                  }
                  ${disabled || element.readOnly ? 'cursor-not-allowed' : ''}
               `}
            >
               <span
                  className={`
                     pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow
                     transition duration-200 ease-in-out
                     ${isBooleanChecked() ? 'translate-x-5' : 'translate-x-0'}
                  `}
               />
            </button>
            <span className="mt-1 text-sm/6 text-gray-600">
               {isBooleanChecked() 
                  ? (element.labelTrue || 'Yes')
                  : (element.labelFalse || 'No')
               }
            </span>
         </div>

         {hasError && (
            <p className="mt-1 text-sm/6 text-red-600">
               {errorMessage}
            </p>
         )}
      </div>
   );
};

export default BooleanQuestion;
