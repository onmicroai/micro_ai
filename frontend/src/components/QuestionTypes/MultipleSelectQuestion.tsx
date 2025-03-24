"use client";

import React, { ChangeEvent, useState } from "react";
import Select from "react-select";
import { ErrorObject, Element, Answers, setInputValue, ConditionalLogic } from "@/app/(authenticated)/app/types";
import evaluateVisibility from "@/utils//evaluateVisibility";

interface MultipleSelectQuestionProps {
   element: Element;
   answers: Answers;
   setInputValue: setInputValue;
   errors: ErrorObject[];
   disabled: boolean;
}

const MultipleSelectQuestion: React.FC<MultipleSelectQuestionProps> = ({
   element,
   answers,
   setInputValue,
   errors = [],
   disabled,
}) => {
   const [isOtherSelected, setIsOtherSelected] = useState(
      answers[element.name]?.value?.includes("other") || false
   );
   const [otherValue, setOtherValue] = useState(answers[element.name]?.otherValue || "");
   const [isNoneSelected, setIsNoneSelected] = useState(
      answers[element.name]?.value?.includes("none") || false
   );

   /**
    * Extracts the error message for a given question.
    * @param questionName - The name of the question.
    * @returns The error message or null if no error exists.
    */
   const getErrorMessage = (questionName: string): string | null => {
      const error = errors.find((error) => error.element === questionName);
      return error ? error.error : null;
   };

   const errorMessage = getErrorMessage(element.name);
   const hasError = !!errorMessage;

   /**
    * Handles the change event for the other input.
    * @param event - The change event.
    */
   const handleOtherInputChange = (event: ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;
      setOtherValue(value);
      const currentValues = answers[element.name]?.value || [];
      setInputValue(element.name, currentValues, value, "tagbox");
   };
    /**
    * Handles the change event for the Select component.
    * @param selected - The selected options from the Select component.
    */
    const handleSelectChange = (selected: readonly { value: string; label: string }[]) => {
      const values = selected.map((s) => s.value);
      setIsOtherSelected(values.includes("other"));

      let finalValues: string[];
      const lastValue = values[values.length - 1];
      if (lastValue === "none") {
         finalValues = ["none"];
         setIsNoneSelected(true);
      } else {
         finalValues = values.filter(value => value !== "none");
         setIsNoneSelected(false);
      }

      setInputValue(element.name, finalValues, otherValue, "tagbox");
   };

   const otherPlaceholder = element.otherPlaceholder || "Please specify";
   const otherLabel = element.otherText || "Other";
   const noneLabel = element.noneText || "None";
   const options = [
      ...(element.choices?.map((choice) =>
         typeof choice === "string"
            ? { value: choice, label: choice }
            : { value: choice.text, label: choice.text }
      ) || []),
      ...(element.showNoneItem ? [{ value: "none", label: noneLabel }] : []),
      ...(element.showOtherItem ? [{ value: "other", label: otherLabel }] : [])
   ];

   /**
    * Gets the selected options for a given question.
    * @param questionName - The name of the question.
    * @returns The selected options.
    */
   const getSelectedOptions = (options: { value: string; label: string }[], questionName: string): { value: string; label: string }[] => {
      const selectedValues = answers[questionName]?.value || [];
      if (typeof selectedValues === "string") {
         const selectedOption = options.find(option => option.value === selectedValues);
         return [{ value: selectedValues, label: selectedOption?.label || selectedValues }];
      }
      return selectedValues.map((value) => {
         const selectedOption = options.find(option => option.value === value);
         return { 
            value, 
            label: selectedOption?.label || value 
         };
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

         <Select
            id={element.name}
            name={element.name}
            className={`
               ${hasError ? 'select-error' : ''}
               ${disabled || element.readOnly ? 'select-disabled' : ''}
            `}
            classNamePrefix="react-select"
            styles={{
               control: (base, state) => ({
                  ...base,
                  minHeight: '3rem',
                  borderColor: hasError ? '#FCA5A5' : state.isFocused ? '#3B82F6' : '#D1D5DB',
                  boxShadow: state.isFocused ? (hasError ? '0 0 0 1px #EF4444' : '0 0 0 1px #3B82F6') : 'none',
                  '&:hover': {
                     borderColor: hasError ? '#FCA5A5' : '#3B82F6'
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
                     ? '#3B82F6' 
                     : state.isFocused 
                        ? '#DBEAFE' 
                        : undefined,
                  '&:active': {
                     backgroundColor: '#BFDBFE'
                  }
               })
            }}
            value={getSelectedOptions(options, element.name)}
            isDisabled={disabled || element.readOnly}
            onChange={handleSelectChange}
            options={options}
            isMulti
            isClearable={true}
         />

         {isOtherSelected && !isNoneSelected && (
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

export default MultipleSelectQuestion;
