"use client";

import React from "react";
import {
  ErrorObject,
  Element,
  Answers,
  setInputValue,
  ConditionalLogic,
} from "@/app/(authenticated)/app/types";
import evaluateVisibility from "@/utils//evaluateVisibility";

interface BooleanQuestionProps {
  element: Element;
  answers: Answers;
  setInputValue: setInputValue;
  errors: ErrorObject[];
  disabled: boolean;
  skipVisibilityCheck?: boolean;
}

const BooleanQuestion = ({
  element,
  answers,
  setInputValue,
  errors = [],
  disabled,
  skipVisibilityCheck = false,
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
  const questionText = element.text || element.label || element.name;

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
        className={`
            flex mt-2 items-center space-x-3
            ${disabled || element.readOnly ? "" : ""}
         `}
      >
        <button
          type="button"
          role="switch"
          aria-checked={isBooleanChecked()}
          aria-disabled={disabled || element.readOnly}
          tabIndex={disabled || element.readOnly ? -1 : 0}
          onClick={() =>
            !disabled &&
            !element.readOnly &&
            handleSwitchChange(!isBooleanChecked())
          }
          className={`
                  relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent
                  transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2
                  ${
                    disabled || element.readOnly
                      ? "cursor-default pointer-events-none focus:ring-0"
                      : "cursor-pointer"
                  }
                  ${
                    hasError
                      ? "focus:ring-red-500 bg-red-100"
                      : "focus:ring-primary"
                  }
                  ${
                    isBooleanChecked()
                      ? hasError
                        ? "bg-red-600"
                        : disabled || element.readOnly
                          ? "bg-primary-900"
                          : "bg-primary"
                      : disabled || element.readOnly
                        ? "bg-gray-100"
                        : "bg-gray-200"
                  }
               `}
        >
          <span
            className={`
                     pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow
                     transition duration-200 ease-in-out
                     ${isBooleanChecked() ? "translate-x-5" : "translate-x-0"}
                  `}
          />
        </button>
        <span className="mt-1 text-sm/6 text-gray-600">
          {isBooleanChecked()
            ? element.labelTrue || "Yes"
            : element.labelFalse || "No"}
        </span>
      </div>

      {hasError && (
        <p className="mt-1 text-sm/6 text-red-600">{errorMessage}</p>
      )}
    </div>
  );
};

export default BooleanQuestion;
