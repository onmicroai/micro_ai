import { Answers, Prompt } from "@/app/(authenticated)/app/types";

/**
 * Injects values into the AI prompt property.
 * @param aiPromptProperty - The AI prompt property.
 * @param answers - The answers state.
 * @returns The AI prompt property with the values injected.
 */
const injectValuesIntoPrompt = (
   aiPromptProperty: string | Prompt[],
   answers: Answers,
): string | Prompt[] => {
   const placeholderRegex = /\{(\w+)\}/g;
   
   // Handle array input
   if (Array.isArray(aiPromptProperty)) {
      return aiPromptProperty.map(prompt => ({
         ...prompt,
         text: prompt.text ? processPromptText(prompt.text, answers, placeholderRegex) : ""
      }));
   }
   
   // Handle string input (existing logic)
   const isEmptyPrompt = aiPromptProperty === undefined || aiPromptProperty === "";
   const isEmptyAnswers = answers === undefined || answers === null || Array.isArray(answers) && answers.length === 0;
   if (isEmptyPrompt || isEmptyAnswers) {
      return "";
   }
   
   return processPromptText(aiPromptProperty, answers, placeholderRegex);
};

// Helper function to process individual prompt text
const processPromptText = (
   promptText: string,
   answers: Answers,
   placeholderRegex: RegExp
): string => {
   const plainText = htmlToPlainText(promptText);
   return plainText.replace(placeholderRegex, (_, key) => {
      const answer = answers[key];
      const otherValue = answer?.otherValue || "";
      const value = answer?.value;
      const isOtherExists = isOtherValue(value);
      let valueString: string | undefined;

      if (Array.isArray(value)) {
         const notOtherValues = value.filter(val => val !== 'other');
         if (notOtherValues.length > 0) { 
            valueString = notOtherValues.join(', ');
         }
      } else {
         const notOtherValue = typeof value === "string" && value !== "" && value !== "other";
         if (notOtherValue) {
            valueString = value;
         }
      } 

      if (valueString !== undefined && isOtherExists) {
         return `${valueString}, ${String(otherValue)}`;
      } 
      
      if (valueString !== undefined) {
         return valueString;
      } 
      
      if (isOtherExists) {
         return String(otherValue);
      }

      return `{${key}}`;
   });
};

/**
 * Checks if the value is an "other" value.
 * @param values - The values to check.
 * @returns True if the value is an "other" value, false otherwise.
 */
const isOtherValue = (values: string[] | string) => {
   if (Array.isArray(values)) {
      return values.includes('other');
   }
   return values === 'other';
}

/**
 * Converts HTML content to clean plain text with proper spaces and new lines.
 * This is a standalone utility function that doesn't modify any state.
 * 
 * @param html - The HTML content to convert
 * @returns Plain text with proper spaces and new lines
 */
export const htmlToPlainText = (html: string): string => {
  if (!html) return "";
  
  // Handle case when html is already plain text
  if (!html.includes("<")) return html;
  
  // Create a temporary DOM element
  const tempElement = document.createElement("div");
  tempElement.innerHTML = html;
  
  // Replace <br> elements with newline characters
  const brElements = tempElement.querySelectorAll("br");
  brElements.forEach(br => {
    br.parentNode?.replaceChild(document.createTextNode("\n"), br);
  });
  
  // Replace <div> elements with their content followed by newline characters
  // We need to work with a static array since we're modifying the DOM
  const divElements = Array.from(tempElement.querySelectorAll("div"));
  divElements.forEach((div, index) => {
    // Skip the first div to avoid leading newline
    if (index > 0) {
      // Insert a newline before this div
      div.parentNode?.insertBefore(document.createTextNode("\n"), div);
    }
    
    // If this is an empty div, add a newline
    if (!div.textContent?.trim()) {
      div.appendChild(document.createTextNode("\n"));
    }
    
    // Replace the div with its contents
    while (div.firstChild) {
      div.parentNode?.insertBefore(div.firstChild, div);
    }
    div.parentNode?.removeChild(div);
  });
  
  // Get the text content
  let text = tempElement.textContent || "";
  
  // Replace non-breaking spaces with regular spaces
  text = text.replace(/\u00A0/g, " ");
  
  // Remove any zero-width spaces
  text = text.replace(/\u200B/g, "");
  
  // Normalize line breaks (no more than 2 consecutive line breaks)
  text = text.replace(/\n{3,}/g, "\n\n");
  
  // Trim leading/trailing whitespace
  text = text.trim();
  
  return text;
};

export default injectValuesIntoPrompt;