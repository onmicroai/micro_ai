"use client";

import {
  ChevronDown,
  ChevronUp,
  Split,
  Trash2,
  GripVertical,
} from "lucide-react";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";

interface FieldHeaderProps {
  icon?: React.ComponentType<{ className?: string }>;
  label: string;
  fieldId: string;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  onMove?: () => void;
  onDelete?: () => void;
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
}

export default function FieldHeader({
  icon: Icon,
  label,
  fieldId,
  isCollapsed = false,
  onToggleCollapse,
  onMove,
  onDelete,
  dragHandleProps,
}: FieldHeaderProps) {
  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center gap-2">
        {dragHandleProps && (
          <div {...dragHandleProps} className="cursor-move text-gray-400">
            <GripVertical className="h-5 w-5" />
          </div>
        )}{" "}
        {Icon && <Icon className="h-5 w-5 text-gray-600" />}
        <span className="font-medium text-gray-900">{label}</span>
        <button
          type="button"
          onClick={onToggleCollapse}
          className="focus:outline-none"
          aria-label={isCollapsed ? "Expand" : "Collapse"}
        >
          {isCollapsed ? (
            <ChevronDown className="h-5 w-5" />
          ) : (
            <ChevronUp className="h-5 w-5" />
          )}
        </button>
        <Badge
          variant="secondary"
          className="text-xs font-normal bg-blue-50 text-blue-700 hover:bg-blue-50"
        >
          {fieldId}
        </Badge>
      </div>

      <div className="flex items-center gap-1">
        {onMove && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onMove}
            className="h-8 w-8 p-0 hover:bg-gray-100"
          >
            <Split className="h-4 w-4 text-gray-500" />
          </Button>
        )}
        {onDelete && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
            className="h-8 w-8 p-0 hover:bg-gray-100"
          >
            <Trash2 className="h-4 w-4 text-gray-500" />
          </Button>
        )}
      </div>
    </div>
  );
}
