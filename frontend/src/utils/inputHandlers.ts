import { ChangeEvent } from "react";

interface BaseDoubleClickHandlerProps {
   placeholder?: string;
   disabled?: boolean;
   readOnly?: boolean;
   name: string;
}

interface InputDoubleClickHandlerProps extends BaseDoubleClickHandlerProps {
   input: HTMLInputElement;
   handleInputChange: (e: ChangeEvent<HTMLInputElement>) => void;
}

interface TextAreaDoubleClickHandlerProps extends BaseDoubleClickHandlerProps {
   input: HTMLTextAreaElement;
   handleInputChange: (e: ChangeEvent<HTMLTextAreaElement>) => void;
}

/**
 * Handles double-click events on input fields to toggle between placeholder text and empty value
 */
export const handleInputDoubleClick = ({
   input,
   placeholder,
   disabled,
   readOnly,
   name,
   handleInputChange,
}: InputDoubleClickHandlerProps): void => {
   if (disabled || readOnly) return;

   const syntheticEvent = {
      target: {
         name,
         value: input.value === placeholder ? '' : (placeholder || '')
      }
   } as ChangeEvent<HTMLInputElement>;
   
   handleInputChange(syntheticEvent);
};

/**
 * Handles double-click events on textarea fields to toggle between placeholder text and empty value
 */
export const handleTextAreaDoubleClick = ({
   input,
   placeholder,
   disabled,
   readOnly,
   name,
   handleInputChange,
}: TextAreaDoubleClickHandlerProps): void => {
   if (disabled || readOnly) return;

   const syntheticEvent = {
      target: {
         name,
         value: input.value === placeholder ? '' : (placeholder || '')
      }
   } as ChangeEvent<HTMLTextAreaElement>;
   
   handleInputChange(syntheticEvent);
}; 