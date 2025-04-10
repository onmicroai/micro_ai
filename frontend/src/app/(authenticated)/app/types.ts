import { ChangeEvent } from "react";
import { AttachedFile } from "./(pages)/edit/[id]/types";

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
    [filename: string]: string;  // filename -> base64 string
  };
};

export interface SendPromptResponse {
   success: boolean;
   response?: any;
   error?: string;
   run_passed?: boolean;
}

export type setInputValue = (name: string, value: string | string[] | undefined, otherValue: string, type: string) => void;

export type handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;

export type sendPrompts = (
  prompts: Prompt[] | null, 
  answers: Answers,
  appId: number, 
  appConfig: SurveyJson | null, 
  pageIndex: number, 
  userId: number | null, 
  requestSkip: boolean,
  noSubmit?: boolean
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
   fetchApp: (hashId: string, privatePage: boolean, signal: AbortSignal) => Promise<boolean>;
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
  skipPhase: boolean;
}

export interface Prompt {
  id: string;
  name: string;
  text: string;
  type: 'prompt' | 'aiInstructions' | 'fixedResponse';
  label?: string;
  aiPromptProperty?: string; // AI prompt property
  aiModel?: string; // AI model
  temperature?: number;
  conditionalLogic?: ConditionalLogic;
}

export interface Element {
  description: any; // Description of the field
  placeholder: string | undefined; // Placeholder text for the field
  swapOrder: any; // Swap the order of true/false?
  labelFalse: string; // Label for the false option
  labelTrue: string; // Label for the true option
  defaultValue: boolean | string | number | readonly string[] | undefined; // Default value for the field
  title: string; // Title of the field
  readOnly: boolean; // Is the field read-only?
  showOtherItem?: boolean; // Show the other item?
  otherText?: string; // Text for the other item
  otherPlaceholder?: string; // Placeholder for the other item
  showNoneItem?: boolean;
  noneText?: string;
  otherErrorText?: string;
  id: string;
  name: string;
  type: 'text' | 'textarea' | 'radio' | 'checkbox' | 'dropdown' | 'slider' | 'boolean' | 'richText' | 'chat';
  label: string;
  isRequired: boolean | false;
  maxChars?: number;
  minChars?: number;
  choices?: Choice[];
  step?: number;
  maxValue?: number;
  minValue?: number;
  html?: string;
  conditionalLogic?: ConditionalLogic;
  // Image upload specific properties
  multiple?: boolean;
  maxFiles?: number;
  maxFileSize?: number;
  allowedFileTypes?: string[];
  maxMessages?: number;      // For chatbot: maximum number of messages
  initialMessage?: string;   // For chatbot: initial assistant message
  chatbotInstructions?: string;
}

export interface Choice {
  text: string;
  value: string;
}

export interface ConditionalLogic {
  value: string;
  operator: string;
  sourceFieldId: string;
}

export interface SurveyJson {
   title: string;
   description: string;
   phases: SurveyPage[];
   attachedFiles: AttachedFile[];
   id: number;
   hashId: string;
   privacy: string;
   temperature: number;
   copyAllowed: boolean;
   completedHtml: string;
   aiConfig: AIConfig;
}

export interface AIConfig {
  aiModel: string;
  temperature: number;
  maxResponseTokens: number;
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