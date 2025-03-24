import { Element, ErrorObject, AnswerValue } from "@/app/(authenticated)/app/types";

export const validateForm = (elements: Element[] | null, answers: Record<string, any>): ErrorObject[] => {
   if (elements === null) {
      return [];
   }

   const errors: ErrorObject[] = [];

   elements.forEach((element) => {
      let error: string | null = null;
      const answerValue = answers[element.name];

      switch (element.type) {
         case "text":
         case "textarea":
            error = validateTextInput(element, answerValue);
            break;
         case "checkbox":
            error = validateCheckbox(element, answerValue);
            break;
         //TO-DO: Add slider validation and remove tagbox validation
         case "slider":
            error = validateSlider(element, answerValue);
            break;
         case "radio":
            error = validateRadio(element, answerValue);
            break;
         case "dropdown":
            error = validateDropdown(element, answerValue);
            break;
         case "boolean":
            error = validateBoolean(element, answerValue);
            break;
      }

      if (error) {
         errors.push({ element: element.name, error });
      }
   });

   return errors;
};

/**
 * Validates a text input question.
 * @param element - The question to validate.
 * @param value - The value of the question.
 * @returns The error message or null if no error exists.
 */
const validateTextInput = (element: Element, value: AnswerValue): string | null => {
   const answerValue = value?.value;
   
   // Required field validation
   if (element.isRequired) {
      const errorMessage = `${element.name} is required.`;
      
      if (typeof answerValue === 'string') {
         if (answerValue.trim() === '') {
            return errorMessage;
         }
      }

      if (answerValue === undefined) {
         return errorMessage;
      }
   }

   // Character length validation
   if (typeof answerValue === 'string' && answerValue.trim() !== '') {
      const length = answerValue.trim().length;
      
      if (element.minChars && length < element.minChars) {
         return `${element.name} must be at least ${element.minChars} characters.`;
      }
      
      if (element.maxChars && length > element.maxChars) {
         return `${element.name} must not exceed ${element.maxChars} characters.`;
      }
   }

   return null;
};

/**
 * Validates a checkbox question.
 * @param element - The question to validate.
 * @param selectedValues - The values of the question.
 * @returns The error message or null if no error exists.
 */
const validateCheckbox = (element: Element, selectedValues: AnswerValue): string | null => {
   if (element.isRequired) {
      const answerValue = selectedValues?.value;
      const isArray = Array.isArray(answerValue);
      const isEmptyArray = isArray && answerValue.length === 0;

      if (answerValue === undefined || isEmptyArray) {
         return `${element.name} is required.`;
      }

      const isNotEmpty = isArray && answerValue.length > 0;
      if (isNotEmpty) {
         const isOtherOptionChecked = answerValue.includes("other");
         if (isOtherOptionChecked) {
            const otherValue = selectedValues?.otherValue;
            const otherValueValid = otherValue !== undefined && otherValue.trim() !== '';
            if (otherValueValid === false) {
               return element.otherErrorText || `Response required: enter another value.`;
            }
         }
      }
   }
   return null;
};

/**
 * Validates a slider question.
 * @param element - The question to validate.
 * @param value - The value of the question.
 * @returns The error message or null if no error exists.
 */
const validateSlider = (element: Element, value: AnswerValue): string | null => {
    const answerValue = value?.value;

    // Required field validation
    if (element.isRequired) {
        if (answerValue === undefined || answerValue === null) {
            return `${element.name} is required.`;
        }
    }

    // If there's a value, validate it's within bounds
    if (answerValue !== undefined && answerValue !== null) {
        const numValue = Number(answerValue);
        
        // Validate it's a valid number
        if (isNaN(numValue)) {
            return `${element.name} must be a valid number.`;
        }

        // Validate min value if specified
        if (element.minValue !== undefined && numValue < element.minValue) {
            return `${element.name} must be at least ${element.minValue}.`;
        }

        // Validate max value if specified
        if (element.maxValue !== undefined && numValue > element.maxValue) {
            return `${element.name} must not exceed ${element.maxValue}.`;
        }
    }

    return null;
};

/**
 * Validates a radio question.
 * @param element - The question to validate.
 * @param value - The selected value of the question.
 * @returns The error message or null if no error exists.
 */
const validateRadio = (element: Element, value: AnswerValue): string | null => {
   const answerValue = value?.value;
   const otherValue = value?.otherValue;

   if (element.isRequired) {
      if (typeof answerValue === 'string') {
         if (answerValue.trim() === '') {
            return `${element.name} is required.`;
         }

         if (answerValue === 'other') {
            const otherValueValid = otherValue !== undefined && otherValue.trim() !== '';
            if (!otherValueValid) {
               return element.otherErrorText || `Response required: enter another value.`;
            }
         }
      } else if (answerValue === undefined) {
         return `${element.name} is required.`;
      }
   }
   return null;
};

/**
 * Validates a dropdown question.
 * @param element - The question to validate.
 * @param value - The selected value of the question.
 * @returns The error message or null if no error exists.
 */
const validateDropdown = (element: Element, value: AnswerValue): string | null => {
   const answerValue = value?.value;
   const otherValue = value?.otherValue;

   if (element.isRequired) {
      if (typeof answerValue === 'string') {
         const trimmedAnswerValue = answerValue.trim().toLowerCase();
         if (trimmedAnswerValue === '') {
            return `${element.name} is required.`;
         }

         if (trimmedAnswerValue === "other") {
            const otherValueValid = otherValue !== undefined && otherValue.trim() !== '';
            if (otherValueValid === false) {
               const errorMessage = element.otherErrorText || `Response required: enter another value.`;
               return errorMessage;
            }
         }
      }

      if (answerValue === undefined) {
         return `${element.name} is required.`;
      }
   }
   return null;
};

/**
 * Validates a boolean question.
 * @param element - The question to validate.
 * @param value - The value of the question.
 * @returns The error message or null if no error exists.
 */
const validateBoolean = (element: Element, value: { value: boolean | string }): string | null => {
   let answerValue = value?.value;
   
   if (typeof answerValue === 'string') {
      if (answerValue === 'true') {
         answerValue = true;
      } else if (answerValue === 'false') {
         answerValue = false;
      }
   }

   if (element.isRequired && typeof answerValue !== 'boolean') {
      return `${element.name} is required.`;
   }
   return null;
};
