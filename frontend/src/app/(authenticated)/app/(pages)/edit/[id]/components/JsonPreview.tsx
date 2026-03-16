"use client";

import { AttachedFile, Element } from '@/app/(authenticated)/app/types';
import { ScrollArea } from "./ui/scroll-area";

interface JsonPreviewProps {
  elements: Element[];
  title: string;
  description: string;
  collections: number[];
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
  elements,
  title,
  description,
  collections,
  privacySettings,
  clonable,
  completedHtml,
  attachedFiles,
  aiConfig,
}: JsonPreviewProps) {
  const formData = {
    title,
    description,
    collections,
    privacySettings,
    clonable,
    completedHtml,
    attachedFiles: attachedFiles.map((file) => ({
      original_filename: file.original_filename,
      text_filename: file.text_filename,
      size: file.size,
      word_count: file.word_count,
      description: file.description,
    })),
    aiConfig: {
      aiModel: aiConfig.aiModel,
      temperature: aiConfig.temperature,
      maxResponseTokens: aiConfig.maxResponseTokens,
      systemPrompt: aiConfig.systemPrompt,
    },
    elements: Array.isArray(elements) ? elements : []
  };

  return (
    <ScrollArea className="h-[400px] w-full rounded-md border bg-muted/50 p-4">
      <pre className="font-mono text-sm">
        {JSON.stringify(formData, null, 2)}
      </pre>
    </ScrollArea>
  );
}
