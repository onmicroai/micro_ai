"use client";

import React, { ChangeEvent, useMemo, useState } from "react";
import {
  ErrorObject,
  Element,
  Answers,
  setInputValue,
  ConditionalLogic,
} from "@/app/(authenticated)/app/types";
import evaluateVisibility from "@/utils//evaluateVisibility";
import { Input } from "../basic/input";

interface RadioQuestionProps {
  element: Element;
  answers: Answers;
  setInputValue: setInputValue;
  errors: ErrorObject[];
  disabled: boolean;
  skipVisibilityCheck?: boolean;
}

const RadioQuestion = ({
  element,
  answers,
  setInputValue,
  errors = [],
  disabled,
  skipVisibilityCheck = false,
}: RadioQuestionProps) => {
  const [isOtherSelected, setIsOtherSelected] = useState(
    answers[element.name]?.value === "other"
  );
  const [otherValue, setOtherValue] = useState(
    answers[element.name]?.otherValue || ""
  );
  const otherLabel = element.otherText || "Other (describe)";
  const otherPlaceholder = element.otherPlaceholder || "Please specify";
  const noneLabel = element.noneText || "None";

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
  const questionText = element.text || element.label || element.name;

  /**
   * Handles the change event for the "Other" input.
   * @param event - The change event.
   */
  const handleOtherInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setOtherValue(value);
    setInputValue(element.name, "other", value, "radiogroup");
  };

  /**
   * Handles the change event for the radio buttons.
   * @param event - The change event.
   */
  const handleRadioChange = (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setIsOtherSelected(value === "other");
    setInputValue(element.name, value, otherValue, "radiogroup");
  };

  /**
   * Determines if a radio button should be checked.
   * @param answers - The answers object.
   * @param choiceValue - The value of the current choice.
   * @returns True if the radio button should be checked, false otherwise.
   */
  const isRadioChecked = (answers: Answers, choiceValue: string): boolean => {
    const answerValue = answers[element.name]?.value;
    return answerValue === choiceValue;
  };

  /**
   * Gets the radio options for a given question.
   * @param element - The question object.
   * @param noneLabel - The label for the "None" option.
   * @param otherLabel - The label for the "Other" option.
   * @returns The list of radio options.
   */
  const getRadioOptions = (
    element: Element,
    noneLabel: string,
    otherLabel: string
  ): { value: string; label: string }[] => {
    const radioOptions =
      element.choices?.map((choice) => {
        if (typeof choice === "string") {
          return { value: choice, label: choice };
        }
        return { value: choice.value, label: choice.text };
      }) || [];

    // Add None option if showNoneItem is true
    if (element.showNoneItem) {
      radioOptions.push({ value: "none", label: noneLabel });
    }

    // Add Other option if showOtherItem is true
    if (element.showOtherItem) {
      radioOptions.push({ value: "other", label: otherLabel });
    }

    return radioOptions;
  };

  const radioOptions = useMemo(
    () => getRadioOptions(element, noneLabel, otherLabel),
    [element, noneLabel, otherLabel]
  );
  const isVisible =
    skipVisibilityCheck ||
    evaluateVisibility(
      element.conditionalLogic || ({} as ConditionalLogic),
      answers
    );

  return (
    <div key={element.name} className={`${isVisible ? "" : "hidden"}`}>
      <label
        htmlFor={element.name}
        className="block text-sm/6 font-medium text-gray-900"
      >
        {questionText}
        {element.isRequired === true && (
          <span className="text-red-500 ml-1">*</span>
        )}
        {element.readOnly && (
          <span className="ml-2 text-sm text-gray-500 italic">(read-only)</span>
        )}
      </label>

      {element.description && (
        <p className="mt-1 text-sm/6 text-gray-600">{element.description}</p>
      )}

      <div
        className={`mt-2 space-y-2 ${
          hasError ? "text-red-900" : "text-gray-700"
        }`}
      >
        {radioOptions.map((choice, index) => (
          <div key={`${element.name}-${index}`} className="flex gap-3">
            <div className="flex h-6 shrink-0 items-center">
              <div key={index} className="group grid w-6 h-6 grid-cols-1">
                <input
                  type="radio"
                  id={`${element.name}-${index}`}
                  name={element.name}
                  value={choice.value}
                  onChange={handleRadioChange}
                  checked={isRadioChecked(answers, choice.value)}
                  disabled={disabled || element.readOnly}
                  className={`
                              relative size-4 appearance-none rounded-full border border-gray-300 bg-white before:absolute before:inset-1 before:rounded-full before:bg-white checked:border-primary checked:bg-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:border-gray-300 disabled:bg-gray-100 disabled:before:bg-white disabled:checked:border-primary-900 disabled:checked:bg-primary-900 disabled:checked:before:bg-white forced-colors:appearance-auto forced-colors:before:hidden [&:not(:checked)]:before:hidden
                              ${
                                hasError
                                  ? "border-red-300 text-red-600 focus:ring-red-500"
                                  : "border-gray-300 text-primary-600 focus:ring-primary-500"
                              }
                              ${
                                disabled || element.readOnly
                                  ? "cursor-default"
                                  : "cursor-pointer"
                              }
                              transition duration-150 ease-in-out
                           `}
                />
              </div>
            </div>
            <div className="text-sm/6">
              <label
                htmlFor={`${element.name}-${index}`}
                className={`
                           font-medium
                           ${
                             "text-gray-900"
                           }
                           ${hasError ? "text-red-900" : "text-gray-900"}
                           ${disabled || element.readOnly ? "cursor-default" : "cursor-pointer"}
                        `}
              >
                {choice.label}
              </label>
            </div>
          </div>
        ))}
      </div>

      {isOtherSelected && (
        <Input
          type="text"
          className={`mt-2`}
          value={otherValue}
          onChange={handleOtherInputChange}
          placeholder={otherPlaceholder}
          disabled={disabled}
          maxLength={150}
        />
      )}

      {hasError && <p className="mt-1 text-sm text-red-600">{errorMessage}</p>}
    </div>
  );
};

export default RadioQuestion;
