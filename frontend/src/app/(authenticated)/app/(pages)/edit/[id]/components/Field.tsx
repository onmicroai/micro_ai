"use client";

import { Choice, Element } from "@/app/(authenticated)/app/types";
import {
  GripVertical,
  Trash2,
  ChevronDown,
  ChevronUp,
  Settings,
  Play,
  Pause,
} from "lucide-react";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { RadioGroup, RadioGroupItem } from "./ui/radio-group";
import { Checkbox } from "./ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Slider } from "./ui/slider";
import { Switch } from "./ui/switch";
import { Label } from "./ui/label";
import { Button } from "./ui/button";
import { Draggable } from "@hello-pangea/dnd";
import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
import { RichText } from "./fields/RichText";
import PromptField from "./fields/PromptField";
import { getElevenLabsVoices, ElevenLabsVoice, VoicePreview, generateAndSaveHumeVoice } from '@/utils/textToSpeechService';

interface ConditionalLogic {
  sourceFieldId: string;
  operator: string;
  value?: string | number | boolean;
}

interface FieldProps {
  field: Element;
  index: number;
  phaseFields: Element[];
  appFields: Element[];
  appId: number | null;
  onUpdateFieldLabel: (
    fieldId: string,
    newLabel: string,
    isPrompt: boolean
  ) => void;
  onUpdateFieldName: (
    fieldId: string,
    newName: string,
    isPrompt: boolean
  ) => void;
  onDeleteField: (fieldId: string, isPrompt: boolean) => void;
  onUpdateFieldDescription: (
    fieldId: string,
    description: string,
    isPrompt: boolean
  ) => void;
  onUpdateFieldRequired: (
    fieldId: string,
    isRequired: boolean,
    isPrompt: boolean
  ) => void;
  onUpdateFieldValidation: (
    fieldId: string,
    minChars: number | null,
    maxChars: number | null,
    isPrompt: boolean
  ) => void;
  onUpdatePromptText?: (fieldId: string, text: string) => void;
  onUpdateFieldDefaultValue: (
    fieldId: string,
    defaultValue: string | string[] | number | boolean
  ) => void;
  onUpdateFieldPlaceholder: (fieldId: string, placeholder: string) => void;
  onUpdateFieldChoices: (fieldId: string, choices: Choice[]) => void;
  onUpdateFieldShowOther: (fieldId: string, showOther: boolean) => void;
  onUpdateFieldSliderValue: (fieldId: string, value: number) => void;
  onUpdateFieldSliderProps: (
    fieldId: string,
    updates: {
      minValue?: number;
      maxValue?: number;
      step?: number;
    }
  ) => void;
  onUpdateConditionalLogic?: (
    fieldId: string,
    logic: ConditionalLogic | null
  ) => void;
  onUpdateRichText?: (fieldId: string, html: string) => void;
  onUpdateImageUploadSettings?: (
    fieldId: string,
    settings: {
      multiple?: boolean;
      maxFiles?: number;
      maxFileSize?: number;
      allowedFileTypes?: string[];
    }
  ) => void;
  onUpdateFieldMaxMessages?: (fieldId: string, maxMessages: number) => void;
  onUpdateFieldInitialMessage?: (
    fieldId: string,
    initialMessage: string
  ) => void;
  onUpdateChatbotInstructions?: (
    fieldId: string,
    chatbotInstructions: string
  ) => void;
  onUpdateTtsProvider?: (fieldId: string, provider: string) => void;
  onUpdateTtsVoiceId?: (fieldId: string, voiceId: string) => void;
  onUpdateTtsEnabled?: (fieldId: string, enabled: boolean) => void;
  onUpdateVoiceInstructions?: (fieldId: string, instructions: string) => void;
  onUpdateCustomVoiceId?: (fieldId: string, voiceId: string) => void;
}

export default function Field({
  field,
  index,
  phaseFields,
  appFields,
  appId,
  onUpdateFieldLabel,
  onUpdateFieldName,
  onUpdateFieldRequired,
  onDeleteField,
  onUpdateFieldDescription,
  onUpdateFieldValidation,
  onUpdatePromptText,
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
  onUpdateCustomVoiceId,
  onUpdateTtsProvider,
}: FieldProps) {
  const [isValidationExpanded, setValidationExpanded] = useState(false);
  const [choices, setChoices] = useState<Choice[]>(field.choices || []);
  const [selectedCheckboxes, setSelectedCheckboxes] = useState<string[]>([]);
  const [otherCheckboxValue, setOtherCheckboxValue] = useState("");
  const [sliderMin, setSliderMin] = useState(0);
  const [sliderMax, setSliderMax] = useState(100);
  const [sliderDefault, setSliderDefault] = useState(50);
  const [sliderStep, setSliderStep] = useState(1);
  const [showDescription, setShowDescription] = useState(false);
  const [selectedSourceField, setSelectedSourceField] = useState<string>(
    field.conditionalLogic?.sourceFieldId || ""
  );
  const [selectedOperator, setSelectedOperator] = useState<string>(
    field.conditionalLogic?.operator || ""
  );
  const [conditionValue, setConditionValue] = useState<
    string | number | boolean
  >(field.conditionalLogic?.value || "");
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);
  const [elevenLabsVoices, setElevenLabsVoices] = useState<ElevenLabsVoice[]>([]);
  const [isLoadingVoices, setIsLoadingVoices] = useState(false);
  const [voicePreviews, setVoicePreviews] = useState<VoicePreview[]>([]);
  const [isGeneratingPreviews, setIsGeneratingPreviews] = useState(false);
  const [previewText, setPreviewText] = useState('');
  const [playingPreviewId, setPlayingPreviewId] = useState<string | null>(null);
  const [selectedPreviewId, setSelectedPreviewId] = useState<string | null>(null);
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch ElevenLabs voices on component mount
  useEffect(() => {
    const fetchVoices = async () => {
      setIsLoadingVoices(true);
      try {
        const voices = await getElevenLabsVoices();
        setElevenLabsVoices(voices);
      } catch (error) {
        console.error('Error fetching ElevenLabs voices:', error);
      } finally {
        setIsLoadingVoices(false);
      }
    };
    fetchVoices();
  }, []);

  useEffect(() => {
    if (field.conditionalLogic) {
      setSelectedSourceField(field.conditionalLogic.sourceFieldId);
      setSelectedOperator(field.conditionalLogic.operator);
      setConditionValue(field.conditionalLogic.value || "");
    }
  }, [field.conditionalLogic]);

  // Cleanup audio when component unmounts or voice instructions change
  useEffect(() => {
    return () => {
      if (currentAudio) {
        currentAudio.pause();
        setCurrentAudio(null);
        setPlayingPreviewId(null);
      }
    };
  }, [currentAudio]);

  // Reset voice previews and stop audio when voice instructions change  
  useEffect(() => {
    if (field.selectedVoiceId !== 'custom') {
      // Stop any playing audio
      if (currentAudio) {
        currentAudio.pause();
        setCurrentAudio(null);
        setPlayingPreviewId(null);
      }
      setVoicePreviews([]);
      setSelectedPreviewId(null);
      setPreviewText('');
    }
  }, [field.selectedVoiceId, field.voiceInstructions]);

  const handleGenerateVoicePreviews = async () => {
    try {
      setIsGeneratingPreviews(true);
      setVoicePreviews([]);
      setError(null);

      // If selectedVoiceId is 'custom', use Hume for voice generation
      if (field.selectedVoiceId === 'custom') {
        console.log("Using Hume for custom voice generation");
        const response = await generateAndSaveHumeVoice(
          field.initialMessage || "Hello! I'm a voice assistant that can have a conversation with you.",
          field.voiceInstructions || "Custom voice"
        );
        console.log("Hume response:", response);

        // Auto-select the preview and update the field's customVoiceId
        if (onUpdateTtsVoiceId) {
          onUpdateTtsVoiceId(field.id, 'custom');
        }
        if (onUpdateCustomVoiceId) {
          console.log("Setting customVoiceId to Hume ID:", response.voiceId);
          onUpdateCustomVoiceId(field.id, response.voiceId);
        }
        // Remove the separate TTS provider update since it's now handled in updateCustomVoiceId
      }
    } catch (error) {
      console.error("Error generating voice previews:", error);
      setError(error instanceof Error ? error.message : "Failed to generate voice previews");
    } finally {
      setIsGeneratingPreviews(false);
    }
  };

  const handlePlayPreview = async (preview: VoicePreview) => {
    // If this preview is currently playing, pause it
    if (playingPreviewId === preview.generated_voice_id && currentAudio) {
      currentAudio.pause();
      setPlayingPreviewId(null);
      setCurrentAudio(null);
      return;
    }

    // Stop any currently playing audio
    if (currentAudio) {
      currentAudio.pause();
      setCurrentAudio(null);
    }

    setPlayingPreviewId(preview.generated_voice_id);
    try {
      // Create audio blob from base64
      const audioBlob = new Blob([Uint8Array.from(atob(preview.audio_base_64), c => c.charCodeAt(0))], {
        type: preview.media_type
      });
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      
      // Set up event listeners
      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
        setPlayingPreviewId(null);
        setCurrentAudio(null);
      };
      
      audio.onerror = () => {
        URL.revokeObjectURL(audioUrl);
        setPlayingPreviewId(null);
        setCurrentAudio(null);
        console.error('Error playing audio');
      };
      
      // Play the audio
      setCurrentAudio(audio);
      await audio.play();
    } catch (error) {
      console.error('Error playing preview:', error);
      setPlayingPreviewId(null);
      setCurrentAudio(null);
    }
  };

  const handleSelectPreview = (preview: VoicePreview) => {
    setSelectedPreviewId(preview.generated_voice_id);
    // Update both selectedVoiceId and customVoiceId when user explicitly selects a preview
    if (onUpdateTtsVoiceId) {
      onUpdateTtsVoiceId(field.id, 'custom');
      if (onUpdateCustomVoiceId) {
         console.log("1. updating voice id to ", preview.generated_voice_id)
        onUpdateCustomVoiceId(field.id, preview.generated_voice_id);
      }
      if (onUpdateTtsProvider) {
        onUpdateTtsProvider(field.id, field.selectedVoiceId === 'custom' ? 'hume' : 'elevenlabs');
      }
    }
  };

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
      i === index ? { ...choice, text: newText } : choice
    );
    setChoices(newChoices);
    onUpdateFieldChoices(field.id, newChoices);
  };

  const toggleCheckbox = (optionId: string) => {
    setSelectedCheckboxes((prev) =>
      prev.includes(optionId)
        ? prev.filter((id) => id !== optionId)
        : [...prev, optionId]
    );
  };

  const getOperatorsForElement = (Element: string) => {
    const operators = [];

    // Basic equality operators shared by most types
    switch (Element) {
      case "text":
      case "textarea":
      case "radio":
      case "dropdown":
      case "boolean":
      case "slider":
        operators.push(
          { value: "equals", label: "Equals" },
          { value: "not_equals", label: "Does not equal" }
        );
    }

    // Additional operators for text fields
    switch (Element) {
      case "text":
      case "textarea":
      case "radio":
      case "checkbox":
      case "dropdown":
        operators.push(
          { value: "contains", label: "Contains" },
          { value: "not_contains", label: "Does not contain" },
          { value: "is_empty", label: "Is empty" },
          { value: "is_not_empty", label: "Is not empty" }
        );
        break;

      case "slider":
        operators.push(
          { value: "greater_than", label: "Greater than" },
          { value: "less_than", label: "Less than" },
          { value: "greater_than_or_equal", label: "Greater than or equal to" },
          { value: "less_than_or_equal", label: "Less than or equal to" }
        );
        break;
    }

    return operators;
  };

  const operatorNeedsValue = (operator: string) => {
    return !["is_empty", "is_not_empty"].includes(operator);
  };

  const renderField = () => {
    // Handle prompt-related types separately
    if (field.type === "prompt" || field.type === "aiInstructions" || field.type === "fixedResponse") {
      return (
        <PromptField
          field={{
            id: field.id,
            name: field.name,
            type: field.type,
            text: field.text
          }}
          fields={appFields}
          onChange={onUpdatePromptText}
        />
      );
    }

    // Handle all other field types
    switch (field.type) {
      case "text":
        return (
          <Input
            placeholder={
              field.placeholder ||
              "Your user can enter a short response here... "
            }
            onChange={(e) => onUpdateFieldPlaceholder(field.id, e.target.value)}
          />
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
                          undefined as unknown as string
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
                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
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
                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
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
                {choices.map((choice, index) => (
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
                      maxVal
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
            <div className="space-y-2">
              <label className="text-sm font-medium">Max Messages</label>
              <Input
                type="number"
                min="1"
                value={field.maxMessages || 10}
                onChange={(e) => {
                  const value = parseInt(e.target.value, 10);
                  if (onUpdateFieldMaxMessages && !isNaN(value)) {
                    onUpdateFieldMaxMessages(field.id, value);
                  }
                }}
                className="w-full"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Initial Assistant Message
              </label>
              <textarea
                value={field.initialMessage || ""}
                onChange={(e) => {
                  if (onUpdateFieldInitialMessage) {
                    onUpdateFieldInitialMessage(field.id, e.target.value);
                  }
                }}
                className="w-full min-h-[100px] rounded-md border border-gray-300 
                  px-3 py-2 text-gray-900 focus:border-primary 
                  focus:ring-primary resize-y"
                placeholder="Enter the first message the assistant should say..."
              />
            </div>
            <div className="space-y-2">
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
                  <label className="text-sm font-medium">Enable Voice Conversations</label>
                  <p className="text-xs text-gray-500 mt-1">Allow users to speak with the chatbot and hear responses out loud</p>
                </div>
              </div>
              
              {field.enableTts && (
                <div className="space-y-2 ">
                  
                    

                        <label className="text-sm font-medium">Voice Selection</label>
                        <Select
                          value={field.selectedVoiceId || ""}
                          onValueChange={(value) => {
                            if (onUpdateTtsVoiceId) {
                              onUpdateTtsVoiceId(field.id, value);
                            }
                          }}
                          disabled={isLoadingVoices}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder={
                              isLoadingVoices 
                                ? "Loading voices..." 
                                : "Select a voice"
                            } />
                          </SelectTrigger>
                          <SelectContent>
                            {isLoadingVoices && (
                              <div className="px-2 py-1.5 text-sm text-gray-500">
                                Loading voices...
                              </div>
                            )}
                            {!isLoadingVoices && elevenLabsVoices.length === 0 && (
                              <div className="px-2 py-1.5 text-sm text-gray-500">
                                No voices available
                              </div>
                            )}
                            {!isLoadingVoices && elevenLabsVoices.length > 0 && 
                              elevenLabsVoices.map((voice) => (
                                <SelectItem key={voice.voice_id} value={voice.voice_id}>
                                  {voice.name} ({voice.category})
                                </SelectItem>
                              ))
                            }
                            {!isLoadingVoices && (
                              <SelectItem value="custom">
                                Design your own Voice
                              </SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                        {!isLoadingVoices && elevenLabsVoices.length === 0 && (
                          <p className="text-xs text-red-500">
                            Unable to load voices. Please check your ElevenLabs API key.
                          </p>
                        )}
                        
                        {/* Voice Instructions field - shown when "Design your own Voice" is selected, a generated voice is being used, or when voice previews are available */}
                        {(field.selectedVoiceId === "custom" || voicePreviews.some(preview => preview.generated_voice_id === field.customVoiceId) || voicePreviews.length > 0) && (
                          <div className="space-y-2 mt-4">
                            <label className="text-sm font-medium">Voice Instructions</label>
                            <p className="text-xs text-gray-500">
                              Describe the characteristics of the voice you want the AI to generate, including gender, age, accent, tone, and speaking style.
                            </p>
                            <textarea
                              value={field.voiceInstructions || ""}
                              onChange={(e) => {
                                if (onUpdateVoiceInstructions) {
                                  onUpdateVoiceInstructions(field.id, e.target.value);
                                }
                              }}
                              className="w-full min-h-[80px] rounded-md border border-gray-300 
                                px-3 py-2 text-gray-900 focus:border-primary 
                                focus:ring-primary resize-y"
                              placeholder="A 65 year old American female voice. Long time smoker with a raspy voice. Takes long pauses between sentences to catch her breath."
                            />
                            
                            {/* Generate Voice Samples Button */}
                            <div className="flex justify-end">
                              <Button
                                type="button"
                                onClick={handleGenerateVoicePreviews}
                                disabled={isGeneratingPreviews || !field.voiceInstructions?.trim()}
                                className="mt-2"
                              >
                                {isGeneratingPreviews ? "Generating..." : "Generate Voice Samples"}
                              </Button>
                            </div>

                            {/* Voice Samples Display */}
                            {(() => {
                              return voicePreviews.length > 0 ? (
                              <div className="mt-4 space-y-3">
                                <div className="border-t pt-3">
                                  <label className="text-sm font-medium mb-2 block">Generated Voice Samples</label>
                                  {previewText && (
                                    <p className="text-xs text-gray-500 mb-3">
                                      Sample text: "{previewText}"
                                    </p>
                                  )}
                                  <div className="space-y-2">
                                    {voicePreviews.map((preview, index) => (
                                      <div
                                        key={preview.generated_voice_id}
                                        className={`flex items-center justify-between p-3 border rounded-lg transition-colors ${
                                          selectedPreviewId === preview.generated_voice_id
                                            ? 'border-primary bg-primary/5'
                                            : 'border-gray-200 hover:border-gray-300'
                                        }`}
                                      >
                                        <div className="flex items-center space-x-3">
                                          <div className="flex items-center space-x-2">
                                            <input
                                              type="radio"
                                              id={`voice-${preview.generated_voice_id}`}
                                              name={`voice-selection-${field.id}`}
                                              checked={selectedPreviewId === preview.generated_voice_id}
                                              onChange={() => handleSelectPreview(preview)}
                                              className="w-4 h-4 text-primary"
                                            />
                                            <label
                                              htmlFor={`voice-${preview.generated_voice_id}`}
                                              className="text-sm font-medium cursor-pointer"
                                            >
                                              Voice {index + 1}
                                            </label>
                                          </div>
                                          <span className="text-xs text-gray-500">
                                            ({preview.duration_secs.toFixed(1)}s)
                                          </span>
                                        </div>
                                        <Button
                                          type="button"
                                          variant="outline"
                                          size="sm"
                                          onClick={() => handlePlayPreview(preview)}
                                          className="flex items-center space-x-1"
                                        >
                                          {playingPreviewId === preview.generated_voice_id ? (
                                            <Pause className="w-4 h-4" />
                                          ) : (
                                            <Play className="w-4 h-4" />
                                          )}
                                          <span>
                                            {playingPreviewId === preview.generated_voice_id ? "Pause" : "Play"}
                                          </span>
                                        </Button>
                                      </div>
                                    ))}
                                  </div>
                                  {selectedPreviewId && (
                                    <p className="text-xs text-green-600 mt-2">
                                      Selected voice will be used for text-to-speech in this chat.
                                    </p>
                                  )}
                                </div>
                              </div>
                              ) : null;
                            })()}
                          </div>
                        )}
                </div>
              )}
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  const renderValidationSection = () => {
    if (field.type === "text" || field.type === "textarea") {
      return (
        <div className="mt-2">
          <div
            onClick={() => setValidationExpanded(!isValidationExpanded)}
            className="flex items-center justify-end cursor-pointer text-sm text-gray-600"
          >
            {isValidationExpanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
            <span className="ml-1">
              {isValidationExpanded
                ? "Hide Validation Rules"
                : "Edit Validation Rules"}
            </span>
          </div>
          {isValidationExpanded && (
            <div className="mt-2 flex space-x-2">
              <input
                type="number"
                value={field.minChars || ""}
                onChange={(e) =>
                  onUpdateFieldValidation(
                    field.id,
                    e.target.value ? parseInt(e.target.value, 10) : null,
                    field.maxChars ?? null,
                    false
                  )
                }
                className="text-sm bg-transparent border border-gray-200 rounded px-2 py-1 w-1/2"
                placeholder="Min chars"
              />
              <input
                type="number"
                value={field.maxChars || ""}
                onChange={(e) =>
                  onUpdateFieldValidation(
                    field.id,
                    field.minChars ?? null,
                    e.target.value ? parseInt(e.target.value, 10) : null,
                    false
                  )
                }
                className="text-sm bg-transparent border border-gray-200 rounded px-2 py-1 w-1/2"
                placeholder="Max chars"
              />
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <Draggable draggableId={field.id?.toString() || ""} index={index}>
      {(provided) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          className="mb-4 p-4 rounded-lg border"
        >
          <div className="flex gap-4">
            <div {...provided.dragHandleProps}>
              <GripVertical className="h-5 w-5 text-gray-400 cursor-move" />
            </div>
            <div className="flex-1 space-y-2">
              {field.type !== "prompt" &&
                field.type !== "aiInstructions" &&
                field.type !== "fixedResponse" &&
                field.type !== "richText" && (
                  <textarea
                    value={field.label || ""}
                    onFocus={() => {
                      if (!field.label) {
                        onUpdateFieldLabel(
                          field.id,
                          "",
                          field.type === "prompt" ||
                            field.type === "aiInstructions" ||
                            field.type === "fixedResponse"
                        );
                      }
                    }}
                    onChange={(e) => {
                      e.target.style.height = "auto";
                      e.target.style.height = e.target.scrollHeight + "px";
                      onUpdateFieldLabel(
                        field.id,
                        e.target.value,
                        field.type === "prompt" ||
                          field.type === "aiInstructions" ||
                          field.type === "fixedResponse"
                      );
                    }}
                    className="text-md font-bold bg-transparent 
                      border-2 border-dashed border-gray-200 hover:border-gray-400 
                      focus:border-gray-600 rounded px-2 py-1 transition-colors 
                      focus:outline-none focus:ring-0 w-full cursor-text
                      resize-none overflow-hidden"
                    placeholder="Enter your question text..."
                    rows={1}
                  />
                )}

              {field.type !== "richText" && (
                <input
                  type="text"
                  value={field.name}
                  onChange={(e) =>
                    onUpdateFieldName(
                      field.id,
                      e.target.value,
                      field.type === "prompt" ||
                        field.type === "aiInstructions" ||
                        field.type === "fixedResponse"
                    )
                  }
                  onFocus={(e) => e.target.select()}
                  className="text-sm font-medium font-italic bg-transparent 
                  border-2 border-dashed border-gray-200 hover:border-gray-400 
                  focus:border-gray-600 rounded px-2 py-1 transition-colors 
                  focus:outline-none focus:ring-0 w-full cursor-text"
                  placeholder="Field ID"
                />
              )}

              {field.type !== "prompt" &&
                field.type !== "aiInstructions" &&
                field.type !== "fixedResponse" &&
                field.type !== "richText" && (
                  <>
                    {/* Description toggle button */}
                    {!showDescription && !field.description && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowDescription(true)}
                        className="text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100/50 -mt-1"
                      >
                        + Add Optional Field Description
                      </Button>
                    )}

                    {/* Description textarea - only show if expanded or has content */}
                    {(showDescription || field.description) && (
                      <div className="relative">
                        <textarea
                          value={field.description || ""}
                          onChange={(e) =>
                            onUpdateFieldDescription(
                              field.id,
                              e.target.value,
                              field.type === "prompt" ||
                                field.type === "aiInstructions"
                            )
                          }
                          className="text-sm text-gray-600 bg-transparent w-full 
                          border-2 border-dashed border-gray-200 hover:border-gray-400 
                          focus:border-gray-600 rounded px-2 py-1 transition-colors 
                          focus:outline-none focus:ring-0 min-h-[60px] resize-y cursor-text"
                          placeholder="Optional field description..."
                        />
                        {/* Remove description button */}
                        {!field.description && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowDescription(false)}
                            className="absolute top-0 right-0 text-gray-400 hover:text-gray-600"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    )}
                  </>
                )}
            </div>
          </div>
          <div className="mt-3">{renderField()}</div>
          <div className="flex items-center justify-end pt-2">
            <div className="flex items-center gap-2">
              {field.type !== "prompt" &&
                field.type !== "aiInstructions" &&
                field.type !== "fixedResponse" &&
                field.type !== "richText" && (
                  <>
                    <Switch
                      checked={field.isRequired}
                      onCheckedChange={(checked) =>
                        onUpdateFieldRequired(
                          field.id,
                          checked,
                          field.type === "prompt" ||
                            field.type === "aiInstructions" ||
                            field.type === "fixedResponse"
                        )
                      }
                    />
                    <span className="text-sm text-gray-600">Required</span>
                    <div className="border-l border-gray-300 h-5 mx-2"></div>
                  </>
                )}

              <Dialog>
                <DialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>
                      Conditional Logic for{" "}
                      {field.type === "prompt" ||
                      field.type === "aiInstructions"
                        ? "Prompt"
                        : field.name || "Field"}
                    </DialogTitle>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label htmlFor="sourceField">Show this field if</Label>
                      <Select
                        value={selectedSourceField}
                        onValueChange={setSelectedSourceField}
                      >
                        <SelectTrigger id="sourceField">
                          <SelectValue placeholder="Select a field" />
                        </SelectTrigger>
                        <SelectContent>
                          {field.type === "prompt" ||
                          field.type === "aiInstructions" ||
                          field.type === "fixedResponse"
                            ? phaseFields
                                .filter(
                                  (f) =>
                                    f.type !== "prompt" &&
                                    f.type !== "aiInstructions" &&
                                    f.type !== "fixedResponse"
                                ) // Show all non-prompt fields for prompts
                                .map((sourceField) => (
                                  <SelectItem
                                    key={sourceField.id}
                                    value={sourceField.id}
                                  >
                                    {sourceField.name ||
                                      sourceField.label ||
                                      sourceField.id}
                                  </SelectItem>
                                ))
                            : phaseFields
                                .slice(0, index) // Keep original behavior for non-prompt fields
                                .map((sourceField) => (
                                  <SelectItem
                                    key={sourceField.id}
                                    value={sourceField.id}
                                    disabled={
                                      sourceField.type === "prompt" ||
                                      sourceField.type === "aiInstructions" ||
                                      sourceField.type === "fixedResponse"
                                    }
                                  >
                                    {sourceField.name ||
                                      sourceField.label ||
                                      sourceField.id}
                                  </SelectItem>
                                ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {selectedSourceField && (
                      <div className="grid gap-2">
                        <Label htmlFor="operator">Condition</Label>
                        <Select
                          value={selectedOperator}
                          onValueChange={setSelectedOperator}
                        >
                          <SelectTrigger id="operator">
                            <SelectValue placeholder="Select condition" />
                          </SelectTrigger>
                          <SelectContent>
                            {getOperatorsForElement(
                              phaseFields.find((f) => f.id === selectedSourceField)
                                ?.type || ""
                            ).map((op) => (
                              <SelectItem key={op.value} value={op.value}>
                                {op.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {selectedSourceField &&
                      selectedOperator &&
                      operatorNeedsValue(selectedOperator) && (
                        <div className="grid gap-2">
                          <Label htmlFor="value">Value</Label>
                          {(() => {
                            const sourceField = phaseFields.find(
                              (f) => f.id === selectedSourceField
                            );
                            if (!sourceField) return null;

                            switch (sourceField.type) {
                              case "radio":
                              case "dropdown":
                                return (
                                  <Select
                                    value={
                                      sourceField.choices?.find(
                                        (choice) =>
                                          choice.text === conditionValue
                                      )?.value ||
                                      (conditionValue === "Other"
                                        ? "other"
                                        : "")
                                    }
                                    onValueChange={(value) => {
                                      // Find the choice object that matches the selected value
                                      const selectedChoice =
                                        sourceField.choices?.find(
                                          (choice) => choice.value === value
                                        );
                                      // Use the text instead of the value
                                      setConditionValue(
                                        selectedChoice?.text || value
                                      );
                                    }}
                                  >
                                    <SelectTrigger id="value">
                                      <SelectValue placeholder="Select value" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {sourceField.choices?.map((choice) => (
                                        <SelectItem
                                          key={choice.value}
                                          value={choice.value}
                                        >
                                          {choice.text}
                                        </SelectItem>
                                      ))}
                                      {sourceField.showOtherItem && (
                                        <SelectItem value="other">
                                          Other
                                        </SelectItem>
                                      )}
                                    </SelectContent>
                                  </Select>
                                );

                              case "checkbox":
                                return (
                                  <Select
                                    value={
                                      sourceField.choices?.find(
                                        (choice) =>
                                          choice.text === conditionValue
                                      )?.value ||
                                      (conditionValue === "Other"
                                        ? "other"
                                        : "")
                                    }
                                    onValueChange={(value) => {
                                      // Find the choice object that matches the selected value
                                      const selectedChoice =
                                        sourceField.choices?.find(
                                          (choice) => choice.value === value
                                        );
                                      // Use the text instead of the value
                                      setConditionValue(
                                        selectedChoice?.text || value
                                      );
                                    }}
                                  >
                                    <SelectTrigger id="value">
                                      <SelectValue placeholder="Select value" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {sourceField.choices?.map((choice) => (
                                        <SelectItem
                                          key={choice.value}
                                          value={choice.value}
                                        >
                                          {choice.text}
                                        </SelectItem>
                                      ))}
                                      {sourceField.showOtherItem && (
                                        <SelectItem value="other">
                                          Other
                                        </SelectItem>
                                      )}
                                    </SelectContent>
                                  </Select>
                                );

                              case "boolean":
                                return (
                                  <Select
                                    value={String(conditionValue)}
                                    onValueChange={(value) =>
                                      setConditionValue(value === "true")
                                    }
                                  >
                                    <SelectTrigger id="value">
                                      <SelectValue placeholder="Select value" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="true">Yes</SelectItem>
                                      <SelectItem value="false">No</SelectItem>
                                    </SelectContent>
                                  </Select>
                                );
                              case "slider":
                                return (
                                  <Input
                                    id="value"
                                    type="number"
                                    value={conditionValue as number}
                                    onChange={(e) =>
                                      setConditionValue(Number(e.target.value))
                                    }
                                    min={sourceField.minValue}
                                    max={sourceField.maxValue}
                                    step={sourceField.step || 1}
                                    className="text-sm"
                                  />
                                );

                              case "text":
                              case "textarea":
                              default:
                                return (
                                  <Input
                                    id="value"
                                    type="text"
                                    value={String(conditionValue)}
                                    onChange={(e) =>
                                      setConditionValue(e.target.value)
                                    }
                                    className="text-sm"
                                    placeholder="Enter value to compare against..."
                                  />
                                );
                            }
                          })()}
                        </div>
                      )}

                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => {
                          setSelectedSourceField("");
                          setSelectedOperator("");
                          setConditionValue("");
                          onUpdateConditionalLogic?.(field.id, null);
                        }}
                      >
                        Clear
                      </Button>
                      <Button
                        type="button"
                        onClick={() => {
                          if (!selectedSourceField || !selectedOperator) return; // Add validation

                          const logic: ConditionalLogic = {
                            sourceFieldId: selectedSourceField,
                            operator: selectedOperator,
                            ...(operatorNeedsValue(selectedOperator) && {
                              value: conditionValue,
                            }),
                          };

                          onUpdateConditionalLogic?.(field.id, logic);
                          setShowSaveSuccess(true);
                          setTimeout(() => setShowSaveSuccess(false), 2000);
                        }}
                      >
                        {showSaveSuccess ? "Saved!" : "Save"}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
              <div className="border-l border-gray-300 h-5 mx-2"></div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                onDeleteField(
                  field.id,
                  field.type === "prompt" ||
                    field.type === "aiInstructions" ||
                    field.type === "fixedResponse"
                )
              }
              className="text-red-500 hover:text-red-700 hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
          {renderValidationSection()}
        </div>
      )}
    </Draggable>
  );
}
