"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { DragDropContext } from "@hello-pangea/dnd";
import { Plus, ChevronDown, Upload, X, FileText, Type, AlignLeft, CircleDot, CheckSquare, List, SlidersHorizontal, ToggleLeft, Bot, MessageCircle, ImagePlus, MessagesSquare, PanelLeft, PanelRightClose } from "lucide-react";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "./ui/collapsible";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "./ui/popover";
import JsonPreview from './JsonPreview';
import Field from './Field';
import { Droppable, Draggable } from '@hello-pangea/dnd';
import { Checkbox } from "./ui/checkbox";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "./ui/select";
import { Input } from "./ui/input";
import { useSurveyStore } from "../store/editSurveyStore";
import AppRuntimeView from "@/components/AppRuntimeView";
import {
 
  Element,
  Choice,
  ConditionalLogic,
} from "@/app/(authenticated)/app/types";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";
import { HelpCircle } from "lucide-react";
import { useDropzone } from "react-dropzone";
import { createFileUploader } from "@/utils/imageUpload";

// Options for the "Add section" dialog
const fieldTypes = [
  { id: 'text', label: 'Single Line', icon: Type, helper: 'Collect a single line of text input.'},
  { id: 'textarea', label: 'Long Text', icon: AlignLeft, helper: 'Collect a longer block of text input.'},
  { id: 'richText', label: 'Rich Text', icon: FileText, helper: 'Display text or images to the user.'},
  { id: 'radio', label: 'Radio Buttons', icon: CircleDot, helper: 'Collect a single choice from a list of options.'},
  { id: 'checkbox', label: 'Checkboxes', icon: CheckSquare, helper: 'Collect one or more choices from a list of options.'},
  { id: 'dropdown', label: 'Dropdown', icon: List, helper: 'Collect a single choice from a dropdown menu.'},
  { id: 'slider', label: 'Slider', icon: SlidersHorizontal, helper: 'Collect a numeric value from a slider.'},
  { id: 'boolean', label: 'Boolean', icon: ToggleLeft, helper: 'Collect a true or false value. Often used for conditional logic.'},
  { id: 'imageUpload', label: 'Image Upload', icon: ImagePlus, helper: 'Collect an image or images from the user.'},
  { id: 'chat', label: 'Chatbot', icon: MessagesSquare, helper: 'Add a chat interface for users to interact with the AI.'},
];

const cardTypes = [
  { id: 'title', label: 'Title', icon: Type, helper: 'Static title text shown to the user.'},
  { id: 'aiResponse', label: 'AI Response', icon: Bot, helper: 'Stops the flow and runs the AI when the user clicks Run.'},
  { id: 'fixedResponse', label: 'Response', icon: MessageCircle, helper: 'Stops the flow and shows static text (no AI call).'},
  { id: 'scoring', label: 'Scoring', icon: SlidersHorizontal, helper: 'Stops the flow and runs rubric scoring when the user clicks Run.'},
];

const ACCEPTED_FILE_TYPES = {
  "application/pdf": [".pdf"],
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": [
    ".pptx",
  ],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [
    ".docx",
  ],
  "application/msword": [".doc"],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [
    ".xlsx",
  ],
  "application/vnd.ms-excel": [".xls"],
  "text/csv": [".csv"],
  "text/plain": [".txt", ".log"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/tiff": [".tiff"],
  "image/bmp": [".bmp"],
};

//TO-DO: Just use the backend max file size
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB max file size

const MAX_DESCRIPTION_LENGTH = 200;

interface UploadedFile {
  name: string;
  url?: string;
  size: number;
  word_count?: number;
  original_filename: string;
  text_filename: string;
  description?: string;
}

export default function FormBuilder() {
  const params = useParams() ?? {};
  const hashId = (params.id as string) || "";

  const [isOpen, setIsOpen] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [addSectionOpenFor, setAddSectionOpenFor] = useState<string | null>(null);
  const [insertAfterIndex, setInsertAfterIndex] = useState<number | null>(null);
  const [backgroundTheme] = useState<'white' | 'gray'>('gray');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'build' | 'preview'>('build');
  const availableSections = [...fieldTypes, ...cardTypes];

  const {
    elements,
    privacy,
    clonable,
    completedHtml,
    collectionId,
    description,
    title,
    collections,
    availableModels,
    isLoadingCollections,
    aiConfig,
    attachedFiles,
    setElements,
    setTitle,
    setDescription,
    setCollectionId,
    setPrivacy,
    setClonable,
    setCompletedHtml,
    setAIConfig,
    addAttachedFile,
    removeAttachedFile,
    fetchCollections,
    fetchLiteLLMModels,
    appId,
    setAttachedFiles,
  } = useSurveyStore();

  const fileUploader = createFileUploader(appId?.toString() || "");

  const handleFileUpload = useCallback(
    async (file: File) => {
      if (file.size > MAX_FILE_SIZE) {
        alert("File size must be less than 5MB");
        return;
      }

      try {
        setIsUploading(true);
        const result = await fileUploader.uploadFile(file);

        // Extract filename from original_file path
        const original_filename = result.original_file?.split("/").pop();
        const text_filename = result.text_file?.split("/").pop();
        if (!original_filename || !text_filename) {
          throw new Error("No filename returned from upload");
        }

        const fileData = {
          original_filename,
          text_filename,
          size: file.size,
          word_count: result.word_count,
        };

        setUploadedFiles((prev) => [
          ...prev,
          {
            name: file.name,
            url: result.url,
            original_filename,
            text_filename,
            size: file.size,
            word_count: result.word_count,
          },
        ]);

        await addAttachedFile(fileData);
      } catch (error) {
        console.error("Error uploading file:", error);
        alert("Failed to upload file");
      } finally {
        setIsUploading(false);
      }
    },
    [fileUploader, addAttachedFile]
  );

  const removeFile = useCallback(
    async (index: number) => {
      const file = uploadedFiles[index];
      setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
      if (!file.original_filename) {
        throw new Error("No filename found for file");
      }
      await removeAttachedFile(file.original_filename);
    },
    [uploadedFiles, removeAttachedFile]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (acceptedFiles) => {
      acceptedFiles.forEach((file) => handleFileUpload(file));
    },
    accept: ACCEPTED_FILE_TYPES,
    maxSize: MAX_FILE_SIZE,
    disabled: isUploading,
  });

  useEffect(() => {
    // Set default AI config values if not present
    if (!aiConfig.aiModel) {
      setAIConfig({
        ...aiConfig,
        aiModel: "gpt-4o-mini",
      });
    }
    if (!aiConfig.temperature) {
      setAIConfig({
        ...aiConfig,
        temperature: 0.7,
      });
    }
  }, [aiConfig, setAIConfig]);

  // Initialize uploadedFiles from attachedFiles
  useEffect(() => {
    if (attachedFiles && attachedFiles.length > 0) {
      const files = attachedFiles
        .filter((file) => file && file.original_filename)
        .map((file) => ({
          name: file.original_filename.split("_")[0],
          original_filename: file.original_filename,
          text_filename: file.text_filename,
          url: `https://${process.env.NEXT_PUBLIC_CLOUDFRONT_DOMAIN}/${file.original_filename}`,
          size: file.size,
          word_count: file.word_count,
          description: file.description,
        }));
      setUploadedFiles(files);
    } else {
      setUploadedFiles([]);
    }
  }, [attachedFiles]);

  // Load collections on mount
  useEffect(() => {
    fetchCollections();
  }, [fetchCollections]);

  //Load models on mount - using LiteLLM by default
  useEffect(() => {
    fetchLiteLLMModels();
  }, [fetchLiteLLMModels]);

  /**
   * V2 builder: elements are stored as a single ordered list.
   */
  const updateElement = useCallback((elementId: string, updates: Partial<Element>) => {
    const current = Array.isArray(elements) ? elements : [];
    setElements(current.map(el => (el.id === elementId ? { ...el, ...updates } : el)));
  }, [elements, setElements]);

  const deleteElement = useCallback((elementId: string) => {
    const current = Array.isArray(elements) ? elements : [];
    setElements(current.filter(el => el.id !== elementId));
  }, [elements, setElements]);

  /**
   * Handles the completion of a drag-and-drop operation within the form builder.
   * Reorders elements within the single elements[] list.
   */
  const handleDragEnd = (result: any) => {
    const { source, destination } = result;

    if (!destination) return;
    const current = Array.isArray(elements) ? elements : [];
    const updated = [...current];
    const [moved] = updated.splice(source.index, 1);
    updated.splice(destination.index, 0, moved);
    setElements(updated);
  };

  /**
   * Adds a new element into the app (V2 builder).
   */
  const addElementToApp = (type: string, insertAfter?: number | null) => {
    const current = Array.isArray(elements) ? elements : [];
    const existingCount = current.filter(e => e.type === type).length;

    const base: Element = {
      id: `${type}-${Date.now()}`,
      type: type as Element['type'],
      label: '',
      name: `${type}${existingCount + 1}`,
      isRequired: false,
    };

    const newElement: Element = {
      ...base,
      ...(type === 'title' && {
        label: 'Title',
        text: 'Title',
      }),
      ...(type === 'aiResponse' && {
        instructions: [{ text: '' }],
      }),
      ...(type === 'fixedResponse' && { text: '' }),
      ...(type === 'scoring' && { rubric: '', minScore: 0 }),
      ...(type === 'imageUpload' && {
        multiple: false,
        maxFiles: 1,
        maxFileSize: 5,
        allowedFileTypes: ['image/jpeg', 'image/png'],
      }),
      ...(type === 'chat' && {
        maxMessages: 10,
        initialMessage: 'Hello! How can I help you today?',
        enableTts: false,
        ttsProvider: 'openai',
        selectedVoiceId: '',
        voiceInstructions: '',
        avatarUrl: '',
      }),
    };

    const updated = [...current];
    if (insertAfter !== null && insertAfter !== undefined) {
      updated.splice(insertAfter + 1, 0, newElement);
    } else {
      updated.push(newElement);
    }

    setElements(updated);
    setAddSectionOpenFor(null);
    setInsertAfterIndex(null);
  };

  /**
   * Updates the label of an element.
   */
  const updateFieldLabel = (fieldId: string, newLabel: string, _isPrompt: boolean = false) => {
    // For title elements we also mirror label into text for display.
    updateElement(fieldId, { label: newLabel, text: newLabel });
  };

  /**
   * Updates the internal name/identifier of an element.
   */
  const updateFieldName = (fieldId: string, newName: string, _isPrompt: boolean = false) => {
    updateElement(fieldId, { name: newName });
  };

  /**
   * Sets whether a field is required for form submission.
   */
  const updateFieldRequired = (fieldId: string, isRequired: boolean, _isPrompt: boolean = false) => {
    updateElement(fieldId, { isRequired });
  };

  /**
   * Removes an element.
   */
  const deleteField = (fieldId: string, _isPrompt: boolean = false) => {
    deleteElement(fieldId);
  };

  /**
   * Updates the description of a field within a specific phase.
   */
  const updateFieldDescription = (fieldId: string, description: string, _isPrompt: boolean = false) => {
    updateElement(fieldId, { description });
  };

  /**
   * Sets character count validation rules for text-based fields.
   * Now works with the flattened view by finding the phase automatically.
   */
  const updateFieldValidation = (
    fieldId: string, 
    minChars: number | null, 
    maxChars: number | null, 
    _isPrompt: boolean = false
  ) => {
    updateElement(fieldId, { 
            minChars: minChars ?? undefined,
            maxChars: maxChars ?? undefined
    });
  };

  /**
   * Sets the default value for a field.
   */
  const updateFieldDefaultValue = (
    fieldId: string, 
    value: string | string[] | number | boolean
  ) => {
    updateElement(fieldId, { defaultValue: value });
  };

  /**
   * Sets the placeholder text for a field.
   */
  const updateFieldPlaceholder = (fieldId: string, placeholder: string) => {
    updateElement(fieldId, { placeholder });
  };

  /**
   * Updates the available choices for selection-type fields (radio, checkbox, dropdown).
   */
  const updateFieldChoices = (fieldId: string, choices: Choice[]) => {
    updateElement(fieldId, { choices });
  };

  /**
   * Toggles the "Other" option for selection-type fields.
   */
  const updateFieldShowOther = (fieldId: string, showOther: boolean) => {
    updateElement(fieldId, { showOtherItem: showOther });
  };

  /**
   * Updates the configuration properties of a slider field.
   * Now works with the flattened view by finding the phase automatically.
   */
  const updateFieldSliderProps = (
    fieldId: string, 
    updates: {
      minValue?: number;
      maxValue?: number;
      step?: number;
    }
  ) => {
    updateElement(fieldId, updates);
  };

  /**
   * Sets the default value for a slider field.
   * Now works with the flattened view by finding the phase automatically.
   */
  const updateFieldSliderValue = (fieldId: string, value: number) => {
    updateElement(fieldId, { defaultValue: value });
  };

  /**
   * Updates the text content of a text-based field.
   * Now works with the flattened view by finding the phase automatically.
   */
  const updateFieldText = (fieldId: string, text: string, _isPrompt: boolean = false) => {
    updateElement(fieldId, { text });
  };

  /**
   * Updates the HTML content of a rich text field.
   * Now works with the flattened view by finding the phase automatically.
   */
  const updateFieldRichText = (fieldId: string, html: string, _isPrompt: boolean = false) => {
    updateElement(fieldId, { html });
  };

  /**
   * Updates the conditional display logic for a field.
   * Now works with the flattened view by finding the phase automatically.
   */
  const handleUpdateConditionalLogic = (fieldId: string, logic: ConditionalLogic | null, _isPrompt: boolean) => {
    updateElement(fieldId, { conditionalLogic: logic || undefined });
  };

  /**
   * Updates the configuration for image upload fields.
   * Now works with the flattened view by finding the phase automatically.
   */
  const updateImageUploadSettings = (
    fieldId: string, 
    settings: {
      multiple?: boolean;
      maxFiles?: number;
      maxFileSize?: number;
      allowedFileTypes?: string[];
    }
  ) => {
    updateElement(fieldId, settings);
  };

  /**
   * Sets the maximum number of messages allowed in a chat field.
   * Now works with the flattened view by finding the phase automatically.
   */
  const updateFieldMaxMessages = (fieldId: string, maxMessages: number) => {
    updateElement(fieldId, { maxMessages });
  };

  /**
   * Sets the initial message displayed in a chat field.
   * Now works with the flattened view by finding the phase automatically.
   */
  const updateFieldInitialMessage = (fieldId: string, initialMessage: string) => {
    updateElement(fieldId, { initialMessage });
  };

  /**
   * Updates the chatbot instructions for a specific chat field.
   * Now works with the flattened view by finding the phase automatically.
   */
  const updateChatbotInstructions = (fieldId: string, instructions: string) => {
    updateElement(fieldId, { chatbotInstructions: instructions });
  };

  /**
   * Updates the TTS provider setting for a specific chat field.
   * Now works with the flattened view by finding the phase automatically.
   */
  const updateTtsProvider = (fieldId: string, provider: string) => {
    updateElement(fieldId, { ttsProvider: provider });
  };

  /**
   * Updates the selected voice ID for TTS in a specific chat field.
   * Now works with the flattened view by finding the phase automatically.
   */
  const updateTtsVoiceId = (fieldId: string, voiceId: string) => {
    updateElement(fieldId, { 
              selectedVoiceId: voiceId,
              ttsProvider: 'openai' //TODO: Support other TTS providers
    });
  };

  /**
   * Toggles TTS functionality for a specific chat field.
   * Now works with the flattened view by finding the phase automatically.
   */
  const updateTtsEnabled = (fieldId: string, enabled: boolean) => {
    updateElement(fieldId, { enableTts: enabled });
  };

  /**
   * Updates the voice instructions for custom voice design in a specific chat field.
   * Now works with the flattened view by finding the phase automatically.
   */
  const updateVoiceInstructions = (fieldId: string, instructions: string) => {
    updateElement(fieldId, { voiceInstructions: instructions });
  };

  const updateAvatarUrl = (fieldId: string, avatarUrl: string) => {
    updateElement(fieldId, { avatarUrl });
  };

  const updateFileDescription = (index: number, description: string) => {
    const truncatedDescription = description.slice(0, MAX_DESCRIPTION_LENGTH);

    setUploadedFiles((prev) =>
      prev.map((file, i) =>
        i === index ? { ...file, description: truncatedDescription } : file
      )
    );

    // Update description in store
    const file = uploadedFiles[index];
    if (file) {
      const updatedFiles = attachedFiles.map((attachedFile) => {
        return attachedFile.original_filename === file.original_filename
          ? { ...attachedFile, description: truncatedDescription }
          : attachedFile;
      });
      setAttachedFiles(updatedFiles);
    }
  };

  // Render Additional App Settings content (moved to sidebar)
  const renderAdditionalAppSettings = () => (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium text-left">Collection</label>
        <Select
          value={collectionId?.toString() || ''}
          onValueChange={(value) => setCollectionId(parseInt(value))}
          disabled={isLoadingCollections}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder={
              isLoadingCollections 
                ? "Loading collections..." 
                : "Select a collection"
            } />
          </SelectTrigger>
          <SelectContent className="bg-white">
            {collections?.length > 0 ? (
              collections.map((collection) => (
                <SelectItem 
                  key={collection.value} 
                  value={collection.value.toString()}
                >
                  {collection.text}
                </SelectItem>
              ))
            ) : (
              <SelectItem value="" disabled>
                {isLoadingCollections 
                  ? "Loading collections..." 
                  : "No collections available"}
              </SelectItem>
            )}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-left">Privacy Settings</label>
        <Select
          value={privacy}
          onValueChange={(value) => setPrivacy(value)}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select privacy setting" />
          </SelectTrigger>
          <SelectContent className="bg-white">
            <SelectItem value="private">Private</SelectItem>
            <SelectItem value="public">Public</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center space-x-2">
        <Checkbox
          id="clonable"
          checked={clonable}
          onCheckedChange={(checked) => setClonable(checked as boolean)}
        />
        <label
          htmlFor="clonable"
          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed 
            peer-disabled:opacity-70 text-left"
        >
          Allow others to clone this app
        </label>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-left">Completion Message</label>
        <textarea
          value={completedHtml}
          onChange={(e) => setCompletedHtml(e.target.value)}
          className="w-full rounded-md border border-gray-300 px-3 py-2 
            text-gray-900 focus:border-primary focus:ring-primary min-h-[80px] resize-y"
          placeholder="Enter your message here"
        />
      </div>

      <div className="border-t border-gray-200 pt-4">
        <div className="flex items-center gap-2 mb-4">
          <h3 className="text-sm font-medium text-left uppercase text-gray-500">Attached Files</h3>
          <TooltipProvider delayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild>
                <HelpCircle className="h-4 w-4 text-gray-400 cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={5}>
                <p className="w-[200px] text-sm">
                  Upload files that will be available to users of your app. Supports PDF, PPT, DOC, TXT, CSV, JSON, and MD files.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        <div
          {...getRootProps()}
          className={`
            mt-2 border-2 border-dashed rounded-lg p-4 transition-colors duration-150 ease-in-out
            ${isDragActive ? 'border-primary-400 bg-primary-50' : isUploading ? 'border-primary-300 bg-primary-50' : 'border-gray-300 hover:border-primary-600'}
            ${isUploading ? 'cursor-not-allowed' : 'cursor-pointer'}
          `}
        >
          <input {...getInputProps()} />
          <div className="text-center">
            <Upload className={`mx-auto h-8 w-8 ${isDragActive || isUploading ? 'text-primary-400' : 'text-gray-400'}`} />
            <p className="mt-2 text-sm text-gray-600">
              {isDragActive ? "Drop files here" : "Drag and drop files here, or click to select files"}
            </p>
            <p className="mt-1 text-xs text-gray-500">
              PDF, PPT, DOC, TXT, CSV, JSON, MD
            </p>
            <p className="mt-1 text-xs text-gray-500">
              Max file size: 50MB
            </p>
            {isUploading && (
              <div className="mt-4 flex items-center justify-center gap-2">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary-600"></div>
                <span className="text-sm text-gray-600">Uploading...</span>
              </div>
            )}
          </div>
        </div>

        {uploadedFiles.length > 0 && (
          <div className="mt-4 space-y-2">
            {uploadedFiles.map((file, index) => (
              <div key={index} className="space-y-2">
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="text-sm font-medium text-gray-700">{file.name}</p>
                      <p className="text-xs text-gray-500">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                        {file.word_count && ` • ${file.word_count} words`}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => removeFile(index)}
                    className="p-1 hover:bg-gray-200 rounded-full transition-colors"
                  >
                    <X className="h-4 w-4 text-gray-500" />
                  </button>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    value={file.description || ''}
                    onChange={(e) => updateFileDescription(index, e.target.value)}
                    placeholder="Add a description so the AI understands the content of this file better (optional)"
                    maxLength={MAX_DESCRIPTION_LENGTH}
                    className="w-full px-3 py-1 text-sm border border-gray-200 rounded-md 
                      focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary
                      placeholder:text-gray-400"
                  />
                  <div className="absolute right-2 bottom-1 text-xs text-gray-400">
                    {(file.description?.length || 0)}/{MAX_DESCRIPTION_LENGTH}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-4 border-t border-gray-200 pt-4">
        <h3 className="text-sm font-medium text-left uppercase text-gray-500">AI Configuration</h3>
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-left">System Prompt</label>
            <textarea
              value={aiConfig.systemPrompt}
              onChange={(e) => setAIConfig({ ...aiConfig, systemPrompt: e.target.value })}
              className="w-full rounded-md border border-gray-300 px-3 py-2 
                text-gray-900 focus:border-primary focus:ring-primary min-h-[80px] resize-y"
              placeholder="Enter your prompt here"
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium text-left">AI Model</label>
            <Select
              value={aiConfig.aiModel}
              onValueChange={(value) => setAIConfig({ ...aiConfig, aiModel: value })}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select AI model" />
              </SelectTrigger>
              <SelectContent>
                {Object.keys(availableModels).map((modelName) => (
                  <SelectItem key={modelName} value={modelName}>
                    {modelName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-left">Temperature</label>
            <Input
              type="number"
              step="0.01"
              min={availableModels[aiConfig.aiModel || 'gpt-4o-mini']?.min ?? 0}
              max={availableModels[aiConfig.aiModel || 'gpt-4o-mini']?.max ?? 2}
              value={aiConfig.temperature}
              onChange={(e) => {
                const value = parseFloat(e.target.value);
                if (!isNaN(value)) {
                  const min = availableModels[aiConfig.aiModel]?.min ?? 0;
                  const max = availableModels[aiConfig.aiModel]?.max ?? 2;
                  setAIConfig({
                    ...aiConfig,
                    temperature: Math.min(max, Math.max(min, Number(value.toFixed(2))))
                  });
                }
              }}
              className="w-full"
              placeholder={`Enter temperature (${availableModels[aiConfig.aiModel]?.min ?? 0}-${availableModels[aiConfig.aiModel]?.max ?? 2})`}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-left">Max Response Tokens</label>
            <Input
              type="number"
              step="1"
              min="1"
              value={aiConfig.maxResponseTokens || ''}
              onChange={(e) => {
                const value = e.target.value ? parseInt(e.target.value) : null;
                setAIConfig({ ...aiConfig, maxResponseTokens: value });
              }}
              className="w-full"
              placeholder="Leave empty for no limit"
            />
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className={`min-h-screen ${backgroundTheme === 'gray' ? 'bg-gray-50' : 'bg-white'}`}>
        {/* Main Layout with Sidebar */}
        <div className="flex relative">
          {/* Sidebar - opens after first header */}
          {sidebarOpen && (
            <div 
              className="w-80 bg-white border-r border-gray-300 sticky top-0 self-start h-screen flex flex-col transition-all duration-300 z-30"
              ref={(el) => {
                if (el) {
                  // #region agent log
                  const rect = el.getBoundingClientRect();
                  fetch('http://127.0.0.1:7242/ingest/82826c81-9a19-444e-9aa2-e2bc8db5693b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'FormBuilder.tsx:sidebar-ref',message:'Sidebar dimensions',data:{width:rect.width,height:rect.height,top:rect.top,left:rect.left,viewportHeight:window.innerHeight},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
                  // #endregion
                }
              }}
            >
              {/* Sidebar Header */}
              <div className="h-14 px-4 border-b border-gray-300 bg-white flex items-center justify-between">
                <span className="text-sm font-medium">Additional App Settings</span>
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="p-1 hover:bg-gray-200 rounded-md transition-colors"
                  aria-label="Close sidebar"
                >
                  <PanelRightClose className="h-5 w-5 text-gray-600" />
                </button>
              </div>
              
              {/* Scrollable Settings Container */}
              <div className="flex-1 overflow-y-auto">
                <div className="p-4 pb-20">
                  {renderAdditionalAppSettings()}
                </div>
              </div>
            </div>
          )}

          {/* Main Content Area */}
          <div 
            className="flex-1 transition-all duration-300"
            ref={(el) => {
              if (el && sidebarOpen) {
                // #region agent log
                const rect = el.getBoundingClientRect();
                fetch('http://127.0.0.1:7242/ingest/82826c81-9a19-444e-9aa2-e2bc8db5693b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'FormBuilder.tsx:main-content-ref',message:'Main content dimensions with sidebar',data:{width:rect.width,left:rect.left,marginLeft:window.getComputedStyle(el).marginLeft,sidebarWidth:320},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'B'})}).catch(()=>{});
                // #endregion
              }
            }}
          >
            {/* Second Header */}
            <div className="bg-white border-b border-gray-300 sticky top-0 z-40 h-14">
              <div className="flex items-center h-full px-4">
                {/* Toggle button on left when sidebar is closed */}
                {!sidebarOpen && (
                  <button
                    onClick={() => setSidebarOpen(true)}
                    className="mr-4 p-2 hover:bg-gray-100 rounded-md transition-colors"
                    aria-label="Open sidebar"
                  >
                    <PanelLeft className="h-5 w-5 text-gray-600" />
                  </button>
                )}
                
                {/* Tabs in center */}
                <div className="flex items-center justify-center flex-1 gap-0 h-full">
                  <button
                    onClick={() => setActiveTab('build')}
                    className={`px-6 py-2 text-sm font-medium transition-colors h-full flex items-center ${
                      activeTab === 'build'
                        ? 'text-primary border-b-2 border-primary'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Build
                  </button>
                  <div className="h-6 w-px bg-gray-300" />
                  <button
                    onClick={() => setActiveTab('preview')}
                    className={`px-6 py-2 text-sm font-medium transition-colors h-full flex items-center ${
                      activeTab === 'preview'
                        ? 'text-primary border-b-2 border-primary'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Preview
                  </button>
                </div>
              </div>
            </div>

            {/* Main Content */}
            {activeTab === 'build' ? (
              <div className="container mx-auto py-8 px-4 max-w-7xl">
                <>
                  <div className="space-y-6 mb-8">
                    <div className="flex items-center gap-2 mb-4">
                      <h3 className="text-sm font-medium text-gray-500">App Details</h3>
                      <TooltipProvider delayDuration={0}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <HelpCircle className="h-4 w-4 text-gray-400 cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent side="right" sideOffset={5}>
                            <p className="w-[200px] text-sm">
                              Provide a name and a description for your app that will be displayed to users.
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <input
                      type="text"
                      value={title}
                      onFocus={() => {
                        if (title === "Untitled App") setTitle("");
                      }}
                      onChange={(e) => setTitle(e.target.value)}
                      className="text-3xl font-bold bg-transparent 
                        border-2 border-dashed border-gray-200 hover:border-gray-400 
                        focus:border-gray-600 rounded-lg px-4 py-2 transition-all duration-200
                        focus:outline-none focus:ring-2 focus:ring-primary/20 w-full cursor-text
                        placeholder:text-gray-400"
                      placeholder="Untitled App"
                    />
                    
                    <textarea
                      value={description}
                      onFocus={() => {
                        if (description === "Tell the user what your app does...") setDescription("");
                      }}
                      onChange={(e) => setDescription(e.target.value)}
                      className="text-lg bg-transparent w-full 
                        border-2 border-dashed border-gray-200 hover:border-gray-400 
                        focus:border-gray-600 rounded-lg px-4 py-2 transition-all duration-200
                        focus:outline-none focus:ring-2 focus:ring-primary/20 min-h-[100px] 
                        resize-y cursor-text placeholder:text-gray-400"
                      placeholder="Tell the user what your app does..."
                    />
                  </div>

                  <div className="mt-8 space-y-6">
                    <Droppable droppableId="all-elements" type="element">
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          className={`min-h-[200px] transition-colors ${
                            snapshot.isDraggingOver
                              ? 'bg-primary/5'
                              : ''
                          }`}
                        >
                          {(() => {
                            const visibleElements = Array.isArray(elements) ? elements : [];

                            return visibleElements.map((element, index, array) => {
                              const isLastElement = index === array.length - 1;

                              return (
                                <React.Fragment key={element.id}>
                                  <Draggable draggableId={element.id} index={index}>
                                    {(providedDraggable, snapshotDraggable) => (
                                      <div
                                        ref={providedDraggable.innerRef}
                                        {...providedDraggable.draggableProps}
                                        className={`mb-4 rounded-lg border border-gray-200 bg-white p-4 ${
                                          snapshotDraggable.isDragging ? "opacity-80" : ""
                                        }`}
                                      >
                                        <Field
                                          field={element}
                                          index={index}
                                          phaseFields={visibleElements}
                                          appFields={visibleElements}
                                          appId={appId}
                                          dragHandleProps={providedDraggable.dragHandleProps}
                                          onUpdateFieldLabel={(fieldId, newLabel, isPrompt) => updateFieldLabel(fieldId, newLabel, isPrompt)}
                                          onUpdateFieldName={(fieldId, newName, isPrompt) => updateFieldName(fieldId, newName, isPrompt)}
                                          onDeleteField={(fieldId, isPrompt) => deleteField(fieldId, isPrompt)}
                                          onUpdateFieldDescription={(fieldId, description, isPrompt) => updateFieldDescription(fieldId, description, isPrompt)}
                                          onUpdateFieldRequired={(fieldId, required, isPrompt) => updateFieldRequired(fieldId, required, isPrompt)}
                                          onUpdateFieldValidation={(fieldId, minChars, maxChars, isPrompt) => updateFieldValidation(fieldId, minChars, maxChars, isPrompt)}
                                          onUpdateFieldDefaultValue={(fieldId, defaultValue) => updateFieldDefaultValue(fieldId, defaultValue)}
                                          onUpdateFieldPlaceholder={(fieldId, placeholder) => updateFieldPlaceholder(fieldId, placeholder)}
                                          onUpdateFieldChoices={(fieldId, choices) => updateFieldChoices(fieldId, choices)}
                                          onUpdateFieldShowOther={(fieldId, showOther) => updateFieldShowOther(fieldId, showOther)}
                                          onUpdateFieldSliderProps={(fieldId, updates) => updateFieldSliderProps(fieldId, updates)}
                                          onUpdateFieldSliderValue={(fieldId, value) => updateFieldSliderValue(fieldId, value)}
                                          onUpdatePromptText={(fieldId, text) => updateFieldText(fieldId, text, true)}
                                          onUpdateRichText={(fieldId, html) => updateFieldRichText(fieldId, html, false)}
                                          onUpdateConditionalLogic={(fieldId, logic) => handleUpdateConditionalLogic(fieldId, logic, false)}
                                          onUpdateAiResponseInstructions={(fieldId, instructions) => updateElement(fieldId, { instructions })}
                                          onUpdateScoringSettings={(fieldId, updates) => updateElement(fieldId, updates)}
                                          onUpdateImageUploadSettings={(fieldId, settings) => updateImageUploadSettings(fieldId, settings)}
                                          onUpdateFieldMaxMessages={(fieldId, maxMessages) => updateFieldMaxMessages(fieldId, maxMessages)}
                                          onUpdateFieldInitialMessage={(fieldId, initialMessage) => updateFieldInitialMessage(fieldId, initialMessage)}
                                          onUpdateChatbotInstructions={(fieldId, instructions) => updateChatbotInstructions(fieldId, instructions)}
                                          onUpdateTtsProvider={(fieldId, provider) => updateTtsProvider(fieldId, provider)}
                                          onUpdateTtsVoiceId={(fieldId, voiceId) => updateTtsVoiceId(fieldId, voiceId)}
                                          onUpdateTtsEnabled={(fieldId, enabled) => updateTtsEnabled(fieldId, enabled)}
                                          onUpdateVoiceInstructions={(fieldId, instructions) => updateVoiceInstructions(fieldId, instructions)}
                                          onUpdateAvatarUrl={(fieldId, avatarUrl) => updateAvatarUrl(fieldId, avatarUrl)}
                                        />
                                      </div>
                                    )}
                                  </Draggable>

                                  {/* Plus button between cards on its own line with always-visible silver line */}
                                  {!isLastElement && (
                                    <div className="group grid grid-cols-[1fr_auto_1fr] items-center gap-2 my-3">
                                      <div className="h-px w-full bg-gray-300 rounded-full" />
                                      <Popover
                                        open={addSectionOpenFor === `between-${element.id}`}
                                        onOpenChange={(open) => {
                                          setAddSectionOpenFor(open ? `between-${element.id}` : null);
                                          if (!open) {
                                            setInsertAfterIndex(null);
                                          }
                                        }}
                                      >
                                        <PopoverTrigger asChild>
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-7 w-7 rounded-full p-0 bg-white border-2 border-gray-300 hover:border-primary hover:bg-primary/5 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                                            onClick={() => {
                                              setInsertAfterIndex(index);
                                            }}
                                          >
                                            <Plus className="h-3 w-3" />
                                          </Button>
                                        </PopoverTrigger>
                                        <PopoverContent align="center" side="bottom" className="w-72 p-2">
                                          <div className="space-y-1">
                                            {availableSections.map((section) => {
                                              const Icon = section.icon;
                                              return (
                                                <button
                                                  key={section.id}
                                                  onClick={() => {
                                                    addElementToApp(section.id, insertAfterIndex);
                                                    setAddSectionOpenFor(null);
                                                  }}
                                                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-gray-100 transition-colors text-left"
                                                >
                                                  <Icon className="h-4 w-4 text-gray-500 flex-shrink-0" />
                                                  <div className="flex-1 min-w-0">
                                                    <div className="text-xs font-medium text-gray-900">{section.label}</div>
                                                  </div>
                                                  <TooltipProvider delayDuration={0}>
                                                    <Tooltip>
                                                      <TooltipTrigger asChild>
                                                        <HelpCircle className="h-4 w-4 text-gray-400" />
                                                      </TooltipTrigger>
                                                      <TooltipContent side="right">
                                                        <p className="max-w-xs text-xs">{section.helper}</p>
                                                      </TooltipContent>
                                                    </Tooltip>
                                                  </TooltipProvider>
                                                </button>
                                              );
                                            })}
                                          </div>
                                        </PopoverContent>
                                      </Popover>
                                      <div className="h-px w-full bg-gray-300 rounded-full" />
                                    </div>
                                  )}
                                </React.Fragment>
                              );
                            });
                          })()}
                          {provided.placeholder}
                          
                          {/* Add Section button at the end */}
                          <div className="mt-4 flex justify-start">
                            <Popover
                              open={addSectionOpenFor === "end-button"}
                              onOpenChange={(open) => {
                                setAddSectionOpenFor(open ? "end-button" : null);
                                if (!open) {
                                  setInsertAfterIndex(null);
                                }
                              }}
                            >
                              <PopoverTrigger asChild>
                                <Button 
                                  variant="default"
                                  size="lg"
                                  className="bg-primary text-primary-foreground hover:bg-primary-600"
                                  onClick={() => setInsertAfterIndex(null)}
                                >
                                  <Plus className="h-5 w-5 mr-2" />
                                  Add Section
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent align="start" side="bottom" className="w-72 p-2">
                                <div className="space-y-1">
                                  {availableSections.map((section) => {
                                    const Icon = section.icon;
                                    return (
                                      <button
                                        key={section.id}
                                        onClick={() => {
                                          addElementToApp(section.id, insertAfterIndex);
                                          setAddSectionOpenFor(null);
                                        }}
                                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-gray-100 transition-colors text-left"
                                      >
                                        <Icon className="h-4 w-4 text-gray-500 flex-shrink-0" />
                                        <div className="flex-1 min-w-0">
                                          <div className="text-xs font-medium text-gray-900">{section.label}</div>
                                        </div>
                                        <TooltipProvider delayDuration={0}>
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <HelpCircle className="h-4 w-4 text-gray-400" />
                                            </TooltipTrigger>
                                            <TooltipContent side="right">
                                              <p className="max-w-xs text-xs">{section.helper}</p>
                                            </TooltipContent>
                                          </Tooltip>
                                        </TooltipProvider>
                                      </button>
                                    );
                                  })}
                                </div>
                              </PopoverContent>
                            </Popover>
                          </div>
                        </div>
                      )}
                    </Droppable>

                    <Collapsible
                      open={isOpen}
                      onOpenChange={setIsOpen}
                      className="mt-8"
                    >
                      <Card>
                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" className="w-full flex items-center justify-between p-4">
                            <span className="text-lg font-semibold">JSON Preview</span>
                            <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'transform rotate-180' : ''}`} />
                          </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="p-4 border-t">
                            <JsonPreview 
                              elements={Array.isArray(elements) ? elements : []}
                              title={title || ''}
                              description={description || ''}
                              collection={collectionId || 0}
                              privacySettings={privacy}
                              clonable={clonable}
                              completedHtml={completedHtml}
                              attachedFiles={attachedFiles}
                              aiConfig={aiConfig}
                            />
                          </div>
                        </CollapsibleContent>
                      </Card>
                    </Collapsible>
                  </div>
                </>
              </div>
            ) : (
              <AppRuntimeView hashId={hashId} />
            )}
          </div>
        </div>
      </div>
    </DragDropContext>
  );
}
