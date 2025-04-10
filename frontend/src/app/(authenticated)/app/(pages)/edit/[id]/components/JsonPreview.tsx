"use client";

import { PhaseType, AttachedFile } from '../types';
import { ScrollArea } from "./ui/scroll-area";

interface JsonPreviewProps {
  phases: PhaseType[];
  title: string;
  description: string;
  collection: number;
  privacySettings: string;
  clonable: boolean;
  completedHtml: string;
  attachedFiles: AttachedFile[];
  aiConfig: {
    aiModel: string;
    temperature: number;
    maxResponseTokens: number | null;
    systemPrompt: string;
  };
}

export default function JsonPreview({
  phases,
  title,
  description,
  collection,
  privacySettings,
  clonable,
  completedHtml,
  attachedFiles,
  aiConfig
}: JsonPreviewProps) {
  const formData = {
    title,
    description,
    collection,
    privacySettings,
    clonable,
    completedHtml,
    attachedFiles: attachedFiles.map(file => ({
      original_filename: file.original_filename,
      text_filename: file.text_filename,
      size: file.size,
      word_count: file.word_count,
      description: file.description
    })),
    aiConfig: {
      aiModel: aiConfig.aiModel,
      temperature: aiConfig.temperature,
      maxResponseTokens: aiConfig.maxResponseTokens,
      systemPrompt: aiConfig.systemPrompt,
    },
    phases: (Array.isArray(phases) ? phases : []).map(phase => ({
      id: phase.id,
      title: phase.title,
      description: phase.description,
      skipPhase: phase.skipPhase,
      scoredPhase: phase.scoredPhase,
      rubric: phase.rubric,
      minScore: phase.minScore,
      fields: (Array.isArray(phase.elements) ? phase.elements : []).map(field => ({
        id: field.id,
        type: field.type,
        name: field.name,
        ...(field.type !== 'prompt' && field.type !== 'aiInstructions' ? {
          label: field.label,
        } : {}),
        description: field.description,
        isRequired: field.isRequired,
        ...(field.type === 'imageUpload' ? {
          multiple: field.multiple,
          maxFiles: field.maxFiles,
          maxFileSize: field.maxFileSize,
          allowedFileTypes: field.allowedFileTypes,
        } : {}),
        ...(field.type === 'chat' ? {
          maxMessages: field.maxMessages,
          initialMessage: field.initialMessage,
          chatbotInstructions: field.chatbotInstructions,
        } : {}),
        ...(field.type === 'text' || field.type === 'textarea' ? {
          minChars: field.minChars,
          maxChars: field.maxChars,
          defaultValue: field.defaultValue,
          placeholder: field.placeholder,
        } : {}),
        ...(field.type === 'radio' || field.type === 'checkbox' || field.type === 'dropdown' ? {
          choices: field.choices,
          showOtherItem: field.showOtherItem,
          defaultValue: field.defaultValue,
        } : {}),
        ...(field.type === 'slider' ? {
          minValue: field.minValue,
          maxValue: field.maxValue,
          defaultValue: field.defaultValue,
          step: field.step,
        } : {}),
        ...(field.type === 'boolean' ? {
          defaultValue: field.defaultValue,
        } : {}),
        ...(field.type === 'prompt' || field.type === 'aiInstructions' ? {
          aiPromptProperty: field.text,
        } : {}),  
        ...(field.type === 'richText' ? {
          html: field.html,
        } : {}),
        ...(field.conditionalLogic && {
          conditionalLogic: {
            sourceFieldId: field.conditionalLogic.sourceFieldId,
            operator: field.conditionalLogic.operator,
            value: field.conditionalLogic.value
          }
        }),
      })),
      prompts: (Array.isArray(phase.prompts) ? phase.prompts : []).map(prompt => ({
        id: prompt.id,
        type: prompt.type,
        name: prompt.name,
        text: prompt.text,
        ...(prompt.conditionalLogic && {
          conditionalLogic: {
            sourceFieldId: prompt.conditionalLogic.sourceFieldId,
            operator: prompt.conditionalLogic.operator,
            value: prompt.conditionalLogic.value
          }
        }),
      }))
    }))
  };

  return (
    <ScrollArea className="h-[400px] w-full rounded-md border bg-muted/50 p-4">
      <pre className="font-mono text-sm">
        {JSON.stringify(formData, null, 2)}
      </pre>
    </ScrollArea>
  );
}