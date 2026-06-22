"use client";

import React, { ChangeEvent, useRef, useState } from "react";
import {
  Element,
  ErrorObject,
  Answers,
  ConditionalLogic,
  FileAttachment,
  setFieldAttachments,
} from "@/app/(authenticated)/app/types";
import evaluateVisibility from "@/utils//evaluateVisibility";
import { handleTextAreaDoubleClick } from "@/utils/inputHandlers";
import { parseFile, ParseFileError } from "@/utils/parseFile";
import { Paperclip, Upload, X, FileText, Loader2 } from "lucide-react";
import { toast } from "react-toastify";
import { Textarea } from "../basic/textarea";
import { useDropzone } from "react-dropzone";

interface TextAreaQuestionProps {
  element: Element;
  answers: Answers;
  handleInputChange: (e: ChangeEvent<HTMLTextAreaElement>) => void;
  setFieldAttachments: setFieldAttachments;
  errors: ErrorObject[];
  disabled: boolean;
  skipVisibilityCheck?: boolean;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB per file

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function newAttachmentId(): string {
  return crypto.randomUUID?.() ?? `att-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

const TextAreaQuestion = ({
  element,
  answers,
  handleInputChange,
  setFieldAttachments,
  errors = [],
  disabled,
  skipVisibilityCheck = false,
}: TextAreaQuestionProps) => {
  const getErrorMessage = (elementName: string): string | null => {
    const error = errors.find((error) => error.element === elementName);
    return error ? error.error : null;
  };

  const errorMessage = getErrorMessage(element.name);
  const hasError = !!errorMessage;
  const questionText = element.text || element.label || element.name;

  const allowFileUpload = element.allowFileUpload ?? true;
  const allowMultiple = element.multiple ?? true;
  const attachments: FileAttachment[] =
    answers[element.name]?.attachments ?? [];

  const handleAutoHeight = (e: ChangeEvent<HTMLTextAreaElement>) => {
    e.target.style.height = "auto";
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

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isParsing, setIsParsing] = useState(false);

  const recalcHeight = () => {
    if (!textareaRef.current) return;
    textareaRef.current.style.height = "auto";
    textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
  };

  const updateAttachments = (next: FileAttachment[]) => {
    setFieldAttachments(element.name, next);
  };

  const removeAttachment = (id: string) => {
    updateAttachments(attachments.filter((a) => a.id !== id));
  };

  const processFiles = async (files: File[]) => {
    if (files.length === 0) return;

    setIsParsing(true);
    try {
      let current = [...attachments];

      for (const file of files) {
        if (file.size > MAX_FILE_SIZE) {
          toast.error(`File "${file.name}" exceeds the 10 MB limit.`);
          continue;
        }

        if (!allowMultiple) {
          current = [];
        } else if (current.length >= (element.maxFiles || 10)) {
          toast.error(
            `Maximum ${element.maxFiles || 10} files allowed.`,
          );
          break;
        }

        const pendingId = newAttachmentId();
        const pending: FileAttachment = {
          id: pendingId,
          filename: file.name,
          text: "",
          size: file.size,
          status: "parsing",
        };
        current = allowMultiple ? [...current, pending] : [pending];
        updateAttachments(current);

        try {
          const { text, word_count } = await parseFile(file);
          current = current.map((a) =>
            a.id === pendingId
              ? {
                  ...a,
                  text,
                  wordCount: word_count,
                  status: "ready" as const,
                }
              : a,
          );
          updateAttachments(current);
        } catch (err) {
          current = current.filter((a) => a.id !== pendingId);
          updateAttachments(current);
          if (err instanceof ParseFileError) {
            toast.error(err.message);
          } else {
            toast.error(`Failed to parse "${file.name}"`);
          }
        }
      }
    } finally {
      setIsParsing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
      requestAnimationFrame(recalcHeight);
    }
  };

  const onDrop = async (acceptedFiles: File[]) => {
    if (disabled || element.readOnly || !allowFileUpload) return;
    await processFiles(acceptedFiles);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    noClick: true,
    noKeyboard: true,
    disabled: disabled || element.readOnly || !allowFileUpload || isParsing,
    multiple: allowMultiple,
  });

  const handleFileInputChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const files = Array.from(e.target.files || []);
    await processFiles(files);
  };

  const isVisible =
    skipVisibilityCheck ||
    evaluateVisibility(
      element.conditionalLogic || ({} as ConditionalLogic),
      answers,
    );

  const readyAttachments = attachments.filter((a) => a.status !== "error");
  const parsingCount = attachments.filter((a) => a.status === "parsing").length;

  return (
    <div key={element.name} className={` ${isVisible ? "" : "hidden"}`}>
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
        {...(allowFileUpload ? getRootProps() : {})}
        className={`relative mt-2 ${isDragActive ? "ring-2 ring-primary/40 rounded-md" : ""}`}
      >
        {allowFileUpload && (
          <input {...getInputProps()} aria-hidden className="sr-only" />
        )}

        {allowFileUpload && readyAttachments.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {readyAttachments.map((att) => (
              <div
                key={att.id}
                className="inline-flex items-center gap-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-700"
              >
                {att.status === "parsing" ? (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
                ) : (
                  <FileText className="h-4 w-4 shrink-0 text-gray-500" />
                )}
                <span className="max-w-[200px] truncate" title={att.filename}>
                  {att.filename}
                </span>
                {att.size != null && att.status === "ready" && (
                  <span className="text-xs text-gray-400">
                    {formatFileSize(att.size)}
                  </span>
                )}
                {!disabled && !element.readOnly && att.status === "ready" && (
                  <button
                    type="button"
                    onClick={() => removeAttachment(att.id)}
                    className="text-gray-400 hover:text-red-500 focus:outline-none"
                    aria-label={`Remove ${att.filename}`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {allowFileUpload && isDragActive && (
          <div className="mb-2 flex items-center justify-center gap-2 rounded-md border border-dashed border-primary bg-primary/5 px-4 py-3 text-sm text-primary">
            <Upload className="h-4 w-4" />
            Drop files here
          </div>
        )}

        <div className="relative">
          <Textarea
            id={element.name}
            name={element.name}
            value={answers[element.name]?.value || ""}
            onChange={handleAutoHeight}
            onDoubleClick={onDoubleClick}
            placeholder={element.placeholder}
            disabled={disabled || element.readOnly}
            ref={textareaRef}
          />

          {allowFileUpload && !disabled && !element.readOnly && (
            <>
              <input
                type="file"
                multiple={allowMultiple}
                ref={fileInputRef}
                onChange={handleFileInputChange}
                className="hidden"
              />
              <button
                type="button"
                disabled={isParsing || parsingCount > 0}
                onClick={() => fileInputRef.current?.click()}
                className="group absolute bottom-2 right-2 flex items-center rounded px-2 py-1 text-gray-400 hover:text-primary-600 focus-visible:text-primary-600 focus:outline-none disabled:opacity-50"
                aria-label="Attach files"
              >
                <span
                  className="inline-block max-w-0 translate-x-1 overflow-hidden whitespace-nowrap pr-0 text-xs opacity-0 transition-[max-width,opacity,padding,transform] duration-200 ease-out group-hover:max-w-[5.5rem] group-hover:translate-x-0 group-hover:pr-1.5 group-hover:opacity-100 group-focus-visible:max-w-[5.5rem] group-focus-visible:translate-x-0 group-focus-visible:pr-1.5 group-focus-visible:opacity-100"
                  aria-hidden
                >
                  attach files
                </span>
                {isParsing || parsingCount > 0 ? (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                ) : (
                  <Paperclip className="h-4 w-4 shrink-0" />
                )}
              </button>
            </>
          )}
        </div>
      </div>

      {hasError && <p className="mt-1 text-sm text-red-600">{errorMessage}</p>}
    </div>
  );
};

export default TextAreaQuestion;
