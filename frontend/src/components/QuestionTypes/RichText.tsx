"use client";

import React from "react";
import "./richText.scss";
import { Element, ErrorObject, Answers } from "@/app/(authenticated)/app/types";

interface RichTextQuestionProps {
   element: Element;
   answers: Answers;
   errors: ErrorObject[];
   disabled: boolean;
}

const RichTextQuestion = ({
   element,
   disabled,
}: RichTextQuestionProps) => {
   return (
      <div
         key={element.name}
         className={`mb-6 ${disabled ? 'opacity-75' : ''}`}
      >
         {element.label && (
            <label className="block text-sm/6 font-medium text-gray-900">
               {element.label}
               {element.isRequired && (
                  <span className="text-red-500 ml-1">*</span>
               )}
            </label>
         )}
         
         <div 
            className="
               prose max-w-none mt-2
               [&>p]:text-sm/6 [&>p]:text-gray-600 [&>p]:mt-1 [&>p]:mb-2 
               [&>ul]:list-disc [&>ul]:pl-4 [&>ul]:text-sm [&>ul]:text-gray-600 
               [&>ol]:list-decimal [&>ol]:pl-4 [&>ol]:text-sm [&>ol]:text-gray-600 
               [&>h1]:text-xl [&>h1]:font-semibold [&>h1]:text-gray-900 [&>h1]:my-3
               [&>h2]:text-lg [&>h2]:font-semibold [&>h2]:text-gray-900 [&>h2]:my-2
               [&>h3]:text-base [&>h3]:font-semibold [&>h3]:text-gray-900 [&>h3]:my-2
               [&>a]:text-blue-600 [&>a]:underline [&>a]:hover:text-blue-800
               [&>blockquote]:border-l-4 [&>blockquote]:border-gray-200 [&>blockquote]:pl-4 [&>blockquote]:italic
               [&>code]:bg-gray-100 [&>code]:px-1 [&>code]:rounded
               [&>pre]:bg-gray-100 [&>pre]:p-4 [&>pre]:rounded
            "
            dangerouslySetInnerHTML={{ __html: element.html || '' }}
         />
      </div>
   );
};

export default RichTextQuestion;
