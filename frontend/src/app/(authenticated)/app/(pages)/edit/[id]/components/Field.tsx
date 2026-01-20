"use client";

import { CirclePlus, CircleMinus, Repeat2, User } from "lucide-react";
import React, { useEffect, useState } from "react";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { RadioGroup, RadioGroupItem } from "./ui/radio-group";
import RenderQuestion from "@/components/RenderQuestion";
import { Checkbox } from "./ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Switch } from "./ui/switch";
import { Slider } from "./ui/slider";
import { Button } from "./ui/button";
import { Trash2 } from "lucide-react";
import { DraggableProvidedDragHandleProps } from "@hello-pangea/dnd";
import PromptField from "./fields/PromptField";
import AIResponseField from "./fields/AIResponseField";
import { RichText } from "./fields/RichText";
import { createImageUploader } from "@/utils/imageUpload";
import {
  Element,
  ConditionalLogic,
  ElementInstruction,
  Choice,
} from "@/app/(authenticated)/app/types";
import { useUserStore } from "@/store/userStore";
import FieldHeader from "./shared/FieldHeader";
import Image from "next/image";
import {
  Type,
  AlignLeft,
  CircleDot,
  CheckSquare,
  List,
  SlidersHorizontal,
  ToggleLeft,
  MessageSquare,
  FileText,
  Bot,
  MessageCircle,
  ImagePlus,
  MessagesSquare,
} from "lucide-react";
import { synthesizeSpeech } from "@/utils/textToSpeechService";
import { Play, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import InstructionConditionBox from "./shared/InstructionConditionBox";

const FIELD_ICONS: Record<
  string,
  React.ComponentType<{ className?: string }>
> = {
  text: Type,
  textarea: AlignLeft,
  radio: CircleDot,
  checkbox: CheckSquare,
  dropdown: List,
  slider: SlidersHorizontal,
  boolean: ToggleLeft,
  richText: FileText,
  imageUpload: ImagePlus,
  chat: MessagesSquare,
  prompt: MessageSquare,
  aiInstructions: Bot,
  fixedResponse: MessageCircle,
  aiResponse: MessageCircle,
  scoring: SlidersHorizontal,
  title: Type,
};

const FIELD_LABELS: Record<string, string> = {
  text: "Single Line",
  textarea: "Long Text",
  radio: "Radio Buttons",
  checkbox: "Checkboxes",
  dropdown: "Dropdown",
  slider: "Slider",
  boolean: "Boolean",
  richText: "Rich Text",
  imageUpload: "Image Upload",
  chat: "Chatbot",
  prompt: "Prompt",
  aiInstructions: "AI Instructions",
  fixedResponse: "Fixed Response",
  aiResponse: "AI Response",
  scoring: "Scoring",
  title: "Title",
};

interface VoiceOption {
  id: string;
  name: string;
  description: string;
  avatarUrl: string;
}

const VOICE_OPTIONS: VoiceOption[] = [
  {
    id: "shimmer",
    name: "Shimmer",
    description: "A bright, energetic voice perfect for engaging users",
    avatarUrl: "/img/voices/shimmer.png",
  },
  {
    id: "ash",
    name: "Ash",
    description: "A warm, friendly voice with a natural conversational tone",
    avatarUrl: "/img/voices/ash.png",
  },

  {
    id: "onyx",
    name: "Onyx",
    description: "Deep, smooth, masculine",
    avatarUrl: "/img/voices/onyx.png",
  },
  {
    id: "nova",
    name: "Nova",
    description: "Youthful, clear, gender-neutral",
    avatarUrl: "/img/voices/nova.png",
  },
];

interface FieldProps {
  field: Element;
  index: number;
  phaseFields: Element[];
  appFields: Element[];
  appId: number | null;
  // Indicates whether the field/card is currently active (in edit mode)
  // Used to control edit/view state
  isActive?: boolean;
  dragHandleProps?: DraggableProvidedDragHandleProps | null;
  onUpdateFieldLabel: (
    fieldId: string,
    newLabel: string,
    isPrompt: boolean,
  ) => void;
  onUpdateFieldName: (
    fieldId: string,
    newName: string,
    isPrompt: boolean,
  ) => void;
  onUpdateFieldType?: (fieldId: string, newType: string) => void;
  onDeleteField: (fieldId: string, isPrompt: boolean) => void;
  onUpdateFieldDescription: (
    fieldId: string,
    description: string,
    isPrompt: boolean,
  ) => void;
  onUpdateFieldRequired: (
    fieldId: string,
    isRequired: boolean,
    isPrompt: boolean,
  ) => void;
  onUpdateFieldValidation: (
    fieldId: string,
    minChars: number | null,
    maxChars: number | null,
    isPrompt: boolean,
  ) => void;
  onUpdatePromptText?: (fieldId: string, text: string) => void;
  onUpdateAiResponseInstructions?: (
    fieldId: string,
    instructions: ElementInstruction[],
  ) => void;
  onUpdateScoringSettings?: (
    fieldId: string,
    updates: { rubric?: string; minScore?: number },
  ) => void;
  onUpdateFieldDefaultValue: (
    fieldId: string,
    defaultValue: string | string[] | number | boolean,
  ) => void;
  onUpdateFieldPlaceholder: (fieldId: string, placeholder: string) => void;
  onUpdateFieldChoices: (fieldId: string, choices: Choice[]) => void;
  onUpdateFieldShowOther: (fieldId: string, showOther: boolean) => void;
  onUpdateFieldSliderValue: (fieldId: string, value: number) => void;
  onUpdateFieldSliderProps: (
    fieldId: string,
    updates: { minValue?: number; maxValue?: number; step?: number },
  ) => void;
  onUpdateConditionalLogic?: (
    fieldId: string,
    logic: ConditionalLogic | null,
  ) => void;
  onUpdateRichText?: (fieldId: string, html: string) => void;
  onUpdateImageUploadSettings?: (
    fieldId: string,
    settings: {
      multiple?: boolean;
      maxFiles?: number;
      maxFileSize?: number;
      allowedFileTypes?: string[];
    },
  ) => void;
  onUpdateFieldMaxMessages?: (fieldId: string, maxMessages: number) => void;
  onUpdateFieldInitialMessage?: (
    fieldId: string,
    initialMessage: string,
  ) => void;
  onUpdateChatbotInstructions?: (
    fieldId: string,
    chatbotInstructions: string,
  ) => void;
  onUpdateTtsProvider?: (fieldId: string, provider: string) => void;
  onUpdateTtsVoiceId?: (fieldId: string, voiceId: string) => void;
  onUpdateTtsEnabled?: (fieldId: string, enabled: boolean) => void;
  onUpdateVoiceInstructions?: (fieldId: string, instructions: string) => void;
  onUpdateAvatarUrl?: (fieldId: string, avatarUrl: string) => void;
  isDragging?: boolean;
  onActivate?: () => void;
  onDeactivate?: () => void;
}

export default function Field({
  field,
  phaseFields,
  appFields,
  appId,
  dragHandleProps,
  onUpdateFieldLabel,
  onUpdateFieldName,
  onUpdateFieldType,
  onUpdateFieldRequired,
  onDeleteField,
  onUpdateFieldDescription,
  onUpdateFieldValidation,
  onUpdatePromptText,
  onUpdateAiResponseInstructions,
  onUpdateScoringSettings,
  onUpdateFieldDefaultValue,
  onUpdateFieldPlaceholder,
  onUpdateFieldChoices,
  onUpdateFieldShowOther,
  onUpdateFieldSliderValue,
  onUpdateFieldSliderProps,
  onUpdateConditionalLogic,
  onUpdateRichText,
  onUpdateImageUploadSettings,
  onUpdateFieldMaxMessages,
  onUpdateFieldInitialMessage,
  onUpdateChatbotInstructions,
  onUpdateTtsVoiceId,
  onUpdateTtsEnabled,
  onUpdateVoiceInstructions,
  onUpdateAvatarUrl,
  onActivate,
  onDeactivate,
  isDragging = false,
  isActive = false,
}: FieldProps) {
  const { user } = useUserStore();
  const [isValidationExpanded, setValidationExpanded] = useState(
    !!field.minChars || !!field.maxChars,
  );
  const [choices, setChoices] = useState<Choice[]>(field.choices || []);
  const [selectedCheckboxes, setSelectedCheckboxes] = useState<string[]>([]);
  const [otherCheckboxValue, setOtherCheckboxValue] = useState("");
  const [sliderMin, setSliderMin] = useState(0);
  const [sliderMax, setSliderMax] = useState(100);
  const [sliderDefault, setSliderDefault] = useState(50);
  const [sliderStep, setSliderStep] = useState(1);
  const [showDescription, setShowDescription] = useState(false);
  const [previewAnswers, setPreviewAnswers] = useState<Record<string, any>>({});
  const fieldRef = React.useRef<HTMLDivElement>(null);

  // Handle click outside to exit edit mode
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Ignore clicks inside Radix Select content and any open Radix poppers,
      // because their click events are bubbled to the document.
      const poppers = document.querySelectorAll(
        "[data-radix-popper-content-wrapper]",
      );
      if (poppers.length > 0) {
        return;
      }

      // Ignore clicks inside conditional logic sidebar
      const conditionalLogicSidebar = document.getElementById(
        "conditional-logic-sidebar",
      );
      if (
        conditionalLogicSidebar &&
        conditionalLogicSidebar.contains(event?.target as Node)
      ) {
        return;
      }

      if (
        isActive &&
        fieldRef.current &&
        !fieldRef.current.contains(event.target as Node)
      ) {
        if (onDeactivate) onDeactivate();
      }
    };

    document.addEventListener("pointerdown", handleClickOutside, {
      capture: true,
    });
    return () => {
      document.removeEventListener("pointerdown", handleClickOutside, {
        capture: true,
      });
    };
  }, [isActive, onDeactivate]);

  // Voice sample caching
  const [cachedVoiceSamples, setCachedVoiceSamples] = useState<
    Record<string, string>
  >({});
  const [isGeneratingSample, setIsGeneratingSample] = useState(false);

  const fieldCondition =
    field.conditionalLogic &&
    phaseFields.find((f) => f.id === field.conditionalLogic?.sourceFieldId);

  // Create a cache key for the current voice configuration
  const getVoiceCacheKey = () => {
    const sampleText =
      field.initialMessage ||
      "Hello! This is a sample of my voice. I hope you like it!";
    return `${field.selectedVoiceId || "ash"}-${
      field.ttsProvider || "openai"
    }-${field.voiceInstructions || ""}-${sampleText}`;
  };

  const currentCacheKey = getVoiceCacheKey();
  const hasCachedSample = !!cachedVoiceSamples[currentCacheKey];

  const handleAddOption = () => {
    const newChoices = [
      ...choices,
      {
        value: `Item ${choices.length + 1}`,
        text: `Option ${choices.length + 1}`,
      },
    ];
    setChoices(newChoices);
    onUpdateFieldChoices(field.id, newChoices);
  };

  const handleDeleteOption = (index: number) => {
    const newChoices = choices.filter((_, i) => i !== index);
    setChoices(newChoices);
    onUpdateFieldChoices(field.id, newChoices);
  };

  const handleUpdateOption = (index: number, newText: string) => {
    const newChoices = choices.map((choice, i) =>
      i === index ? { ...choice, text: newText } : choice,
    );
    setChoices(newChoices);
    onUpdateFieldChoices(field.id, newChoices);
  };

  const toggleCheckbox = (optionId: string) => {
    setSelectedCheckboxes((prev) =>
      prev.includes(optionId)
        ? prev.filter((id) => id !== optionId)
        : [...prev, optionId],
    );
  };

  const handleAvatarUpload = async (file: File) => {
    if (!appId) return;

    try {
      const imageUploader = createImageUploader(appId.toString());
      const result = await imageUploader.uploadFile(file);
      if (result.url && onUpdateAvatarUrl) {
        onUpdateAvatarUrl(field.id, result.url);
      }
    } catch (error) {
      console.error("Error uploading avatar:", error);
    }
  };

  const isPromptType =
    field.type === "prompt" ||
    field.type === "aiInstructions" ||
    field.type === "fixedResponse" ||
    field.type === "aiResponse";
  const isSpecialType = isPromptType || field.type === "richText";

  const handlePreviewInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) => {
    const { name, value } = e.target;
    setPreviewAnswers((prev) => ({
      ...prev,
      [name]: { value },
    }));
  };

  const handlePreviewSetInputValue = (
    name: string,
    value: string | string[] | undefined,
    otherValue: string,
  ) => {
    setPreviewAnswers((prev) => ({
      ...prev,
      [name]: { value, otherValue },
    }));
  };

  const renderFieldEdit = () => {
    // Legacy prompt-related types + V2 fixed response
    if (
      field.type === "prompt" ||
      field.type === "aiInstructions" ||
      field.type === "fixedResponse"
    ) {
      return (
        <PromptField
          field={{
            id: field.id,
            name: field.name,
            type: field.type,
            text: field.text,
          }}
          fields={appFields}
          onChange={onUpdatePromptText}
          isPreviewMode={!isActive}
        />
      );
    } else if (field.type === "aiResponse") {
      return (
        <AIResponseField
          field={{
            id: field.id,
            name: field.name,
            type: "aiResponse",
            text: field.text,
            instructions: field.instructions,
            conditionalLogic: field.conditionalLogic,
          }}
          fields={appFields}
          onChange={(fieldId, text, instructions) => {
            onUpdatePromptText?.(fieldId, text);
            if (instructions) {
              onUpdateAiResponseInstructions?.(fieldId, instructions);
            }
          }}
          onRequiredChange={(isRequired) =>
            onUpdateFieldRequired(field.id, isRequired, true)
          }
          onConditionalLogicChange={(logic) =>
            onUpdateConditionalLogic?.(field.id, logic)
          }
          isPreviewMode={!isActive}
        />
      );
    }

    if (field.type === "title") {
      return (
        <Input
          placeholder="Enter title..."
          value={field.text || field.label || ""}
          onChange={(e) => onUpdateFieldLabel(field.id, e.target.value, false)}
        />
      );
    }

    if (field.type === "scoring") {
      return (
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-sm">Minimum score</Label>
            <Input
              type="number"
              value={typeof field.minScore === "number" ? field.minScore : 0}
              onChange={(e) =>
                onUpdateScoringSettings?.(field.id, {
                  minScore: Number(e.target.value || 0),
                })
              }
            />
          </div>
          <div className="space-y-1">
            <Label className="text-sm">Rubric</Label>
            <Textarea
              value={field.rubric || ""}
              placeholder="Enter rubric..."
              onChange={(e) =>
                onUpdateScoringSettings?.(field.id, { rubric: e.target.value })
              }
              className="min-h-[160px]"
            />
          </div>
        </div>
      );
    }

    // Handle all other field types
    switch (field.type) {
      case "text":
        return (
          <>
            <Input
              className="text-md bg-gray-100 border border-gray-200 focus:border-gray-600 px-2 py-1 transition-colors focus:outline-none focus:ring-0 w-full cursor-text"
              placeholder={
                field.placeholder ||
                "Your user can enter a short response here... "
              }
              onChange={(e) =>
                onUpdateFieldPlaceholder(field.id, e.target.value)
              }
            />
            {(field.minChars || field.maxChars) && (
              <div className="text-xs text-gray-500 mt-1">
                {field.minChars && `Minimum ${field.minChars} characters`}
                {field.minChars && field.maxChars && " · "}
                {field.maxChars && `Maximum ${field.maxChars} characters`}
              </div>
            )}
          </>
        );
      case "textarea":
        return (
          <Textarea
            placeholder={
              field.placeholder ||
              "Your user can enter a longer response here... "
            }
            onChange={(e) => onUpdateFieldPlaceholder(field.id, e.target.value)}
          />
        );
      case "radio":
        return (
          <div>
            <RadioGroup
              value={
                typeof field.defaultValue === "string" ? field.defaultValue : ""
              }
              onValueChange={(value) => {
                const newValue =
                  value === field.defaultValue ? undefined : value;
                onUpdateFieldDefaultValue(field.id, newValue as string);
              }}
            >
              {choices.map((choice, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <RadioGroupItem
                    value={choice.value}
                    id={choice.value}
                    onClick={(e) => {
                      if (field.defaultValue === choice.value) {
                        e.preventDefault();
                        onUpdateFieldDefaultValue(
                          field.id,
                          undefined as unknown as string,
                        );
                      }
                    }}
                  />
                  <input
                    type="text"
                    value={choice.text}
                    onChange={(e) => handleUpdateOption(index, e.target.value)}
                    className="text-sm bg-transparent border border-gray-200 rounded px-2 py-1"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteOption(index)}
                    className="text-gray-400 hover:text-red-500"
                  >
                    <Trash2 className="h-4 w-4 " />
                  </Button>
                </div>
              ))}
              {field.showOtherItem && (
                <div className="flex items-center space-x-2 mt-2">
                  <RadioGroupItem value="other" id="other" />
                  <Label htmlFor="other">Other</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onUpdateFieldShowOther(field.id, false)}
                    className="text-gray-400 hover:text-red-500"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </RadioGroup>
            <div className="flex space-x-2 mt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleAddOption}
                className="text-blue-500 hover:text-blue-700 hover:bg-blue-50"
              >
                Add Option
              </Button>
              {!field.showOtherItem && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onUpdateFieldShowOther(field.id, true)}
                  className="text-blue-500 hover:text-blue-700 hover:bg-blue-50"
                >
                  Add &apos;Other&apos;
                </Button>
              )}
            </div>
          </div>
        );
      case "checkbox":
        return (
          <div>
            {choices.map((choice, index) => (
              <div key={index} className="flex items-center space-x-2">
                <Checkbox
                  id={choice.value}
                  checked={
                    Array.isArray(field.defaultValue) &&
                    field.defaultValue.includes(choice.value)
                  }
                  onCheckedChange={(checked) => {
                    const currentDefaults = (
                      Array.isArray(field.defaultValue)
                        ? field.defaultValue
                        : []
                    ) as string[];
                    const newDefaults = checked
                      ? [...currentDefaults, choice.value]
                      : currentDefaults.filter((v) => v !== choice.value);
                    onUpdateFieldDefaultValue(field.id, newDefaults);
                  }}
                />
                <input
                  type="text"
                  value={choice.text}
                  onChange={(e) => handleUpdateOption(index, e.target.value)}
                  className="text-sm bg-transparent border border-gray-200 rounded px-2 py-1"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDeleteOption(index)}
                  className="text-red-500 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            {field.showOtherItem && (
              <div className="flex items-center space-x-2 mt-2">
                <Checkbox
                  id="other-checkbox"
                  checked={selectedCheckboxes.includes("other")}
                  onCheckedChange={() => toggleCheckbox("other")}
                />
                <Label htmlFor="other-checkbox">Other</Label>
                {selectedCheckboxes.includes("other") && (
                  <input
                    type="text"
                    value={otherCheckboxValue}
                    onChange={(e) => setOtherCheckboxValue(e.target.value)}
                    placeholder="Enter your option"
                    className="text-sm bg-transparent border border-gray-200 rounded px-2 py-1"
                  />
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onUpdateFieldShowOther(field.id, false)}
                  className="text-red-500 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            )}
            <div className="flex space-x-2 mt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleAddOption()}
                className="text-blue-500 hover:text-blue-700 hover:bg-blue-50"
              >
                Add Option
              </Button>
              {!field.showOtherItem && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onUpdateFieldShowOther(field.id, true)}
                  className="text-blue-500 hover:text-blue-700 hover:bg-blue-50"
                >
                  Add &apos;Other&apos;
                </Button>
              )}
            </div>
          </div>
        );
      case "dropdown":
        return (
          <div>
            <Select
              value={
                typeof field.defaultValue === "string" ? field.defaultValue : ""
              }
              onValueChange={(value) => {
                const newValue =
                  value === field.defaultValue ? undefined : value;
                onUpdateFieldDefaultValue(field.id, newValue as string);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select an option" />
              </SelectTrigger>
              <SelectContent>
                {choices
                  .filter((choice) => choice.value && choice.value !== "")
                  .map((choice, index) => (
                    <SelectItem key={index} value={choice.value}>
                      {choice.text}
                    </SelectItem>
                  ))}
                {field.showOtherItem && (
                  <SelectItem value="other">Other</SelectItem>
                )}
              </SelectContent>
            </Select>

            {/* Option Management UI */}
            <div className="mt-4 space-y-2">
              {choices.map((choice, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={choice.text}
                    onChange={(e) => handleUpdateOption(index, e.target.value)}
                    className="text-sm bg-transparent border border-gray-200 rounded px-2 py-1"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteOption(index)}
                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}

              {field.showOtherItem && (
                <div className="flex items-center space-x-2 mt-2">
                  <Label>Other Option</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onUpdateFieldShowOther(field.id, false)}
                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )}

              <div className="flex space-x-2 mt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleAddOption}
                  className="text-blue-500 hover:text-blue-700 hover:bg-blue-50"
                >
                  Add Option
                </Button>
                {!field.showOtherItem && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onUpdateFieldShowOther(field.id, true)}
                    className="text-blue-500 hover:text-blue-700 hover:bg-blue-50"
                  >
                    Add &apos;Other&apos;
                  </Button>
                )}
              </div>
            </div>
          </div>
        );
      case "slider":
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <Slider
                  defaultValue={[
                    (field.defaultValue as number) || sliderDefault,
                  ]}
                  value={[(field.defaultValue as number) || sliderDefault]}
                  onValueChange={([value]) => {
                    onUpdateFieldSliderValue(field.id, value);
                  }}
                  min={field.minValue || sliderMin}
                  max={field.maxValue || sliderMax}
                  step={field.step || sliderStep}
                />
              </div>
              <div className="w-12 text-sm text-gray-600">
                {[(field.defaultValue as number) || sliderDefault]}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="slider-min" className="text-sm text-gray-600">
                  Minimum Value
                </Label>
                <Input
                  type="number"
                  value={field.minValue || sliderMin}
                  onChange={(e) => {
                    const value = Number(e.target.value);
                    setSliderMin(value);
                    onUpdateFieldSliderProps(field.id, { minValue: value });

                    // Adjust default value if it's less than new minimum
                    if ((field.defaultValue as number) < value) {
                      setSliderDefault(value);
                      onUpdateFieldDefaultValue(field.id, value);
                    }
                  }}
                />
              </div>
              <div>
                <Label htmlFor="slider-max" className="text-sm text-gray-600">
                  Maximum Value
                </Label>
                <Input
                  type="number"
                  value={field.maxValue || sliderMax}
                  onChange={(e) => {
                    const value = Number(e.target.value);
                    setSliderMax(value);
                    onUpdateFieldSliderProps(field.id, { maxValue: value });

                    // Adjust default value if it's greater than new maximum
                    if ((field.defaultValue as number) > value) {
                      setSliderDefault(value);
                      onUpdateFieldDefaultValue(field.id, value);
                    }
                  }}
                  className="text-sm bg-transparent border border-gray-200"
                />
              </div>
              <div>
                <Label
                  htmlFor="slider-default"
                  className="text-sm text-gray-600"
                >
                  Default Value
                </Label>
                <Input
                  id="slider-default"
                  type="number"
                  value={
                    typeof field.defaultValue === "boolean"
                      ? field.defaultValue.toString()
                      : field.defaultValue || ""
                  }
                  onChange={(e) => {
                    const value = Number(e.target.value);
                    // Ensure default value stays within min/max bounds
                    const minVal = field.minValue || sliderMin;
                    const maxVal = field.maxValue || sliderMax;
                    const boundedValue = Math.min(
                      Math.max(value, minVal),
                      maxVal,
                    );

                    setSliderDefault(boundedValue);
                    onUpdateFieldDefaultValue(field.id, boundedValue);
                  }}
                  min={field.minValue || sliderMin}
                  max={field.maxValue || sliderMax}
                  className="text-sm bg-transparent border border-gray-200"
                />
              </div>
              <div>
                <Label htmlFor="slider-step" className="text-sm text-gray-600">
                  Step
                </Label>
                <Input
                  id="slider-step"
                  type="number"
                  value={field.step || sliderStep}
                  onChange={(e) => {
                    const value = Number(e.target.value);
                    setSliderStep(value);
                    onUpdateFieldSliderProps(field.id, { step: value });
                  }}
                  min={1}
                  className="text-sm bg-transparent border border-gray-200"
                />
              </div>
            </div>
          </div>
        );
      case "boolean":
        return (
          <div className="flex items-center space-x-2">
            <Switch
              id="boolean-switch"
              checked={(field.defaultValue as boolean) || false}
              onCheckedChange={(checked) => {
                onUpdateFieldDefaultValue(field.id, checked);
              }}
            />
            <Label htmlFor="boolean-switch">Yes/No</Label>
          </div>
        );
      case "richText":
        return (
          <RichText
            value={field.html || ""}
            onChange={(value: string) => {
              onUpdateRichText?.(field.id, value);
            }}
            // TODO: Remove this once we have a real microapp ID
            microappId={appId?.toString() || ""}
          />
        );
      case "imageUpload":
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <Switch
                checked={field.multiple || false}
                onCheckedChange={(checked) => {
                  onUpdateImageUploadSettings?.(field.id, {
                    ...field,
                    multiple: checked,
                    maxFiles: checked ? field.maxFiles || 5 : 1,
                  });
                }}
              />
              <Label>Allow multiple files</Label>
            </div>

            {field.multiple && (
              <div className="space-y-2">
                <Label>Maximum number of files</Label>
                <Input
                  type="number"
                  min="1"
                  value={field.maxFiles || 5}
                  onChange={(e) => {
                    onUpdateImageUploadSettings?.(field.id, {
                      ...field,
                      maxFiles: parseInt(e.target.value),
                    });
                  }}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>Maximum file size (MB)</Label>
              <Input
                type="number"
                min="1"
                value={field.maxFileSize || 5}
                onChange={(e) => {
                  onUpdateImageUploadSettings?.(field.id, {
                    ...field,
                    maxFileSize: parseInt(e.target.value),
                  });
                }}
              />
            </div>

            <div className="space-y-2">
              <Label>Allowed file types</Label>
              <div className="flex gap-2">
                {["image/jpeg", "image/png", "image/webp"].map((type) => (
                  <div key={type} className="flex items-center gap-2">
                    <Checkbox
                      checked={field.allowedFileTypes?.includes(type) ?? true}
                      onCheckedChange={(checked) => {
                        const currentTypes = field.allowedFileTypes || [
                          "image/jpeg",
                          "image/png",
                          "image/webp",
                        ];
                        const newTypes = checked
                          ? [...currentTypes, type]
                          : currentTypes.filter((t) => t !== type);
                        onUpdateImageUploadSettings?.(field.id, {
                          ...field,
                          allowedFileTypes: newTypes,
                        });
                      }}
                    />
                    <Label>{type.split("/")[1].toUpperCase()}</Label>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      case "chat":
        return (
          <div className="space-y-4">
            {/* Avatar Upload Section */}
            <div className="flex gap-4 items-start">
              <div className="space-y-2 flex-shrink-0">
                <label className="text-sm font-medium">Avatar</label>
                <div className="relative">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleAvatarUpload(file);
                    }}
                    className="hidden"
                    id={`avatar-upload-${field.id}`}
                  />
                  <label
                    htmlFor={`avatar-upload-${field.id}`}
                    className="block w-24 h-24 rounded-full overflow-hidden cursor-pointer group relative"
                  >
                    {field.avatarUrl ? (
                      <>
                        <Image
                          src={field.avatarUrl}
                          alt="Chat avatar"
                          width={96}
                          height={96}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all duration-200 flex items-center justify-center">
                          <Repeat2 className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                        </div>
                      </>
                    ) : (
                      <div className="w-full h-full bg-gray-100 flex items-center justify-center group-hover:bg-gray-200 transition-colors duration-200">
                        <div className="text-gray-400 group-hover:text-gray-500 transition-colors duration-200">
                          <User className="w-10 h-10" />
                        </div>
                        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all duration-200 flex items-center justify-center">
                          <Repeat2 className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                        </div>
                      </div>
                    )}
                  </label>
                </div>
              </div>

              {/* Rest of chat fields */}
              <div className="space-y-2 flex-grow">
                <label className="text-sm font-medium">
                  Chatbot Instructions
                </label>
                <textarea
                  value={field.chatbotInstructions || ""}
                  onChange={(e) => {
                    if (onUpdateChatbotInstructions) {
                      onUpdateChatbotInstructions(field.id, e.target.value);
                    }
                  }}
                  className="w-full min-h-[100px] rounded-md border border-gray-300 
                    px-3 py-2 text-gray-900 focus:border-primary 
                    focus:ring-primary resize-y"
                  placeholder="Enter instructions for how the chatbot should behave..."
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Initial Message</label>
              <textarea
                value={field.initialMessage || ""}
                onChange={(e) =>
                  onUpdateFieldInitialMessage?.(field.id, e.target.value)
                }
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-primary focus:ring-primary"
                placeholder="Enter initial message..."
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Max Messages</label>
              <Input
                type="number"
                min="1"
                value={field.maxMessages || 10}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-primary focus:ring-primary"
                onChange={(e) => {
                  const value = parseInt(e.target.value, 10);
                  if (onUpdateFieldMaxMessages && !isNaN(value)) {
                    onUpdateFieldMaxMessages(field.id, value);
                  }
                }}
              />
            </div>

            {/* TTS Configuration Section */}
            <div className="border-t pt-4 space-y-4">
              <div className="flex items-center space-x-2">
                <Switch
                  checked={field.enableTts || false}
                  onCheckedChange={(checked) => {
                    if (onUpdateTtsEnabled) {
                      onUpdateTtsEnabled(field.id, checked);
                    }
                  }}
                />
                <div>
                  <label className="text-sm font-medium">
                    Enable Voice Conversations
                  </label>
                  <p className="text-xs text-gray-500 mt-1">
                    Allow users to speak with the chatbot and hear responses out
                    loud
                  </p>
                </div>
              </div>

              {field.enableTts && (
                <div className="space-y-4">
                  <RadioGroup
                    value={field.selectedVoiceId || ""}
                    onValueChange={(value: string) => {
                      if (onUpdateTtsVoiceId) {
                        onUpdateTtsVoiceId(field.id, value);
                      }
                    }}
                  >
                    <div className="grid grid-cols-2 gap-4">
                      {VOICE_OPTIONS.map((voice) => (
                        <div
                          key={voice.id}
                          onClick={() => {
                            if (onUpdateTtsVoiceId) {
                              onUpdateTtsVoiceId(field.id, voice.id);
                            }
                          }}
                          className={`relative border rounded-lg p-4 cursor-pointer transition-all hover:shadow-md ${
                            field.selectedVoiceId === voice.id
                              ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                              : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                          }`}
                        >
                          <div className="flex items-start space-x-3">
                            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                              <Image
                                src={voice.avatarUrl}
                                alt={voice.name}
                                width={40}
                                height={40}
                                className="w-10 h-10 rounded-full object-cover"
                              />
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center justify-between">
                                <h4 className="font-medium">{voice.name}</h4>
                                <RadioGroupItem
                                  value={voice.id}
                                  id={`voice-${voice.id}`}
                                  className="ml-2 pointer-events-none"
                                />
                              </div>
                              <p className="text-sm text-gray-500 mt-1">
                                {voice.description}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </RadioGroup>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Voice Instructions
                    </label>
                    <p className="text-xs text-gray-500">
                      Add specific instructions for how the voice should sound
                      (e.g., &quot;Speak with enthusiasm&quot; or &quot;Use a
                      calm, soothing tone&quot;)
                    </p>
                    <Textarea
                      value={field.voiceInstructions || ""}
                      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
                        if (onUpdateVoiceInstructions) {
                          onUpdateVoiceInstructions(field.id, e.target.value);
                        }
                      }}
                      placeholder="Enter voice instructions..."
                      className="min-h-[100px]"
                    />
                  </div>

                  <div className="flex justify-end">
                    <Button
                      type="button"
                      onClick={async () => {
                        try {
                          if (hasCachedSample && !isGeneratingSample) {
                            // Play cached sample
                            const audio = new Audio(
                              cachedVoiceSamples[currentCacheKey],
                            );
                            audio.play();
                          } else {
                            // Generate new sample
                            setIsGeneratingSample(true);
                            const sampleText =
                              field.initialMessage ||
                              "Hello! This is a sample of my voice. I hope you like it!";
                            const audioUrl = await synthesizeSpeech(
                              sampleText,
                              "openai",
                              field.selectedVoiceId || "ash",
                              field.voiceInstructions,
                              user?.id || null,
                            );

                            // Cache the sample
                            setCachedVoiceSamples((prev) => ({
                              ...prev,
                              [currentCacheKey]: audioUrl,
                            }));

                            // Play the sample
                            const audio = new Audio(audioUrl);
                            audio.play();
                          }
                        } catch (error) {
                          console.error("Error playing voice sample:", error);
                        } finally {
                          setIsGeneratingSample(false);
                        }
                      }}
                      disabled={!field.selectedVoiceId || isGeneratingSample}
                      className="flex items-center space-x-2"
                    >
                      {isGeneratingSample ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Play className="w-4 h-4" />
                      )}
                      <span>
                        {isGeneratingSample
                          ? "Generating..."
                          : hasCachedSample
                            ? "Play Sample"
                            : "Generate Sample"}
                      </span>
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  if (isPromptType) {
    return (
      <div
        ref={fieldRef}
        className={`space-y-2 rounded-lg bg-white p-4 transition-shadow duration-200
         ${isActive ? `shadow-soft` : `cursor-pointer hover:shadow-soft`}
         `}
        style={isActive ? { borderLeft: "4px solid #5963E8" } : undefined}
        onClick={() => {
          if (!isActive && onActivate) onActivate();
        }}
      >
        {field.conditionalLogic && fieldCondition && (
          <InstructionConditionBox
            property={
              fieldCondition.name || fieldCondition.label || fieldCondition.id
            }
            operator={field.conditionalLogic.operator}
            value={
              field.conditionalLogic.value
                ? String(field.conditionalLogic.value)
                : undefined
            }
          />
        )}
        <FieldHeader
          icon={FIELD_ICONS[field.type]}
          label={FIELD_LABELS[field.type] || field.type}
          field={field}
          isRequired={field.isRequired || false}
          onRequiredChange={(isRequired) =>
            onUpdateFieldRequired(field.id, isRequired, true)
          }
          onRename={(newName) => onUpdateFieldName(field.id, newName, true)}
          onDelete={() => onDeleteField(field.id, true)}
          onFieldTypeChange={(newType) =>
            onUpdateFieldType?.(field.id, newType)
          }
          availableFields={phaseFields}
          dragHandleProps={dragHandleProps ?? undefined}
          hiddenElements={
            !isActive
              ? [
                  "required",
                  "conditionalLogic",
                  "fieldTypeSelector",
                  "fieldLabel",
                  "dragHandle",
                  "delete",
                ]
              : []
          }
          isDragging={isDragging}
          isPreviewMode={!isActive}
          conditionalLogic={field.conditionalLogic}
        />
        {renderFieldEdit()}
      </div>
    );
  }

  const renderValidationSection = () => {
    if (field.type === "text" || field.type === "textarea") {
      return (
        <div className="mt-2">
          {!isValidationExpanded ? (
            <button
              type="button"
              onClick={() => setValidationExpanded(true)}
              className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 font-medium transition-colors"
            >
              <CirclePlus size={16} className="mr-1" />
              User input restrictions
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setValidationExpanded(false)}
              className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 font-medium transition-colors mb-2"
            >
              <CircleMinus size={16} className="mr-1" />
              User input restrictions
            </button>
          )}

          <AnimatePresence>
            {isValidationExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: "easeInOut" }}
                className="overflow-hidden"
              >
                <div className="grid grid-cols-2 gap-4 mt-2">
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Min characters
                    </label>
                    <input
                      className="text-md bg-transparent border border-gray-200 focus:border-gray-600 px-2 py-1 w-full transition-colors "
                      type="number"
                      value={field.minChars || ""}
                      onChange={(e) =>
                        onUpdateFieldValidation(
                          field.id,
                          e.target.value ? parseInt(e.target.value, 10) : null,
                          field.maxChars ?? null,
                          false,
                        )
                      }
                      placeholder="Enter the number"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Max characters
                    </label>
                    <input
                      type="number"
                      value={field.maxChars || ""}
                      onChange={(e) =>
                        onUpdateFieldValidation(
                          field.id,
                          field.minChars ?? null,
                          e.target.value ? parseInt(e.target.value, 10) : null,
                          false,
                        )
                      }
                      className="text-md bg-transparent border border-gray-200 focus:border-gray-600 px-2 py-1 w-full transition-colors "
                      placeholder="Enter the number"
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      );
    }
    return null;
  };

  function renderFieldPreview() {
    const content = (() => {
      switch (field.type) {
        case "title":
          return (
            <h2 className="text-base font-semibold">
              {field.text || field.label}
            </h2>
          );
        case "scoring":
          return (
            <div>
              <div className="font-medium mb-1">Scoring</div>
              <div className="text-sm text-gray-600">
                {field.rubric || "No rubric set."}
              </div>
            </div>
          );
        default:
          //TODO: Display restrictions labels
          return (
            <RenderQuestion
              element={field}
              answers={previewAnswers}
              errors={[]}
              disabled={false}
              handleInputChange={handlePreviewInputChange}
              setInputValue={handlePreviewSetInputValue}
              setImages={() => {}}
              visible={true}
              appId={0}
              userId={null}
              surveyJson={null}
              currentPhaseIndex={0}
              isOwner={false}
              isAdmin={false}
            />
          );
      }
    })();

    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.3 }}
      >
        {content}
      </motion.div>
    );
  }

  return (
    <div ref={fieldRef} className={`relative`}>
      <motion.div
        layout={!isDragging}
        className={`space-y-2 rounded-lg bg-white p-4 transition-shadow duration-200
            ${isActive ? `shadow-soft` : `cursor-pointer hover:shadow-soft`}
         `}
        style={isActive ? { borderLeft: "4px solid #5963E8" } : undefined}
        onMouseDown={(e) => {
          if (!isActive && onActivate) {
            e.preventDefault();
            e.stopPropagation();
            onActivate();
          }
        }}
      >
        <div className="relative z-10 !mt-0">
          {field.conditionalLogic && fieldCondition && (
            <motion.div className="mb-4" layout={!isDragging}>
              <InstructionConditionBox
                property={
                  fieldCondition.name ||
                  fieldCondition.label ||
                  fieldCondition.id
                }
                operator={field.conditionalLogic.operator}
                value={
                  field.conditionalLogic.value
                    ? String(field.conditionalLogic.value)
                    : undefined
                }
                fieldId={field.id}
              />
            </motion.div>
          )}
          <FieldHeader
            icon={FIELD_ICONS[field.type]}
            label={FIELD_LABELS[field.type] || field.type}
            field={field}
            isPreviewMode={!isActive}
            onDelete={() => onDeleteField(field.id, isPromptType)}
            onFieldTypeChange={(newType) =>
              onUpdateFieldType?.(field.id, newType)
            }
            dragHandleProps={dragHandleProps ?? undefined}
            onRename={(newName) =>
              onUpdateFieldName(field.id, newName, isPromptType)
            }
            isRequired={field.isRequired || false}
            onRequiredChange={(isRequired) =>
              onUpdateFieldRequired(field.id, isRequired, isPromptType)
            }
            onConditionalLogicChange={(logic) =>
              onUpdateConditionalLogic?.(field.id, logic)
            }
            availableFields={phaseFields}
            hiddenElements={
              !isActive
                ? [
                    "required",
                    "conditionalLogic",
                    "fieldTypeSelector",
                    "fieldLabel",
                    "dragHandle",
                    "delete",
                  ]
                : []
            }
            isDragging={isDragging}
            conditionalLogic={field.conditionalLogic}
          />

          <AnimatePresence mode="wait">
            {isActive && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
              >
                <motion.div
                  className="space-y-2"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.1, duration: 0.3 }}
                >
                  {!isSpecialType && (
                    <>
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.15, duration: 0.3 }}
                      >
                        <Label className="text-sm font-medium mb-1 block">
                          Question
                        </Label>
                        <Input
                          value={field.label || ""}
                          onFocus={() => {
                            if (!field.label) {
                              onUpdateFieldLabel(field.id, "", isPromptType);
                            }
                          }}
                          onChange={(e) => {
                            onUpdateFieldLabel(
                              field.id,
                              e.target.value,
                              isPromptType,
                            );
                          }}
                          className="text-md bg-transparent border border-gray-200 focus:border-gray-600 px-2 py-1 transition-colors focus:outline-none focus:ring-0 w-full cursor-text"
                          placeholder="Enter your question..."
                        />
                      </motion.div>

                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2, duration: 0.3 }}
                      >
                        {!showDescription && !field.description && (
                          <button
                            type="button"
                            onClick={() => setShowDescription(true)}
                            className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 font-medium transition-colors pb-6 pt-2"
                          >
                            <CirclePlus size={16} className="mr-1" />
                            Add description
                          </button>
                        )}

                        {(showDescription || field.description) && (
                          <div className="relative pb-6 pt-2">
                            <textarea
                              value={field.description || ""}
                              onChange={(e) =>
                                onUpdateFieldDescription(
                                  field.id,
                                  e.target.value,
                                  isPromptType,
                                )
                              }
                              className="text-sm text-gray-600 bg-transparent w-full border border-gray-200 hover:border-gray-400 focus:border-gray-600 rounded px-2 py-1 transition-colors focus:outline-none focus:ring-0 min-h-[40px] resize-y cursor-text"
                              placeholder="Add a description..."
                            />
                            {/* Remove description button */}
                            {!field.description && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setShowDescription(false)}
                                className="absolute top-1 right-0 text-gray-400 hover:text-red-500"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        )}
                      </motion.div>
                    </>
                  )}

                  <motion.div
                    className="mt-3"
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.25, duration: 0.3 }}
                  >
                    {renderFieldEdit()}
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3, duration: 0.3 }}
                  >
                    {renderValidationSection()}
                  </motion.div>
                </motion.div>
              </motion.div>
            )}

            {!isActive && !isSpecialType && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
                className="[&_*]:cursor-pointer"
              >
                <div className="space-y-2 mt-4">{renderFieldPreview()}</div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
