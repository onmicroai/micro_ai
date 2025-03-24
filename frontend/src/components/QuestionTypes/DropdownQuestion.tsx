"use client";

import React, { ChangeEvent, useState } from "react";
import Select from "react-select";
import { ErrorObject, Element, Answers, setInputValue, ConditionalLogic } from "@/app/(authenticated)/app/types";
import evaluateVisibility from "@/utils//evaluateVisibility";

interface DropdownQuestionProps {
   element: Element;
   answers: Answers;
   setInputValue: setInputValue;
   errors: ErrorObject[];
   disabled: boolean;
}

const DropdownQuestion = ({
   element,
   answers,
   setInputValue,
   errors = [],
   disabled,
}: DropdownQuestionProps) => {
   const otherPlaceholder = element.otherPlaceholder || "Please specify";
   const otherLabel = element.otherText || "Other";
   const noneLabel = element.noneText || "None";
   const [isOtherSelected, setIsOtherSelected] = useState(
      answers[element.name]?.value === "other"
   );
   const [otherValue, setOtherValue] = useState(answers[element.name]?.otherValue || "");

   /**
    * Extracts the error message for a given question.
    * @param questionName - The name of the question.
    * @returns The error message or null if no error exists.
    */
   const getErrorMessage = (elementName: string): string | null => {
      const error = errors.find((error) => error.element === elementName);
      return error ? error.error : null;
   };

   const errorMessage = getErrorMessage(element.name);
   const hasError = !!errorMessage;

   /**
    * Handles the change event for the other input field.
    * @param event - The change event.
    */
   const handleOtherInputChange = (event: ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;
      setOtherValue(value);
      setInputValue(element.name, "other", value, "dropdown");
   };

   /**
    * Gets the dropdown options for the question.
    * @returns The dropdown options.
    */
   const getDropdownOptions = (element: Element) => {
      const elementCopy = structuredClone(element);
      const { choices, showNoneItem, showOtherItem } = elementCopy;
      const options =
         choices?.map((choice) =>
            typeof choice === "string"
               ? { value: choice, label: choice }
               : { value: choice.text, label: choice.text }
         ) || [];

      if (showNoneItem) {
         options.push({ value: "none", label: noneLabel });
      }

      if (showOtherItem) {
         options.push({ value: "other", label: otherLabel });
      }

      return options;
   };

   const dropdownOptions = getDropdownOptions(element);
   const selectedOption =
      dropdownOptions.find((option) => option.value === answers[element.name]?.value) ||
      null;

   /**
    * Handles the change event for the dropdown.
    * @param selected - The selected option.
    */
   const handleDropdownChange = (selected: any) => {
      const value = selected ? selected.value : "";
      setIsOtherSelected(value === "other");
      setInputValue(element.name, value, otherValue, "dropdown");
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

         <Select
            id={element.name}
            name={element.name}
            className={`
               mt-2 text-sm/6 outline-gray-300 placeholder:text-gray-500 focus:outline-2 focus:-outline-offset-2 focus:outline-primary-600
               ${hasError ? 'select-error' : ''}
               ${disabled || element.readOnly ? 'select-disabled' : ''}
            `}
            classNamePrefix="react-select"
            styles={{
               control: (base, state) => ({
                  ...base,
                  minHeight: '3rem',
                  borderColor: hasError ? '#FCA5A5' : state.isFocused ? '#5b5df1' : '#D1D5DB',
                  boxShadow: state.isFocused ? (hasError ? '0 0 0 1px #EF4444' : '0 0 0 1px #5b5df1') : 'none',
                  '&:hover': {
                     borderColor: hasError ? '#FCA5A5' : '#d0d1fb'
                  },
                  backgroundColor: (disabled || element.readOnly) ? '#F9FAFB' : '#FFFFFF'
               }),
               placeholder: (base) => ({
                  ...base,
                  color: hasError ? '#FCA5A5' : '#6B7280'
               }),
               option: (base, state) => ({
                  ...base,
                  backgroundColor: state.isSelected 
                     ? '#5b5df1' 
                     : state.isFocused 
                        ? '#d0d1fb' 
                        : undefined,
                  '&:active': {
                     backgroundColor: '#d0d1fb'
                  }
               }),
               singleValue: (base) => ({
                  ...base,
                  color: hasError ? '#EF4444' : (disabled || element.readOnly) ? '#6B7280' : '#111827'
               })
            }}
            value={selectedOption}
            isDisabled={disabled || element.readOnly}
            onChange={handleDropdownChange}
            options={dropdownOptions}
            isClearable={true}
         />

         {isOtherSelected && (
            <input
               type="text"
               className={`
                  mt-2 w-full px-3 py-2 rounded-md border
                  ${hasError 
                     ? 'border-red-300 text-red-900 placeholder-red-300 focus:ring-red-500 focus:border-red-500' 
                     : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
                  }
                  ${disabled || element.readOnly ? 'bg-gray-50 text-gray-500' : 'bg-white'}
                  shadow-sm
                  focus:outline-none focus:ring-2
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

export default DropdownQuestion;
