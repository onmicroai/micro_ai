import { FileText, Globe, Link as LinkIcon, Type } from "lucide-react";
import type { KnowledgeSourceType } from "@/app/(authenticated)/app/types";

export const SOURCE_TYPE_LABELS: Record<KnowledgeSourceType, string> = {
  file: "File",
  webpage: "Web page",
  website: "Website",
  text: "Text",
};

const ICONS = {
  file: FileText,
  webpage: LinkIcon,
  website: Globe,
  text: Type,
} as const;

export function SourceTypeIcon({
  type,
  className,
}: {
  type: KnowledgeSourceType;
  className?: string;
}) {
  const Icon = ICONS[type] ?? FileText;
  return <Icon className={className} aria-hidden="true" />;
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString();
}
