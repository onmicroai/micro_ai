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
import { useEffect, useState } from "react";

interface FieldHeaderProps {
  icon?: React.ComponentType<{ className?: string }>;
  label: string;
  fieldId: string;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  onMove?: () => void;
  onDelete?: () => void;
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
  onRename?: (newName: string) => void;
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
  onRename,
}: FieldHeaderProps) {
  const [editOpen, setEditOpen] = useState(false);
  const [newName, setNewName] = useState(fieldId);

  useEffect(() => {
    setNewName(fieldId);
  }, [fieldId]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewName(e.target.value);
    onRename?.(e.target.value);
  };
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
          className="text-xs font-normal bg-blue-50 text-blue-700 hover:bg-blue-50 cursor-pointer"
          onClick={() => setEditOpen(true)}
        >
          {fieldId}
        </Badge>
        {editOpen && (
          <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/20">
            <div className="bg-white rounded-lg shadow-lg p-6 min-w-[300px]">
              <div className="mb-2 font-medium">Edit name</div>
              <input
                className="border rounded px-2 py-1 w-full"
                value={newName}
                onChange={handleChange}
                autoFocus
              />
              <div className="flex justify-end gap-2 mt-4">
                <Button
                  variant="outline"
                  onClick={() => setEditOpen(false)}
                  type="button"
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        )}
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
