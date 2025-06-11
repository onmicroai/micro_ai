"use client";

import React, { ChangeEvent, useRef, useState } from "react";
import { Element, ErrorObject, Answers, ConditionalLogic } from "@/app/(authenticated)/app/types";
import evaluateVisibility from "@/utils//evaluateVisibility";
import { handleTextAreaDoubleClick } from "@/utils/inputHandlers";
import { parseFile } from "@/utils/parseFile";
import { Upload } from "lucide-react";
import { toast } from "react-toastify";
import { ParseFileError } from "@/utils/parseFile";

interface TextAreaQuestionProps {
   element: Element;
   answers: Answers;
   handleInputChange: (e: ChangeEvent<HTMLTextAreaElement>) => void;
   errors: ErrorObject[];
   disabled: boolean;
}

const TextAreaQuestion = ({
   element,
   answers,
   handleInputChange,
   errors = [],
   disabled,
}: TextAreaQuestionProps) => {
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

   /**
    * Automatically adjusts the textarea height based on content
    */
   const handleAutoHeight = (e: ChangeEvent<HTMLTextAreaElement>) => {
      e.target.style.height = 'auto';
      e.target.style.height = `${e.target.scrollHeight}px`;
      handleInputChange(e);
   };

   const onDoubleClick = (e: React.MouseEvent<HTMLTextAreaElement>) => {
      handleTextAreaDoubleClick({
         input: e.currentTarget,
         placeholder: element.placeholder,
         disabled,
         readOnly: element.readOnly,
         name: element.name,
         handleInputChange,
      });
   };

   /* ------------------------------------------------------------
    *  File-to-text logic
    * ----------------------------------------------------------*/
   const textareaRef = useRef<HTMLTextAreaElement>(null);
   const fileInputRef = useRef<HTMLInputElement>(null);
   const [isParsing, setIsParsing] = useState(false);
   const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

   const recalcHeight = () => {
      if (!textareaRef.current) return;
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
   };

   const appendText = (newText: string) => {
      const current = answers[element.name]?.value || "";
      const updated = current + newText;

      // Fire synthetic change so parent state updates
      const syntheticEvent = {
         target: { name: element.name, value: updated }
      } as unknown as ChangeEvent<HTMLTextAreaElement>;
      handleInputChange(syntheticEvent);

      // Also update the actual DOM value immediately for visual feedback
      if (textareaRef.current) {
         textareaRef.current.value = updated;
      }

      // Wait for React to paint, then recalc height
      requestAnimationFrame(recalcHeight);
   };

   const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      if (files.length === 0) return;

      setIsParsing(true);
      try {
         for (const file of files) {
            if (file.size > MAX_FILE_SIZE) {
               toast.error(`File "${file.name}" exceeds the 10 MB limit.`);
               continue;
            }

            const { text } = await parseFile(file);
            // Add leading blank lines only if there is already content
            const rawCurrent = answers[element.name]?.value;
            const currentStr = typeof rawCurrent === "string" ? rawCurrent : "";
            const hasContent = currentStr.trim().length > 0;
            const markdownHeader = `${hasContent ? "\n\n" : ""}## ${file.name}\n\n`;
            const addition = markdownHeader + text + "\n\n";

            const currentValue = (answers[element.name]?.value || "") as string;
            if (currentValue.length + addition.length > 20_000) {
               toast.error("Adding this file would exceed the 20,000 character limit. Skipping.");
               continue;
            }

            appendText(addition);
         }
      } catch (err) {
         console.error(err);
         if (err instanceof ParseFileError) {
            toast.error(err.message);
         } else {
            toast.error("Failed to parse file");
         }
      } finally {
         setIsParsing(false);
         // reset input so same file can be selected again later
         if (fileInputRef.current) fileInputRef.current.value = "";
      }
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
         
         <div className="relative">
         <textarea
            id={element.name}
            name={element.name}
            className={`
               block w-full mt-2 items-center rounded-md px-3 py-1.5 outline-1 -outline-offset-1 outline outline-gray-300 sm:text-sm/6
               ${hasError 
                  ? 'border-red-300 text-red-900 placeholder-red-300 focus:ring-red-500 focus:border-red-500' 
                  : 'outline-gray-300 placeholder:text-gray-500 focus:outline-2 focus:-outline-offset-2 focus:outline-primary-600'
               }
               ${disabled || element.readOnly ? 'bg-gray-50 text-gray-500' : 'bg-white'}
               transition duration-150 ease-in-out
               min-h-[100px] max-h-[500px] overflow-y-auto resize-none
            `}
            value={answers[element.name]?.value || ''}
            onChange={handleAutoHeight}
            onDoubleClick={onDoubleClick}
            placeholder={element.placeholder}
            disabled={disabled || element.readOnly}
            rows={1}
            ref={textareaRef}
         />

         {/* Hidden file input */}
         {!disabled && !element.readOnly && (
            <>
               <input
                  type="file"
                  multiple
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  className="hidden"
               />
               <button
                  type="button"
                  disabled={isParsing}
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute bottom-2 right-6 text-gray-400 hover:text-primary-600 focus:outline-none"
               >
                  {isParsing ? (
                     <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"></svg>
                  ) : (
                     <Upload className="h-4 w-4" />
                  )}
               </button>
            </>
         )}
         </div>
         
         {hasError && (
            <p className="mt-1 text-sm text-red-600">
               {errorMessage}
            </p>
         )}
      </div>
   );
};

export default TextAreaQuestion;
