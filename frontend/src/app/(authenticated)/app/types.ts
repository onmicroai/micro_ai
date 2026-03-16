import { ChangeEvent } from "react";

// Add these new types
export type Answers = {
  [key: string]: AnswerValue;
};

export type AnswerValue = {
  value: string | string[];
  otherValue?: string;
};

export type Base64Images = {
  [key: string]: {
    [filename: string]: string; // filename -> base64 string
  };
};

export interface SendPromptResponse {
  success: boolean;
  response?: any;
  error?: string;
  run_passed?: boolean;
  run_uuid?: string; // Changed from runId to run_uuid to match API response
}

export type ScoreExplanationMode = "always" | "failed_only" | "passed_only" | "never";

export type setInputValue = (
  name: string,
  value: string | string[] | undefined,
  otherValue: string,
  type: string
) => void;

export type handleInputChange = (
  e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
) => void;

export type PageConfigOverride = {
  scoredPhase: boolean;
  rubric: string;
  minScore: number;
  scoreExplanation?: boolean;
  scoreExplanationMode?: ScoreExplanationMode;
  scoreFeedbackEnabled?: boolean;
  scoreFeedbackInstructions?: string;
};

export type sendPrompts = (
  prompts: Prompt[] | null,
  answers: Answers,
  appId: number,
  appConfig: SurveyJson | null,
  pageIndex: number,
  userId: number | null,
  requestSkip: boolean,
  noSubmit?: boolean,
  pageConfigOverride?: PageConfigOverride,
  runtimeMeta?: {
    tryId?: string;
    tryIndex?: number;
  }
) => Promise<SendPromptResponse>;

export interface SurveyStore {
  prompt: string | null; // The current prompt with placeholder replaced by real values
  aiInstructions: string | null; // The current AI instructions
  surveyJson: SurveyJson | null;
  currentPhase: SurveyPage | null;
  currentPhaseIndex: number; // The index of the current phase. Starts at 0 for the first phase.
  answers: Answers;
  images: Base64Images;
  responses: string[]; // A list of AI responses
  completedPhases: number[];
  errors: ErrorObject[];
  loading: boolean;
  promptLoading: boolean;
  promptResponse: any; // The most recent AI response
  sendPromptError: string | null;
  appFetchLoading: boolean;
  appFetchError: {
    status: number | null;
    message: string | null;
  };
  elements: Element[] | null;
  processedPrompts: ProcessedPrompts;
  defaultAiModel: string;
  fetchApp: (
    hashId: string,
    privatePage: boolean,
    signal: AbortSignal
  ) => Promise<boolean>;
  setPrompt: (prompt: string | null) => void;
  setAiInstructions: (aiInstructions: string | null) => void;
  setSurveyJson: (surveyJson: SurveyJson | null) => void;
  setCurrentPhase: (currentPhase: SurveyPage | null) => void;
  setCurrentPhaseIndex: (index: number) => void;
  setAnswers: (updater: (prevAnswers: Answers) => Answers) => void;
  setImages: (updater: (prevImages: Base64Images) => Base64Images) => void;
  setResponses: (updater: (prevResponses: string[]) => string[]) => void;
  setCompletedPhases: (completedPhases: number[]) => void;
  setErrors: (errors: ErrorObject[]) => void;
  setLoading: (loading: boolean) => void;
  setPromptLoading: (loading: boolean) => void;
  setInputValue: setInputValue;
  handleInputChange: handleInputChange;
  sendPrompts: sendPrompts;
  setElements: (elements: Element[] | null) => void;
  setPromptResponse: (response: any) => void;
  setSendPromptError: (error: string | null) => void;
  reset: () => void;
  softReset: () => void;
  setProcessedPrompts: (processedPrompts: ProcessedPrompts) => void;
  isPromptEmpty: (prompt: string | any[]) => boolean;
  userRole: string | null;
  userRoleLoading: boolean;
  userRoleError: {
    status: number | null;
    message: string | null;
  } | null;
  fetchUserRole: (
    hashId: string,
    userId: string,
    signal: AbortSignal
  ) => Promise<string | null>;
}

export interface SurveyPage {
  id: number;
  title: string;
  description?: string;
  elements: Element[];
  prompts: Prompt[];
  scoredPhase: boolean;
  rubric: string;
  minScore: number;
  scoreExplanation?: boolean;
  scoreExplanationMode?: ScoreExplanationMode;
  scoreFeedbackEnabled?: boolean;
  scoreFeedbackInstructions?: string;
  skipPhase: boolean;
}

export interface Prompt {
  id: string;
  name: string;
  type: "prompt" | "aiInstructions" | "fixedResponse" | "aiResponse";
  text?: string; // Make text optional
  label?: string;
  aiPromptProperty?: string; // AI prompt property
  aiModel?: string; // AI model
  temperature?: number;
  conditionalLogic?: ConditionalLogic;
  instructions?: AIResponseInstruction[];
}

export interface AIResponseInstruction {
  text: string;
  conditionalLogic?: ConditionalLogic;
}

export interface Value {
  name: string;
  value: string;
}

export interface Conditional {
  question: string;
  operator: string;
  value: string;
}

export interface Instruction {
  prompt: Prompt;
  conditionals: Conditional[];
}

export interface Instructions {
  instructions: Instruction[];
}

export interface AiInstruction {
  prompt: Prompt;
  conditionals: [Conditional];
}

/**
 * V2 builder/runtime instruction piece used inside an AI Response card.
 * This is NOT a chat message role; it's a UI-authored prompt part that we
 * concatenate into a single user prompt at run-time.
 */
export interface ElementInstruction {
  text: string;
  conditionalLogic?: ConditionalLogic;
}

export type ElementType =
  // Input fields
  | "text"
  | "textarea"
  | "radio"
  | "checkbox"
  | "dropdown"
  | "slider"
  | "boolean"
  | "richText"
  | "chat"
  | "imageUpload"
  // Legacy prompt elements (phase-based)
  | "prompt"
  | "aiInstructions"
  | "fixedResponse"
  // V2 elements (no phases)
  | "title"
  | "aiResponse"
  | "scoring";

export interface Element {
  // Core properties
  id: string;
  name: string;
  title?: string;
  type: ElementType;
  label: string;
  description?: string;
  isRequired: boolean;
  readOnly?: boolean;

  // Value and default properties
  value?: string;
  defaultValue?: string | string[] | number | boolean | undefined;
  placeholder?: string;
  /**
   * For legacy phase prompts + fixedResponse, and for some static elements.
   * V2 AI Response cards should use `instructions[]` instead.
   */
  text?: string;

  /**
   * V2 AI Response card prompt parts (concatenated at run-time).
   */
  instructions?: ElementInstruction[];

  /**
   * V2 scoring card configuration (runtime-run scoring).
   */
  rubric?: string;
  minScore?: number;
  scoreFeedbackEnabled?: boolean;
  scoreFeedbackInstructions?: string;

  // Text input specific
  minChars?: number;
  maxChars?: number;

  // Choice-based fields (radio, checkbox, dropdown)
  choices?: Choice[];
  showOtherItem?: boolean;
  otherText?: string;
  otherPlaceholder?: string;
  otherErrorText?: string;
  showNoneItem?: boolean;
  noneText?: string;

  // Slider specific
  minValue?: number;
  maxValue?: number;
  step?: number;

  // Boolean specific
  labelTrue?: string;
  labelFalse?: string;
  swapOrder?: boolean;

  // Rich text specific
  html?: string;

  // Image upload specific
  multiple?: boolean;
  maxFiles?: number;
  maxFileSize?: number;
  allowedFileTypes?: string[];

  // Chat specific
  maxMessages?: number;
  initialMessage?: string;
  chatbotInstructions?: string;
  avatarUrl?: string; // URL for the chat avatar image

  // TTS specific (for chat fields)
  ttsProvider?: string;
  selectedVoiceId?: string;
  customVoiceId?: string; // ID of the generated custom voice when selectedVoiceId is 'custom'
  enableTts?: boolean;
  voiceInstructions?: string;

  // Conditional logic
  conditionalLogic?: ConditionalLogic;
}

export interface Choice {
  text: string;
  value: string;
}

export interface ConditionalLogic {
  sourceFieldId: string;
  operator: string;
  value?: string | number | boolean; // Made optional
}

export interface SurveyJson {
  title: string;
  description: string;
  /**
   * Legacy (phase-based) runtime config.
   * Existing apps may still contain this shape.
   */
  phases: SurveyPage[];
  /**
   * V2 (no-phases) runtime config.
   * New apps should prefer this.
   */
  elements?: Element[];
  attachedFiles: AttachedFile[];
  id: number;
  hashId: string;
  privacy: string;
  temperature: number;
  copyAllowed: boolean;
  completedHtml: string;
  aiConfig: AIConfig;
}

/**
 * V2 builder/runtime app_json shape (stored as a string in backend).
 * Backend is schema-agnostic; frontend owns this contract.
 */
export interface AppJsonV2 {
  title?: string;
  description?: string;
  privacySettings?: string;
  clonable?: boolean;
  completedHtml?: string;
  attachedFiles?: AttachedFile[];
  aiConfig?: AIConfig;
  elements: Element[];
}

export interface SurveyCreatorProps {
  hashId: string;
}

export type ChoiceType = {
  value: string;
  text: string;
};

export type PhaseType = {
  id: string;
  name: string;
  title: string;
  description: string;
  elements: Element[];
  prompts: Element[];
  skipPhase: boolean;
  scoredPhase: boolean;
  rubric: string;
  minScore?: number;
};

export interface SurveyState {
  /**
   * V2 editor state: single ordered list of builder elements.
   * Legacy phases are migrated on load and never authored by the new builder.
   */
  elements: Element[];
  title: string | undefined;
  description: string | undefined;
  collectionId: number | null;
  privacy: string;
  embedAllowedDomains: string[];
  clonable: boolean;
  completedHtml: string;
  attachedFiles: AttachedFile[];
  aiConfig: AIConfig;
  setAIConfig: (
    aiConfig: AIConfig,
    skipServerUpdate?: boolean,
    signal?: AbortSignal
  ) => Promise<void>;
  setElements: (
    elements: Element[],
    skipServerUpdate?: boolean,
    signal?: AbortSignal
  ) => Promise<void>;
  setTitle: (
    title: string | undefined,
    skipServerUpdate?: boolean,
    signal?: AbortSignal
  ) => void;
  setDescription: (
    description: string | undefined,
    skipServerUpdate?: boolean,
    signal?: AbortSignal
  ) => void;
  setCollectionId: (
    id: number | null,
    skipServerUpdate?: boolean,
    signal?: AbortSignal
  ) => void;
  setPrivacy: (
    privacy: string,
    skipServerUpdate?: boolean,
    signal?: AbortSignal
  ) => void;
  setEmbedAllowedDomains: (
    domains: string[],
    skipServerUpdate?: boolean,
    signal?: AbortSignal
  ) => void;
  setClonable: (
    clonable: boolean,
    skipServerUpdate?: boolean,
    signal?: AbortSignal
  ) => void;
  setCompletedHtml: (
    completedHtml: string,
    skipServerUpdate?: boolean,
    signal?: AbortSignal
  ) => void;
  resetStore: (signal?: AbortSignal) => void;
  saveState: SaveState;
  appId: number | null;
  setSaveState: (saveState: Partial<SaveState>) => void;
  setAppId: (id: number | null) => void;
  saveToServer: (signal?: AbortSignal) => Promise<void>;
  isInitialLoad: boolean;
  setIsInitialLoad: (isInitialLoad: boolean) => void;
  collections: { value: number; text: string }[];
  availableModels: ModelTemperatureRanges;
  defaultAiModel: string;
  isLoadingCollections: boolean;
  isLoadingModels: boolean;
  fetchCollections: () => Promise<void>;
  fetchModels: () => Promise<void>;
  fetchLiteLLMModels: () => Promise<void>;
  setAttachedFiles: (
    attachedFiles: AttachedFile[],
    skipServerUpdate?: boolean,
    signal?: AbortSignal
  ) => Promise<void>;
  addAttachedFile: (
    file: AttachedFile,
    skipServerUpdate?: boolean,
    signal?: AbortSignal
  ) => Promise<void>;
  removeAttachedFile: (
    filename: string,
    skipServerUpdate?: boolean,
    signal?: AbortSignal
  ) => Promise<void>;
  conditionalSidebarOpen: boolean;
  setConditionalSidebarOpen: (open: boolean) => void;
  conditionalSidebarContext: {
    field: Element | Prompt;
    currentLogic?: ConditionalLogic;
    instructionIndex?: number;
  } | null;
  setConditionalSidebarContext: (
    context: {
      field: Element | Prompt;
      currentLogic?: ConditionalLogic;
      instructionIndex?: number;
    } | null
  ) => void;
}

export interface SaveState {
  isSaving: boolean;
  isDebouncing: boolean;
  lastSaved: Date | null;
  error: string | null;
}

export interface TemperatureRange {
  min: number;
  max: number;
}

export interface ModelTemperatureRanges {
  [modelName: string]: TemperatureRange;
}

export interface AttachedFile {
  original_filename: string;
  text_filename: string;
  size: number;
  word_count?: number;
  description?: string;
}

export interface AIConfig {
  aiModel: string;
  temperature: number;
  maxResponseTokens: number | null;
  systemPrompt: string;
}

export interface FileWithPreview extends File {
  preview: string;
}

export interface RenderElementProps {
  element: Element;
  answers?: Answers;
  handleInputChange: handleInputChange;
  required?: boolean;
  visible?: boolean;
}

export interface RenderPromptProps {
  prompt: Prompt;
  answers?: Answers;
  handleInputChange: handleInputChange;
  required?: boolean;
  visible?: boolean;
}

export interface ErrorObject {
  element: string;
  error: string;
}

export interface ProcessedPrompts {
  prompts: string[];
  aiInstructions: string[];
  fixedResponses: string[];
}

export const HIDDEN_HEADER_ELEMENTS = [
  "required",
  "conditionalLogic",
  "delete",
  "dragHandle",
  "rename",
  "fieldTypeSelector",
  "fieldLabel",
] as const;

export type HiddenHeaderElement = (typeof HIDDEN_HEADER_ELEMENTS)[number];
