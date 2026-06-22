import {
  Answers,
  ConditionalLogic,
  Element,
} from "@/app/(authenticated)/app/types";
import evaluateVisibility from "@/utils/evaluateVisibility";

export type FormAttachmentPayload = {
  fieldName: string;
  fieldLabel: string;
  filename: string;
  text: string;
  wordCount?: number;
};

export type UserAttachmentMetadata = {
  filename: string;
  word_count?: number;
  field_name?: string;
};

/**
 * Collects ready file attachments from visible Long Text fields.
 */
export function gatherFormAttachments(
  elements: Element[],
  answers: Answers,
): FormAttachmentPayload[] {
  const result: FormAttachmentPayload[] = [];

  for (const element of elements) {
    if (element.type !== "textarea") continue;
    if (element.allowFileUpload === false) continue;

    const isVisible = evaluateVisibility(
      (element.conditionalLogic || {}) as ConditionalLogic,
      answers,
    );
    if (!isVisible) continue;

    const attachments = answers[element.name]?.attachments ?? [];
    for (const att of attachments) {
      if (att.status === "ready" && att.text?.trim()) {
        result.push({
          fieldName: element.name,
          fieldLabel: element.label || element.name,
          filename: att.filename,
          text: att.text,
          wordCount: att.wordCount,
        });
      }
    }
  }

  return result;
}

export function formatAttachmentsBlock(
  attachments: FormAttachmentPayload[],
): string {
  if (!attachments.length) return "";
  const parts = attachments.map((a) => `## ${a.filename}\n${a.text}`);
  return `\n\n<attached_files>\n${parts.join("\n\n")}\n</attached_files>`;
}

export function formatUserAttachmentsMetadata(
  attachments: FormAttachmentPayload[],
): UserAttachmentMetadata[] {
  return attachments.map((a) => ({
    filename: a.filename,
    word_count: a.wordCount,
    field_name: a.fieldName,
  }));
}
