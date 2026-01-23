"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { DragDropContext } from "@hello-pangea/dnd";
import {
  Plus,
  ChevronDown,
  Upload,
  X,
  FileText,
  Type,
  AlignLeft,
  CircleDot,
  CheckSquare,
  List,
  SlidersHorizontal,
  ToggleLeft,
  Bot,
  MessageCircle,
  ImagePlus,
  MessagesSquare,
  PanelLeft,
  PanelRightClose,
} from "lucide-react";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "./ui/collapsible";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import JsonPreview from "./JsonPreview";
import Field from "./Field";
import { Droppable, Draggable } from "@hello-pangea/dnd";
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
import ConditionalLogicSidebar from "./ui/conditional-logic-sidebar";
import { motion, LayoutGroup, AnimatePresence } from "framer-motion";
import Logo from "@/img/logos/onMicroAI_logo_horiz_color-cropped.svg";
import Image from "next/image";
import MonitorPreview from "./ui/monitor-preview";

// Options for the "Add section" dialog
const fieldTypes = [
  {
    id: "text",
    label: "Single Line",
    icon: Type,
    helper: "Collect a single line of text input.",
  },
  {
    id: "textarea",
    label: "Long Text",
    icon: AlignLeft,
    helper: "Collect a longer block of text input.",
  },
  {
    id: "richText",
    label: "Rich Text",
    icon: FileText,
    helper: "Display text or images to the user.",
  },
  {
    id: "radio",
    label: "Radio Buttons",
    icon: CircleDot,
    helper: "Collect a single choice from a list of options.",
  },
  {
    id: "checkbox",
    label: "Checkboxes",
    icon: CheckSquare,
    helper: "Collect one or more choices from a list of options.",
  },
  {
    id: "dropdown",
    label: "Dropdown",
    icon: List,
    helper: "Collect a single choice from a dropdown menu.",
  },
  {
    id: "slider",
    label: "Slider",
    icon: SlidersHorizontal,
    helper: "Collect a numeric value from a slider.",
  },
  {
    id: "boolean",
    label: "Boolean",
    icon: ToggleLeft,
    helper: "Collect a true or false value. Often used for conditional logic.",
  },
  {
    id: "imageUpload",
    label: "Image Upload",
    icon: ImagePlus,
    helper: "Collect an image or images from the user.",
  },
  {
    id: "chat",
    label: "Chatbot",
    icon: MessagesSquare,
    helper: "Add a chat interface for users to interact with the AI.",
  },
];

const cardTypes = [
  {
    id: "title",
    label: "Title",
    icon: Type,
    helper: "Static title text shown to the user.",
  },
  {
    id: "aiResponse",
    label: "AI Response",
    icon: Bot,
    helper: "Stops the flow and runs the AI when the user clicks Run.",
  },
  {
    id: "fixedResponse",
    label: "Response",
    icon: MessageCircle,
    helper: "Stops the flow and shows static text (no AI call).",
  },
  {
    id: "scoring",
    label: "Scoring",
    icon: SlidersHorizontal,
    helper: "Stops the flow and runs rubric scoring when the user clicks Run.",
  },
];

export const availableSections = [...fieldTypes, ...cardTypes];

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
  const router = useRouter();
  const hashId = (params.id as string) || "";

  const [isOpen, setIsOpen] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [addSectionOpenFor, setAddSectionOpenFor] = useState<string | null>(
    null,
  );
  const [insertAfterIndex, setInsertAfterIndex] = useState<number | null>(null);
  const [backgroundTheme] = useState<"white" | "gray">("gray");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"build" | "preview">("build");
  const [popoverPosition, setPopoverPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [isAppDetailsEditMode, setIsAppDetailsEditMode] = useState(false);
  const [activeFieldId, setActiveFieldId] = useState<string | undefined>(
    undefined,
  );
  const cardRef = useRef<HTMLDivElement>(null);

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
    conditionalSidebarOpen,
    setConditionalSidebarOpen,
    conditionalSidebarContext,
  } = useSurveyStore();
  const handleSaveConditionalLogic = async (logic: ConditionalLogic) => {
    if (!conditionalSidebarContext?.field.id) {
      setConditionalSidebarOpen(false);
      return;
    }

    // Handle instruction conditional logic
    if (conditionalSidebarContext.instructionIndex !== undefined) {
      const field = conditionalSidebarContext.field;
      const instructions = field.instructions || [];
      const updatedInstructions = instructions.map((inst, idx) =>
        idx === conditionalSidebarContext.instructionIndex
          ? { ...inst, conditionalLogic: logic }
          : inst,
      );

      await setElements(
        (Array.isArray(elements) ? elements : []).map((el) =>
          el.id === field.id
            ? { ...el, instructions: updatedInstructions }
            : el,
        ),
      );
    } else {
      await setElements(
        (Array.isArray(elements) ? elements : []).map((el) =>
          el.id === conditionalSidebarContext.field.id
            ? { ...el, conditionalLogic: logic }
            : el,
        ),
      );
    }
    setConditionalSidebarOpen(false);
  };

  const handleClearConditionalLogic = () => {
    if (!conditionalSidebarContext?.field.id) {
      return;
    }

    // Handle instruction conditional logic
    if (conditionalSidebarContext.instructionIndex !== undefined) {
      const field = conditionalSidebarContext.field;
      const instructions = field.instructions || [];
      const updatedInstructions = instructions.map((inst, idx) =>
        idx === conditionalSidebarContext.instructionIndex
          ? { ...inst, conditionalLogic: undefined }
          : inst,
      );

      setElements(
        (Array.isArray(elements) ? elements : []).map((el) =>
          el.id === field.id
            ? { ...el, instructions: updatedInstructions }
            : el,
        ),
      );
    } else {
      setElements(
        (Array.isArray(elements) ? elements : []).map((el) =>
          el.id === conditionalSidebarContext.field.id
            ? { ...el, conditionalLogic: undefined }
            : el,
        ),
      );
    }
  };

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
    [fileUploader, addAttachedFile],
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
    [uploadedFiles, removeAttachedFile],
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

  // Ensure at least one element exists and open sidebar on mount
  useEffect(() => {
    if (Array.isArray(elements) && elements.length === 0) {
      addElementToApp("text");
    }
    setSidebarOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
  const updateElement = useCallback(
    (elementId: string, updates: Partial<Element>) => {
      const current = Array.isArray(elements) ? elements : [];
      setElements(
        current.map((el) => (el.id === elementId ? { ...el, ...updates } : el)),
      );
    },
    [elements, setElements],
  );

  const deleteElement = useCallback(
    (elementId: string) => {
      const current = Array.isArray(elements) ? elements : [];
      setElements(current.filter((el) => el.id !== elementId));
    },
    [elements, setElements],
  );

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
    const existingCount = current.filter((e) => e.type === type).length;

    const base: Element = {
      id: `${type}-${Date.now()}`,
      type: type as Element["type"],
      label: "",
      name: `${type}${existingCount + 1}`,
      isRequired: false,
    };

    const newElement: Element = {
      ...base,
      ...(type === "title" && {
        label: "Title",
        text: "Title",
      }),
      ...(type === "aiResponse" && {
        instructions: [{ text: "" }],
      }),
      ...(type === "fixedResponse" && { text: "" }),
      ...(type === "scoring" && {
        rubric: JSON.stringify([
          {
            criteria: "Category 1",
            lines: [
              { score: 1, description: "" },
              { score: 0, description: "" },
            ],
          },
        ]),
        minScore: 0,
        isRequired: true,
      }),
      ...(type === "imageUpload" && {
        multiple: false,
        maxFiles: 1,
        maxFileSize: 5,
        allowedFileTypes: ["image/jpeg", "image/png"],
      }),
      ...(type === "chat" && {
        maxMessages: 10,
        initialMessage: "Hello! How can I help you today?",
        enableTts: false,
        ttsProvider: "openai",
        selectedVoiceId: "",
        voiceInstructions: "",
        avatarUrl: "",
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
  const updateFieldLabel = (
    fieldId: string,
    newLabel: string,
    _isPrompt: boolean = false,
  ) => {
    // For title elements we also mirror label into text for display.
    updateElement(fieldId, { label: newLabel, text: newLabel });
  };

  /**
   * Updates the internal name/identifier of an element.
   */
  const updateFieldName = (
    fieldId: string,
    newName: string,
    _isPrompt: boolean = false,
  ) => {
    updateElement(fieldId, { name: newName });
  };

  /**
   * Sets whether a field is required for form submission.
   */
  const updateFieldRequired = (
    fieldId: string,
    isRequired: boolean,
    _isPrompt: boolean = false,
  ) => {
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
  const updateFieldDescription = (
    fieldId: string,
    description: string,
    _isPrompt: boolean = false,
  ) => {
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
    _isPrompt: boolean = false,
  ) => {
    updateElement(fieldId, {
      minChars: minChars ?? undefined,
      maxChars: maxChars ?? undefined,
    });
  };

  /**
   * Sets the default value for a field.
   */
  const updateFieldDefaultValue = (
    fieldId: string,
    value: string | string[] | number | boolean,
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
    },
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
   * Updates the type of a field, preserving common properties and resetting type-specific ones.
   */
  const updateFieldType = (fieldId: string, newType: string) => {
    const element = elements.find((el) => el.id === fieldId);
    if (!element) return;

    const baseProperties: any = {
      type: newType,
      id: element.id,
      name: element.name,
      label: element.label,
      description: element.description,
      isRequired: element.isRequired,
      conditionalLogic: element.conditionalLogic,
    };

    const typeSpecificDefaults: any = {};

    switch (newType) {
      case "radio":
      case "checkbox":
      case "dropdown":
        typeSpecificDefaults.choices = [
          { value: "Option 1", text: "Option 1" },
          { value: "Option 2", text: "Option 2" },
        ];
        typeSpecificDefaults.showOther = false;
        break;
      case "slider":
        typeSpecificDefaults.minValue = 0;
        typeSpecificDefaults.maxValue = 100;
        typeSpecificDefaults.step = 1;
        typeSpecificDefaults.defaultValue = 50;
        break;
      case "boolean":
        typeSpecificDefaults.defaultValue = false;
        break;
      case "chat":
        typeSpecificDefaults.maxMessages = 10;
        typeSpecificDefaults.initialMessage = "Hello! How can I help you?";
        typeSpecificDefaults.ttsEnabled = false;
        typeSpecificDefaults.selectedVoiceId = "ash";
        typeSpecificDefaults.ttsProvider = "openai";
        break;
      case "imageUpload":
        typeSpecificDefaults.multiple = false;
        typeSpecificDefaults.maxFiles = 5;
        typeSpecificDefaults.maxFileSize = 5242880; // 5MB
        break;
      case "richText":
        typeSpecificDefaults.html = "<p>Enter your content here...</p>";
        break;
      case "aiResponse":
        typeSpecificDefaults.text = "";
        typeSpecificDefaults.instructions = [];
        break;
      case "fixedResponse":
        typeSpecificDefaults.text = "";
        break;
      case "scoring":
        typeSpecificDefaults.rubric = "";
        typeSpecificDefaults.minScore = 0;
        break;
      case "text":
      case "textarea":
        typeSpecificDefaults.placeholder = "";
        typeSpecificDefaults.defaultValue = "";
        break;
    }

    updateElement(fieldId, { ...baseProperties, ...typeSpecificDefaults });
  };

  /**
   * Updates the text content of a text-based field.
   * Now works with the flattened view by finding the phase automatically.
   */
  const updateFieldText = (
    fieldId: string,
    text: string,
    _isPrompt: boolean = false,
  ) => {
    updateElement(fieldId, { text });
  };

  /**
   * Updates the HTML content of a rich text field.
   * Now works with the flattened view by finding the phase automatically.
   */
  const updateFieldRichText = (
    fieldId: string,
    html: string,
    _isPrompt: boolean = false,
  ) => {
    updateElement(fieldId, { html });
  };

  /**
   * Updates the conditional display logic for a field.
   * Now works with the flattened view by finding the phase automatically.
   */
  const handleUpdateConditionalLogic = (
    fieldId: string,
    logic: ConditionalLogic | null,
    _isPrompt: boolean,
  ) => {
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
    },
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
  const updateFieldInitialMessage = (
    fieldId: string,
    initialMessage: string,
  ) => {
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
      ttsProvider: "openai", //TODO: Support other TTS providers
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
        i === index ? { ...file, description: truncatedDescription } : file,
      ),
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

  useEffect(() => {
    if (!isAppDetailsEditMode) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(event.target as Node)) {
        setIsAppDetailsEditMode(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isAppDetailsEditMode]);

  // Render Additional App Settings content (moved to sidebar)
  const renderAdditionalAppSettings = () => (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium text-left">Collection</label>
        <Select
          value={collectionId?.toString() || ""}
          onValueChange={(value) => setCollectionId(parseInt(value))}
          disabled={isLoadingCollections}
        >
          <SelectTrigger className="w-full">
            <SelectValue
              placeholder={
                isLoadingCollections
                  ? "Loading collections..."
                  : "Select a collection"
              }
            />
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
              <SelectItem value="no-collections" disabled>
                {isLoadingCollections
                  ? "Loading collections..."
                  : "No collections available"}
              </SelectItem>
            )}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-left">
          Privacy Settings
        </label>
        <Select value={privacy} onValueChange={(value) => setPrivacy(value)}>
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
        <label className="text-sm font-medium text-left">
          Completion Message
        </label>
        <textarea
          value={completedHtml}
          onChange={(e) => setCompletedHtml(e.target.value)}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm
            text-gray-900 focus:border-primary focus:ring-primary min-h-[80px] resize-y mb-4"
          placeholder="Enter your message here"
        />
      </div>

      <div className="border-t border-gray-200 pt-4">
        <div className="flex items-center gap-2 mb-4">
          <h3 className="text-sm font-medium text-left uppercase text-gray-500">
            Attached Files
          </h3>
          <TooltipProvider delayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild>
                <HelpCircle className="h-4 w-4 text-gray-400 cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={5}>
                <p className="w-[200px] text-sm">
                  Upload files that will be available to users of your app.
                  Supports PDF, PPT, DOC, TXT, CSV, JSON, and MD files.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        <div
          {...getRootProps()}
          className={`
            mt-2 border-2 border-dashed rounded-lg p-4 transition-colors duration-150 ease-in-out
            ${
              isDragActive
                ? "border-primary-400 bg-primary-50"
                : isUploading
                  ? "border-primary-300 bg-primary-50"
                  : "border-gray-300 hover:border-primary-600"
            }
            ${isUploading ? "cursor-not-allowed" : "cursor-pointer"}
          `}
        >
          <input {...getInputProps()} />
          <div className="text-center">
            <Upload
              className={`mx-auto h-8 w-8 ${
                isDragActive || isUploading
                  ? "text-primary-400"
                  : "text-gray-400"
              }`}
            />
            <p className="mt-2 text-sm text-gray-600">
              {isDragActive
                ? "Drop files here"
                : "Drag and drop files here, or click to select files"}
            </p>
            <p className="mt-1 text-xs text-gray-500">
              PDF, PPT, DOC, TXT, CSV, JSON, MD
            </p>
            <p className="mt-1 text-xs text-gray-500">Max file size: 50MB</p>
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
                      <p className="text-sm font-medium text-gray-700">
                        {file.name}
                      </p>
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
                    value={file.description || ""}
                    onChange={(e) =>
                      updateFileDescription(index, e.target.value)
                    }
                    placeholder="Add a description so the AI understands the content of this file better (optional)"
                    maxLength={MAX_DESCRIPTION_LENGTH}
                    className="w-full px-3 py-1 text-sm border border-gray-200 rounded-md 
                      focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary
                      placeholder:text-gray-400"
                  />
                  <div className="absolute right-2 bottom-1 text-xs text-gray-400">
                    {file.description?.length || 0}/{MAX_DESCRIPTION_LENGTH}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-4 border-t border-gray-200 pt-4">
        <h3 className="text-sm font-medium text-left uppercase text-gray-500">
          AI Configuration
        </h3>
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-left">
              System Prompt
            </label>
            <textarea
              value={aiConfig.systemPrompt}
              onChange={(e) =>
                setAIConfig({ ...aiConfig, systemPrompt: e.target.value })
              }
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm
                text-gray-900 focus:border-primary focus:ring-primary min-h-[80px] resize-y"
              placeholder="Enter your prompt here"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-left">AI Model</label>
            <Select
              value={aiConfig.aiModel}
              onValueChange={(value) =>
                setAIConfig({ ...aiConfig, aiModel: value })
              }
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
              min={availableModels[aiConfig.aiModel || "gpt-4o-mini"]?.min ?? 0}
              max={availableModels[aiConfig.aiModel || "gpt-4o-mini"]?.max ?? 2}
              value={aiConfig.temperature}
              onChange={(e) => {
                const value = parseFloat(e.target.value);
                if (!isNaN(value)) {
                  const min = availableModels[aiConfig.aiModel]?.min ?? 0;
                  const max = availableModels[aiConfig.aiModel]?.max ?? 2;
                  setAIConfig({
                    ...aiConfig,
                    temperature: Math.min(
                      max,
                      Math.max(min, Number(value.toFixed(2))),
                    ),
                  });
                }
              }}
              className="w-full text-sm"
              placeholder={`Enter temperature (${
                availableModels[aiConfig.aiModel]?.min ?? 0
              }-${availableModels[aiConfig.aiModel]?.max ?? 2})`}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-left">
              Max Response Tokens
            </label>
            <Input
              type="number"
              step="1"
              min="1"
              value={aiConfig.maxResponseTokens || ""}
              onChange={(e) => {
                const value = e.target.value ? parseInt(e.target.value) : null;
                setAIConfig({ ...aiConfig, maxResponseTokens: value });
              }}
              className="w-full text-sm"
              placeholder="Leave empty for no limit"
            />
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div
        className={`min-h-screen ${
          backgroundTheme === "gray" ? "bg-gray-100" : "bg-white"
        }`}
      >
        <div className="bg-white border-b border-gray-200 sticky top-0 z-40 h-16">
          <div className="flex items-center h-full px-5 max-w-[1400px] mx-auto relative">
            <div
              className="flex items-center h-full cursor-pointer"
              onClick={() => router.push("/dashboard")}
            >
              <Image
                src={Logo}
                alt="Micro AI"
                width={175}
                height={56}
                className="w-[175px] h-[56px] object-contain"
                priority
              />
            </div>
            <div className="absolute left-1/2 -translate-x-1/2 flex items-center bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setActiveTab("build")}
                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  activeTab === "build"
                    ? "bg-white text-primary shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Build
              </button>
              <button
                onClick={() => setActiveTab("preview")}
                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  activeTab === "preview"
                    ? "bg-white text-primary shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Preview
              </button>
            </div>
            <div className="ml-auto">
              <Button
                variant="ghost"
                onClick={() => router.push("/dashboard")}
                className="text-primary hover:text-primary/80 flex items-center gap-2"
              >
                <X className="h-4 w-4 mr-1" />
                <span className="text-base">Back to Home page</span>
              </Button>
            </div>
          </div>
        </div>

        {activeTab === "build" && !sidebarOpen && (
          <div className="flex">
            <AnimatePresence>
              <motion.button
                key="sidebar-open"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                onClick={() => setSidebarOpen(true)}
                className={`
                  fixed left-6 top-[96px] z-30 flex items-center
                  bg-white p-2 rounded-full shadow-sm hover:bg-gray-100 transition-colors
                  ${
                    !conditionalSidebarOpen
                      ? "xl:bg-white xl:border xl:border-gray-200 xl:rounded-md xl:shadow-sm xl:px-3 xl:py-3 xl:hover:bg-gray-50 xl:gap-2"
                      : ""
                  }
                  `}
                aria-label="Open sidebar"
              >
                {!conditionalSidebarOpen && (
                  <span className="hidden xl:inline text-[16px] font-semibold text-black whitespace-nowrap mb-1">
                    App settings
                  </span>
                )}
                <PanelLeft className="h-6 w-6 text-gray-400" />
              </motion.button>
            </AnimatePresence>
          </div>
        )}
        <div className="flex-1 flex">
          {activeTab === "build" && sidebarOpen && (
            <div className="w-80 bg-white border-r border-gray-300 sticky top-16 self-start h-screen flex flex-col transition-all duration-300 z-30">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-300 bg-white">
                <span className="text-sm font-medium text-black">
                  App settings
                </span>
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                  aria-label="Close sidebar"
                >
                  <PanelRightClose className="h-5 w-5 text-gray-600" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                <div className="p-4 pb-20">{renderAdditionalAppSettings()}</div>
              </div>
            </div>
          )}

          <div className="flex-1 flex justify-center">
            <div className="w-full max-w-[900px] px-2 sm:px-4">
              {activeTab === "build" ? (
                <div className="pt-8 pb-24">
                  <>
                    {/* This motion.div animates the App Details card when switching between edit and preview modes,
                      as well as when its layout changes.
                      The 'layout' prop enables smooth transitions for position and size changes,
                      and the custom spring transition provides a natural, responsive feel. */}
                    <motion.div
                      ref={cardRef}
                      layout={!isAppDetailsEditMode}
                      initial={false}
                      className={`mb-4 rounded-lg bg-white p-5 group transition-shadow duration-200 min-h-[160px]`}
                      onClick={() => {
                        if (!isAppDetailsEditMode)
                          setIsAppDetailsEditMode(true);
                      }}
                      transition={{
                        duration: 0.3,
                        ease: "easeInOut",
                      }}
                    >
                      <div className="flex items-center gap-2 mb-4">
                        <h3 className="text-sm font-medium text-gray-500">
                          App Details
                        </h3>
                        <TooltipProvider delayDuration={0}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <HelpCircle className="h-4 w-4 text-gray-400 cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent side="right" sideOffset={5}>
                              <p className="w-[200px] text-sm">
                                Provide a name and a description for your app
                                that will be displayed to users.
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>

                      <AnimatePresence mode="wait">
                        {isAppDetailsEditMode ? (
                          <motion.div
                            key="edit"
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{
                              duration: 0.4,
                              ease: [0.4, 0, 0.2, 1],
                            }}
                          >
                            <motion.div
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              transition={{ delay: 0.1, duration: 0.3 }}
                            >
                              <input
                                type="text"
                                value={title}
                                onFocus={() => {
                                  if (title === "Untitled App") setTitle("");
                                }}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => setTitle(e.target.value)}
                                className="font-semibold bg-transparent border border-gray-200 px-4 py-2 w-full mb-4 focus:outline-none focus:border-gray-200 focus:ring-0 text-xl"
                                style={{ fontSize: 24 }}
                                placeholder="Untitled App"
                              />
                              <textarea
                                value={description}
                                onFocus={() => {
                                  if (
                                    description ===
                                    "Tell the user what your app does..."
                                  )
                                    setDescription("");
                                }}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => setDescription(e.target.value)}
                                className="text-sm bg-transparent w-full border border-gray-200 px-4 py-2 min-h-[100px] resize-y focus:outline-none focus:border-gray-200 focus:ring-0"
                                placeholder="Tell the user what your app does..."
                              />
                            </motion.div>
                          </motion.div>
                        ) : (
                          <motion.div
                            key="preview"
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 10 }}
                            transition={{ duration: 0.18 }}
                          >
                            <div className="font-semibold text-2xl mb-2 text-gray-900">
                              {title || "Untitled App"}
                            </div>
                            <div className="text-sm text-gray-600">
                              {description ||
                                "Here you can write the description about your app"}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>

                    <div className="flex flex-col min-h-[calc(100vh-320px)]">
                      <div className="flex-1">
                        <LayoutGroup>
                          <Droppable droppableId="all-elements" type="element">
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.droppableProps}
                                className={`min-h-[200px] transition-colors ${
                                  snapshot.isDraggingOver ? "bg-primary/5" : ""
                                }`}
                              >
                                {(() => {
                                  const visibleElements = Array.isArray(
                                    elements,
                                  )
                                    ? elements
                                    : [];

                                  return visibleElements.map(
                                    (element, index, array) => {
                                      const isLastElement =
                                        index === array.length - 1;

                                      return (
                                        <React.Fragment key={element.id}>
                                          <Draggable
                                            draggableId={element.id}
                                            index={index}
                                          >
                                            {(
                                              providedDraggable,
                                              snapshotDraggable,
                                            ) => (
                                              <motion.div
                                                layout={
                                                  !snapshotDraggable.isDragging
                                                    ? "position"
                                                    : false
                                                }
                                                transition={{
                                                  duration: 0.3,
                                                  ease: "easeInOut",
                                                }}
                                                initial={false}
                                                style={{
                                                  ...providedDraggable
                                                    .draggableProps.style,
                                                  ...(snapshotDraggable.isDragging
                                                    ? {}
                                                    : { transform: "none" }),
                                                }}
                                                ref={providedDraggable.innerRef}
                                                {...providedDraggable.draggableProps}
                                                className={`${
                                                  snapshotDraggable.isDragging
                                                    ? "opacity-80"
                                                    : ""
                                                }`}
                                              >
                                                <Field
                                                  field={element}
                                                  index={index}
                                                  phaseFields={visibleElements}
                                                  appFields={visibleElements}
                                                  appId={appId}
                                                  dragHandleProps={
                                                    providedDraggable.dragHandleProps
                                                  }
                                                  isActive={
                                                    activeFieldId === element.id
                                                  }
                                                  onActivate={() =>
                                                    setActiveFieldId(element.id)
                                                  }
                                                  onDeactivate={() =>
                                                    setActiveFieldId(undefined)
                                                  }
                                                  onUpdateFieldLabel={(
                                                    fieldId,
                                                    newLabel,
                                                    isPrompt,
                                                  ) =>
                                                    updateFieldLabel(
                                                      fieldId,
                                                      newLabel,
                                                      isPrompt,
                                                    )
                                                  }
                                                  onUpdateFieldName={(
                                                    fieldId,
                                                    newName,
                                                    isPrompt,
                                                  ) =>
                                                    updateFieldName(
                                                      fieldId,
                                                      newName,
                                                      isPrompt,
                                                    )
                                                  }
                                                  onUpdateFieldType={(
                                                    fieldId,
                                                    newType,
                                                  ) =>
                                                    updateFieldType(
                                                      fieldId,
                                                      newType,
                                                    )
                                                  }
                                                  onDeleteField={(
                                                    fieldId,
                                                    isPrompt,
                                                  ) =>
                                                    deleteField(
                                                      fieldId,
                                                      isPrompt,
                                                    )
                                                  }
                                                  onUpdateFieldDescription={(
                                                    fieldId,
                                                    description,
                                                    isPrompt,
                                                  ) =>
                                                    updateFieldDescription(
                                                      fieldId,
                                                      description,
                                                      isPrompt,
                                                    )
                                                  }
                                                  onUpdateFieldRequired={(
                                                    fieldId,
                                                    required,
                                                    isPrompt,
                                                  ) =>
                                                    updateFieldRequired(
                                                      fieldId,
                                                      required,
                                                      isPrompt,
                                                    )
                                                  }
                                                  onUpdateFieldValidation={(
                                                    fieldId,
                                                    minChars,
                                                    maxChars,
                                                    isPrompt,
                                                  ) =>
                                                    updateFieldValidation(
                                                      fieldId,
                                                      minChars,
                                                      maxChars,
                                                      isPrompt,
                                                    )
                                                  }
                                                  onUpdateFieldDefaultValue={(
                                                    fieldId,
                                                    defaultValue,
                                                  ) =>
                                                    updateFieldDefaultValue(
                                                      fieldId,
                                                      defaultValue,
                                                    )
                                                  }
                                                  onUpdateFieldPlaceholder={(
                                                    fieldId,
                                                    placeholder,
                                                  ) =>
                                                    updateFieldPlaceholder(
                                                      fieldId,
                                                      placeholder,
                                                    )
                                                  }
                                                  onUpdateFieldChoices={(
                                                    fieldId,
                                                    choices,
                                                  ) =>
                                                    updateFieldChoices(
                                                      fieldId,
                                                      choices,
                                                    )
                                                  }
                                                  onUpdateFieldShowOther={(
                                                    fieldId,
                                                    showOther,
                                                  ) =>
                                                    updateFieldShowOther(
                                                      fieldId,
                                                      showOther,
                                                    )
                                                  }
                                                  onUpdateFieldSliderProps={(
                                                    fieldId,
                                                    updates,
                                                  ) =>
                                                    updateFieldSliderProps(
                                                      fieldId,
                                                      updates,
                                                    )
                                                  }
                                                  onUpdateFieldSliderValue={(
                                                    fieldId,
                                                    value,
                                                  ) =>
                                                    updateFieldSliderValue(
                                                      fieldId,
                                                      value,
                                                    )
                                                  }
                                                  onUpdatePromptText={(
                                                    fieldId,
                                                    text,
                                                  ) =>
                                                    updateFieldText(
                                                      fieldId,
                                                      text,
                                                      true,
                                                    )
                                                  }
                                                  onUpdateRichText={(
                                                    fieldId,
                                                    html,
                                                  ) =>
                                                    updateFieldRichText(
                                                      fieldId,
                                                      html,
                                                      false,
                                                    )
                                                  }
                                                  onUpdateConditionalLogic={(
                                                    fieldId,
                                                    logic,
                                                  ) =>
                                                    handleUpdateConditionalLogic(
                                                      fieldId,
                                                      logic,
                                                      false,
                                                    )
                                                  }
                                                  onUpdateAiResponseInstructions={(
                                                    fieldId,
                                                    instructions,
                                                  ) =>
                                                    updateElement(fieldId, {
                                                      instructions,
                                                    })
                                                  }
                                                  onUpdateScoringSettings={(
                                                    fieldId,
                                                    updates,
                                                  ) =>
                                                    updateElement(
                                                      fieldId,
                                                      updates,
                                                    )
                                                  }
                                                  onUpdateImageUploadSettings={(
                                                    fieldId,
                                                    settings,
                                                  ) =>
                                                    updateImageUploadSettings(
                                                      fieldId,
                                                      settings,
                                                    )
                                                  }
                                                  onUpdateFieldMaxMessages={(
                                                    fieldId,
                                                    maxMessages,
                                                  ) =>
                                                    updateFieldMaxMessages(
                                                      fieldId,
                                                      maxMessages,
                                                    )
                                                  }
                                                  onUpdateFieldInitialMessage={(
                                                    fieldId,
                                                    initialMessage,
                                                  ) =>
                                                    updateFieldInitialMessage(
                                                      fieldId,
                                                      initialMessage,
                                                    )
                                                  }
                                                  onUpdateChatbotInstructions={(
                                                    fieldId,
                                                    instructions,
                                                  ) =>
                                                    updateChatbotInstructions(
                                                      fieldId,
                                                      instructions,
                                                    )
                                                  }
                                                  onUpdateTtsProvider={(
                                                    fieldId,
                                                    provider,
                                                  ) =>
                                                    updateTtsProvider(
                                                      fieldId,
                                                      provider,
                                                    )
                                                  }
                                                  onUpdateTtsVoiceId={(
                                                    fieldId,
                                                    voiceId,
                                                  ) =>
                                                    updateTtsVoiceId(
                                                      fieldId,
                                                      voiceId,
                                                    )
                                                  }
                                                  onUpdateTtsEnabled={(
                                                    fieldId,
                                                    enabled,
                                                  ) =>
                                                    updateTtsEnabled(
                                                      fieldId,
                                                      enabled,
                                                    )
                                                  }
                                                  onUpdateVoiceInstructions={(
                                                    fieldId,
                                                    instructions,
                                                  ) =>
                                                    updateVoiceInstructions(
                                                      fieldId,
                                                      instructions,
                                                    )
                                                  }
                                                  onUpdateAvatarUrl={(
                                                    fieldId,
                                                    avatarUrl,
                                                  ) =>
                                                    updateAvatarUrl(
                                                      fieldId,
                                                      avatarUrl,
                                                    )
                                                  }
                                                  isDragging={
                                                    snapshotDraggable.isDragging
                                                  }
                                                  appHashId={hashId}
                                                />
                                              </motion.div>
                                            )}
                                          </Draggable>

                                          {/* Plus button between cards on its own line with always-visible silver line */}
                                          {!isLastElement && (
                                            <div className="relative flex items-center justify-center h-4 my-1 w-full group">
                                              <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-px bg-gray-300 transition-opacity duration-200 opacity-0 group-hover:opacity-100" />{" "}
                                              <button
                                                className="absolute left-0 w-full h-4 bg-transparent border-none outline-none cursor-pointer z-10 opacity-0 group-hover:opacity-100 transition-opacity"
                                                tabIndex={-1}
                                                aria-label="Add section"
                                                onClick={(e) => {
                                                  setPopoverPosition({
                                                    x: e.clientX,
                                                    y: e.clientY - 400,
                                                  });
                                                  setAddSectionOpenFor(
                                                    `between-${element.id}`,
                                                  );
                                                  setInsertAfterIndex(index);
                                                }}
                                                type="button"
                                              />
                                              <Popover
                                                open={
                                                  addSectionOpenFor ===
                                                  `between-${element.id}`
                                                }
                                                onOpenChange={(open) => {
                                                  setAddSectionOpenFor(
                                                    open
                                                      ? `between-${element.id}`
                                                      : null,
                                                  );
                                                  if (!open) {
                                                    setInsertAfterIndex(null);
                                                  }
                                                }}
                                              >
                                                <PopoverTrigger asChild>
                                                  <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="absolute top-1/2 -translate-y-1/2 -left-5 h-6 w-6 rounded-full p-0 bg-gray-100 border-2 border-gray-300 hover:border-gray-400 hover:bg-primary/5 z-10 transition-opacity duration-200 opacity-0 group-hover:opacity-100"
                                                    onClick={() => {
                                                      setInsertAfterIndex(
                                                        index,
                                                      );
                                                    }}
                                                  >
                                                    <Plus className="h-3 w-3" />
                                                  </Button>
                                                </PopoverTrigger>
                                                <PopoverContent
                                                  align="center"
                                                  side="bottom"
                                                  className="w-72 p-2"
                                                  style={
                                                    popoverPosition
                                                      ? {
                                                          position: "fixed",
                                                          left: popoverPosition.x,
                                                        }
                                                      : undefined
                                                  }
                                                >
                                                  <div className="space-y-1">
                                                    {availableSections.map(
                                                      (section) => {
                                                        const Icon =
                                                          section.icon;
                                                        return (
                                                          <button
                                                            key={section.id}
                                                            onClick={() => {
                                                              addElementToApp(
                                                                section.id,
                                                                insertAfterIndex,
                                                              );
                                                              setAddSectionOpenFor(
                                                                null,
                                                              );
                                                            }}
                                                            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-gray-100 transition-colors text-left"
                                                          >
                                                            <Icon className="h-4 w-4 text-gray-500 flex-shrink-0" />
                                                            <div className="flex-1 min-w-0">
                                                              <div className="text-xs font-medium text-gray-900">
                                                                {section.label}
                                                              </div>
                                                            </div>
                                                            <TooltipProvider
                                                              delayDuration={0}
                                                            >
                                                              <Tooltip>
                                                                <TooltipTrigger
                                                                  asChild
                                                                >
                                                                  <HelpCircle className="h-4 w-4 text-gray-400" />
                                                                </TooltipTrigger>
                                                                <TooltipContent side="right">
                                                                  <p className="max-w-xs text-xs">
                                                                    {
                                                                      section.helper
                                                                    }
                                                                  </p>
                                                                </TooltipContent>
                                                              </Tooltip>
                                                            </TooltipProvider>
                                                          </button>
                                                        );
                                                      },
                                                    )}
                                                  </div>
                                                </PopoverContent>
                                              </Popover>
                                            </div>
                                          )}
                                        </React.Fragment>
                                      );
                                    },
                                  );
                                })()}
                                {provided.placeholder}

                                {/* Add Section button at the end */}
                                <div className="mt-4 flex justify-start">
                                  <Popover
                                    open={addSectionOpenFor === "end-button"}
                                    onOpenChange={(open) => {
                                      setAddSectionOpenFor(
                                        open ? "end-button" : null,
                                      );
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
                                        onClick={() =>
                                          setInsertAfterIndex(null)
                                        }
                                      >
                                        <Plus className="h-5 w-5 mr-2" />
                                        Add Section
                                      </Button>
                                    </PopoverTrigger>
                                    <PopoverContent
                                      align="start"
                                      side="bottom"
                                      className="w-72 p-2"
                                    >
                                      <div className="space-y-1">
                                        {availableSections.map((section) => {
                                          const Icon = section.icon;
                                          return (
                                            <button
                                              key={section.id}
                                              onClick={() => {
                                                addElementToApp(
                                                  section.id,
                                                  insertAfterIndex,
                                                );
                                                setAddSectionOpenFor(null);
                                              }}
                                              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-gray-100 transition-colors text-left"
                                            >
                                              <Icon className="h-4 w-4 text-gray-500 flex-shrink-0" />
                                              <div className="flex-1 min-w-0">
                                                <div className="text-xs font-medium text-gray-900">
                                                  {section.label}
                                                </div>
                                              </div>
                                              <TooltipProvider
                                                delayDuration={0}
                                              >
                                                <Tooltip>
                                                  <TooltipTrigger asChild>
                                                    <HelpCircle className="h-4 w-4 text-gray-400" />
                                                  </TooltipTrigger>
                                                  <TooltipContent side="right">
                                                    <p className="max-w-xs text-xs">
                                                      {section.helper}
                                                    </p>
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
                        </LayoutGroup>
                      </div>
                      <div className="mt-8">
                        <Collapsible
                          open={isOpen}
                          onOpenChange={setIsOpen}
                          className="!mt-8"
                        >
                          <Card>
                            <CollapsibleTrigger asChild>
                              <Button
                                variant="ghost"
                                className="w-full flex items-center justify-between p-4"
                              >
                                <span className="text-lg font-semibold">
                                  JSON Preview
                                </span>
                                <ChevronDown
                                  className={`h-4 w-4 transition-transform ${
                                    isOpen ? "transform rotate-180" : ""
                                  }`}
                                />
                              </Button>
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                              <div className="p-4 border-t">
                                <JsonPreview
                                  elements={
                                    Array.isArray(elements) ? elements : []
                                  }
                                  title={title || ""}
                                  description={description || ""}
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
                    </div>
                  </>
                </div>
              ) : (
                <MonitorPreview
                  previewUrl={`${window.location.origin}/app/${hashId}`}
                >
                  <AppRuntimeView hashId={hashId} />
                </MonitorPreview>
              )}
            </div>
          </div>
          <ConditionalLogicSidebar
            isOpen={conditionalSidebarOpen}
            onClose={() => setConditionalSidebarOpen(false)}
            onSave={handleSaveConditionalLogic}
            onClear={handleClearConditionalLogic}
            availableFields={Array.isArray(elements) ? elements : []}
            currentLogic={conditionalSidebarContext?.currentLogic}
            targetFieldName={conditionalSidebarContext?.field.name}
            instructionIndex={conditionalSidebarContext?.instructionIndex}
          />
        </div>
      </div>
    </DragDropContext>
  );
}
