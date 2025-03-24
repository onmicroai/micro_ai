export interface Conditional {
  question: string;
  operator: string;
  value: string;
}

export interface Prompt {
  index: number;
  text: string;
}

export interface Instruction {
  prompt: Prompt;
  conditionals: Conditional[];
}

export interface Instructions {
  instructions: Instruction[];
}

export interface Value {
  name: string;
  value: string;
}

export interface AiInstruction {
  prompt: Prompt;
  conditionals: [Conditional];
}

export interface SurveyData {
  title?: string;
  description?: string;
  type?: string;
  temperature?: number;
  clonable?: boolean;
  collectionId?: number | null;
  aiModel?: string;
  copyAllowed?: boolean;
  app_json?: any;
  [key: string]: any;
}

export interface SurveyCreatorProps {
  hashId: string;
}

export interface ConditionalLogic {
   sourceFieldId: string;
   operator: string;
   value?: string | number | boolean;
 }
 
 export type ChoiceType = {
   value: string;
   text: string;
 };

 export type FieldType = {
   id: string;
   type: 'text' | 'textarea' | 'radio' | 'checkbox' | 'dropdown' | 'slider' | 'boolean' | 'prompt' | 'richText' | 'aiInstructions' | 'fixedResponse' | 'imageUpload' | 'chat';
   label: string;
   description?: string;
   value?: string;
   name?: string;
   isRequired: boolean;
   minChars?: number;
   maxChars?: number;
   text?: string;
   defaultValue?: string | string[] | number | boolean;
   placeholder?: string;
   choices?: ChoiceType[];
   showOtherItem?: boolean;
   minValue?: number;
   maxValue?: number;
   step?: number;
   html?: string;
   conditionalLogic?: ConditionalLogic;
   multiple?: boolean;
   maxFiles?: number;
   maxFileSize?: number;
   allowedFileTypes?: string[];
   maxMessages?: number;
   initialMessage?: string;
   chatbotInstructions?: string;
 };
 
 export type PhaseType = {
   id: string;
   name: string;
   title: string;
   description: string;
   elements: FieldType[];
   prompts: FieldType[];
   skipPhase: boolean;
   scoredPhase: boolean;
   rubric: string;
   minScore?: number;
 };

export interface SaveState {
  isSaving: boolean;
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

interface AIConfig {
  aiModel: string;
  temperature: number;
  maxResponseTokens: number | null;
  systemPrompt: string;
}

export interface SurveyState {
  phases: PhaseType[];
  title: string | undefined;
  description: string | undefined;
  collectionId: number | null;
  privacy: string;
  clonable: boolean;
  completedHtml: string;
  aiConfig: AIConfig;
  setAIConfig: (aiConfig: AIConfig, skipServerUpdate?: boolean, signal?: AbortSignal) => Promise<void>;
  setPhases: (phases: any, skipServerUpdate?: boolean, signal?: AbortSignal) => void;
  setTitle: (title: string | undefined, skipServerUpdate?: boolean, signal?: AbortSignal) => void;
  setDescription: (description: string | undefined, skipServerUpdate?: boolean, signal?: AbortSignal) => void;
  setCollectionId: (id: number | null, skipServerUpdate?: boolean, signal?: AbortSignal) => void;
  setPrivacy: (privacy: string, skipServerUpdate?: boolean, signal?: AbortSignal) => void;
  setClonable: (clonable: boolean, skipServerUpdate?: boolean, signal?: AbortSignal) => void;
  setCompletedHtml: (completedHtml: string, skipServerUpdate?: boolean, signal?: AbortSignal) => void;
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
  isLoadingCollections: boolean;
  isLoadingModels: boolean;
  fetchCollections: () => Promise<void>;
  fetchModels: () => Promise<void>;
}

export interface SaveState {
   isSaving: boolean;
   lastSaved: Date | null;
   error: string | null;
 }