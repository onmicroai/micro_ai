"use client";

import React, { ChangeEvent, useState, useEffect, useCallback } from "react";
import { ErrorObject, Element, Answers, setInputValue, ConditionalLogic } from "@/app/(authenticated)/app/types";
import evaluateVisibility from "@/utils//evaluateVisibility";

interface CheckboxQuestionProps {
   element: Element;
   answers: Answers;
   setInputValue: setInputValue;
   errors: ErrorObject[];
   disabled: boolean;
}

const CheckboxQuestion = ({
   element,
   answers,
   setInputValue,
   errors = [],
   disabled,
}: CheckboxQuestionProps) => {
   const [isOtherSelected, setIsOtherSelected] = useState(
      answers[element.name]?.value?.includes("other") || false
   );
   const [otherValue, setOtherValue] = useState(answers[element.name]?.otherValue || "");
   const [isNoneSelected, setIsNoneSelected] = useState(
      answers[element.name]?.value?.includes("none") || false
   );
   const selectedAnswers = answers[element.name]?.value || [];
   const [errorMessage, setErrorMessage] = useState<string | null>(null);
   const hasError = !!errorMessage;
   const otherPlaceholder = element.otherPlaceholder || "Other (describe)";
   const otherLabel = element.otherText || "Other";
   const noneText = element.noneText || "None";
   const [checkboxOptions, setCheckboxOptions] = useState<{ value: string; label: string }[]>([]);

   /**
    * Extracts the error message for a given question.
    * @param elementName - The name of the question.
    * @returns The error message or null if no error exists.
    */
   const getErrorMessage = useCallback((elementName: string): string | null => {
      const error = errors.find((error) => error.element === elementName);
      return error ? error.error : null;
   }, [errors]);

   /**
    * Handles the change event for the "Other" input.
    * @param event - The change event.
    */
   const handleOtherInputChange = (event: ChangeEvent<HTMLInputElement>) => {
      setOtherValue(event.target.value);
      const currentValues = answers[element.name]?.value || [];
      setInputValue(element.name, currentValues, event.target.value, "checkbox");
   };

   /**
    * Gets the checkbox options for a given question.
    * @param question - The question.
    * @returns The checkbox options.
    */
   const getCheckboxOptions = useCallback((question: Element) => {
      const clonedQuestion = structuredClone(question);
      const baseOptions = clonedQuestion.choices?.map((choice) => {
         if (typeof choice === "string") {
            return { value: choice, label: choice };
         }
         return { value: choice.text, label: choice.text };
      }) || [];

      if (question.showNoneItem) {
         baseOptions.push({ value: "none", label: noneText });
      }

      if (question.showOtherItem) {
         baseOptions.push({ value: "other", label: otherLabel });
      }

      return baseOptions;
   }, [noneText, otherLabel]);

   /**
    * Handles the change event for the checkbox.
    * @param event - The change event.
    */
   const handleCheckboxChange = (event: ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;
      let updatedAnswers = [...(selectedAnswers as string[])];

      if (event.target.checked) {
         if (value === "none") {
            // If "None" is selected, clear all other selections
            updatedAnswers = ["none"];
            setIsNoneSelected(true);
         } else {
            // If any other option is selected, remove "None" if it was previously selected
            updatedAnswers = updatedAnswers.filter(answer => answer !== "none");
            updatedAnswers.push(value);
            setIsNoneSelected(false);
         }
      } else {
         updatedAnswers = updatedAnswers.filter((answer) => answer !== value);
      }

      if (value === "other") {
         setIsOtherSelected(event.target.checked);
      }

      setInputValue(element.name, updatedAnswers, otherValue, "checkbox");
   };

   /**
    * Determines if a checkbox should be checked.
    * @param choiceValue - The value of the current choice.
    * @returns True if the checkbox should be checked, false otherwise.
    */
   const isCheckboxChecked = (choiceValue: string): boolean => {
      return selectedAnswers.includes(choiceValue);
   };

   useEffect(() => {
      setCheckboxOptions(getCheckboxOptions(element));
   }, [element, getCheckboxOptions]);

   useEffect(() => {
      setErrorMessage(getErrorMessage(element.name));
   }, [errors, element.name, getErrorMessage]);

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

         <div className={`mt-2 space-y-2 ${hasError ? 'text-red-900' : 'text-gray-700'}`}>
         <div className="space-y-6">
            {checkboxOptions.map((choice, index) => (
                <div key={`${element.name}-${index}`} className="flex gap-3">
                  <div className="flex h-6 shrink-0 items-center">
                     <div key={index} className="group grid w-6 h-6 grid-cols-1">
                        <input
                           type="checkbox"
                           id={`${element.name}-${index}`}
                           name={element.name}
                           value={choice.value}
                           checked={isCheckboxChecked(choice.value)}
                           onChange={handleCheckboxChange}
                           disabled={disabled || element.readOnly}
                           className={`
                              col-start-1 row-start-1 appearance-none rounded border bg-white checked:border-indigo-600 checked:bg-indigo-600 indeterminate:border-indigo-600 indeterminate:bg-indigo-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:border-gray-300 disabled:bg-gray-100 disabled:checked:bg-gray-100 forced-colors:appearance-auto
                              ${hasError 
                                 ? 'border-red-300 text-red-600 focus:ring-red-500' 
                                 : 'border-gray-300'
                              }
                              ${disabled || element.readOnly ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                              transition duration-150 ease-in-out
                           `}
                        />
                        <svg
                              fill="none"
                              viewBox="0 0 14 14"
                              className="pointer-events-none col-start-1 row-start-1 size-3.5 self-center justify-self-center stroke-white group-has-[:disabled]:stroke-gray-950/25"
                        >
                        <path
                          d="M3 8L6 11L11 3.5"
                          strokeWidth={2}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="opacity-0 group-has-[:checked]:opacity-100"
                        />
                        <path
                          d="M3 7H11"
                          strokeWidth={2}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="opacity-0 group-has-[:indeterminate]:opacity-100"
                        />
                      </svg>
                     </div>
                  </div>
                  <div className="text-sm/6">
                     <label
                        htmlFor={`${element.name}-${index}`}
                        className={`
                           font-medium
                           ${disabled || element.readOnly ? 'text-gray-500' : 'text-gray-900'}
                           ${hasError ? 'text-red-900' : 'text-gray-900'}
                           cursor-pointer
                        `}
                     >
                        {choice.label}
                     </label>
                  </div>
               </div>
            ))}
         </div>
         </div>

         {isOtherSelected && !isNoneSelected && (
            <input
               type="text"
               className={`
                  block w-full mt-2 items-center rounded-md px-3 py-1.5 outline-1 -outline-offset-1 outline outline-gray-300 sm:text-sm/6
                  ${hasError 
                     ? 'outline-red-300 text-red-900 placeholder-red-300 focus:ring-red-500 focus:border-red-500' 
                     : 'outline-gray-300 placeholder:text-gray-500 focus:outline-2 focus:-outline-offset-2 focus:outline-primary-600'
                  }
                  ${disabled || element.readOnly ? 'bg-gray-50 text-gray-500' : 'bg-white'}
                  transition duration-150 ease-in-out
               `}
               value={otherValue}
               onChange={handleOtherInputChange}
               placeholder={otherPlaceholder}
               disabled={disabled || element.readOnly}
               maxLength={150}
            />
         )}

         {hasError && (
            <p className="mt-1 text-sm text-red-600">
               {errorMessage}
            </p>
         )}
      </div>
   );
};

export default CheckboxQuestion;
