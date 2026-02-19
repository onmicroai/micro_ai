"use client";

import React, { ChangeEvent } from "react";
import {
  Element,
  ErrorObject,
  Answers,
  ConditionalLogic,
} from "@/app/(authenticated)/app/types";
import evaluateVisibility from "@/utils//evaluateVisibility";
import { handleInputDoubleClick } from "@/utils/inputHandlers";
import { Input } from "../basic/input";

//ppp
interface TextQuestionProps {
  element: Element;
  answers: Answers;
  handleInputChange: (e: ChangeEvent<HTMLInputElement>) => void;
  errors: ErrorObject[];
  disabled: boolean;
  skipVisibilityCheck?: boolean;
}

const TextQuestion = ({
  element,
  answers,
  handleInputChange,
  errors = [],
  disabled,
  skipVisibilityCheck = false,
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
  const questionText = element.text || element.label || element.name;

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

      <Input
        id={element.id}
        name={element.name}
        value={answers[element.name]?.value || ""}
        onChange={handleInputChange}
        onDoubleClick={onDoubleClick}
        placeholder={element.placeholder}
        disabled={disabled || element.readOnly}
      />

      {hasError && <p className="mt-1 text-sm text-red-600">{errorMessage}</p>}
    </div>
  );
};

export default TextQuestion;
