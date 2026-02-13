"use client";

import React from "react";
import "./richText.scss";
import { Element, ErrorObject, Answers } from "@/app/(authenticated)/app/types";

interface RichTextQuestionProps {
  element: Element;
  answers: Answers;
  errors: ErrorObject[];
  disabled: boolean;
  skipVisibilityCheck?: boolean;
}

const mergeResizeStylesIntoImageTag = (html: string): string => {
  if (!html) return html;

  return html.replace(/<img\b([^>]*)>/gi, (fullMatch, rawAttrs: string) => {
    const findAttr = (name: string) => {
      const match = rawAttrs.match(new RegExp(`${name}=(["'])(.*?)\\1`, "i"));
      return match ? match[2] : "";
    };

    const existingStyle = findAttr("style");
    const containerStyle = findAttr("containerstyle");
    const wrapperStyle = findAttr("wrapperstyle");

    if (!containerStyle && !wrapperStyle) {
      return fullMatch;
    }

    const mergedStyle = [existingStyle, wrapperStyle, containerStyle]
      .filter(Boolean)
      .join("; ")
      .trim();

    const attrsWithoutResizeMetadata = rawAttrs
      .replace(/\scontainerstyle=(["']).*?\1/gi, "")
      .replace(/\swrapperstyle=(["']).*?\1/gi, "")
      .replace(/\sstyle=(["']).*?\1/gi, "");

    const styleAttr = mergedStyle ? ` style="${mergedStyle}"` : "";
    return `<img${attrsWithoutResizeMetadata}${styleAttr}>`;
  });
};

const RichTextQuestion = ({ element, disabled }: RichTextQuestionProps) => {
  const runtimeHtml = mergeResizeStylesIntoImageTag(element.html || "");
  const questionText = element.text || element.label || element.name;

  return (
    <div key={element.name} className={`${disabled ? "opacity-75" : ""}`}>
      {questionText && (
        <label className="block text-sm/6 font-medium text-gray-900">
          {questionText}
          {element.isRequired && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      <div
        className="
               rich-text-content
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
        dangerouslySetInnerHTML={{ __html: runtimeHtml }}
      />
    </div>
  );
};

export default RichTextQuestion;
