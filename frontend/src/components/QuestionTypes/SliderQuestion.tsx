"use client";

import React, { ChangeEvent } from "react";
import { ErrorObject, Element, Answers, setInputValue, ConditionalLogic } from "@/app/(authenticated)/app/types";
import evaluateVisibility from "@/utils//evaluateVisibility";

interface SliderQuestionProps {
   element: Element;
   answers: Answers;
   setInputValue: setInputValue;
   errors: ErrorObject[];
   disabled: boolean;
}

const SliderQuestion = ({
   element,
   answers,
   setInputValue,
   errors = [],
   disabled,
}: SliderQuestionProps) => {
   const getErrorMessage = (elementName: string): string | null => {
      const error = errors.find((error) => error.element === elementName);
      return error ? error.error : null;
   };

   const errorMessage = getErrorMessage(element.name);
   const hasError = !!errorMessage;

   const handleSliderChange = (event: ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;
      setInputValue(element.name, value, "", "slider");
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

         <div className="flex items-center space-x-4">
            <div className="flex-1">
               <input
                  type="range"
                  id={element.name}
                  name={element.name}
                  min={element.minValue || 0}
                  max={element.maxValue || 100}
                  step={element.step || 1}
                  value={Number(answers[element.name]?.value || element.defaultValue || 0)}
                  onChange={handleSliderChange}
                  disabled={disabled || element.readOnly}
                  className={`
                     w-full h-2 rounded-lg appearance-none cursor-pointer
                     ${hasError 
                        ? 'bg-red-200' 
                        : disabled || element.readOnly 
                           ? 'bg-gray-200' 
                           : 'bg-primary-900'
                     }
                     ${disabled || element.readOnly ? 'cursor-not-allowed opacity-70' : ''}
                     accent-primary
                     focus:outline-none focus:ring-2 focus:ring-primary
                     transition duration-150 ease-in-out
                  `}
               />
            </div>
            <div className="w-12 text-center">
               <span className="inline-block px-2 py-1 text-sm bg-gray-100 rounded">
                  {answers[element.name]?.value || element.defaultValue || 0}
               </span>
            </div>
         </div>

         {hasError && (
            <p className="mt-1 text-sm text-red-600">
               {errorMessage}
            </p>
         )}
      </div>
   );
};

export default SliderQuestion; 