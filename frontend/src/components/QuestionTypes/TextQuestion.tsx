"use client";

import React, { ChangeEvent } from "react";
import TextInput from "@/components/ui/TextInput";
import {
  Element,
  ErrorObject,
  Answers,
  ConditionalLogic,
} from "@/app/(authenticated)/app/types";
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
      className={`${
        evaluateVisibility(
          element.conditionalLogic || ({} as ConditionalLogic),
          answers
        )
          ? ""
          : "hidden"
      }`}
    >
      <TextInput
        id={element.id}
        name={element.name}
        label={element.label || element.name}
        required={element.isRequired === true}
        hint={element.description}
        error={errorMessage || undefined}
        value={answers[element.name]?.value || ""}
        onChange={handleInputChange}
        onDoubleClick={onDoubleClick}
        placeholder={element.placeholder}
        disabled={disabled}
        readOnly={element.readOnly}
      />
    </div>
  );
};

export default TextQuestion;
