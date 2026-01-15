"use client";

import { Split, Trash2, GripVertical, Pencil } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Switch } from "../../components/ui/switch";
import { useEffect, useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../../components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "../../components/ui/select";
import { Input } from "../../components/ui/input";
import {
  ConditionalLogic,
  Element,
  HiddenHeaderElement,
} from "@/app/(authenticated)/app/types";
import { availableSections } from "../FormBuilder";
import { motion, AnimatePresence } from "framer-motion";
import { useSurveyStore } from "../../store/editSurveyStore";
interface FieldHeaderProps {
  icon?: React.ComponentType<{ className?: string }>;
  label: string;
  fieldId: string;
  fieldType?: string;
  isPreviewMode?: boolean;
  onMove?: () => void;
  onDelete?: () => void;
  onFieldTypeChange?: (newType: string) => void;
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
  onRename?: (newName: string) => void;
  // Required toggle props
  isRequired?: boolean;
  onRequiredChange?: (isRequired: boolean) => void;
  // Conditional logic props
  showConditionalLogic?: boolean;
  conditionalLogic?: ConditionalLogic;
  onConditionalLogicChange?: (logic: ConditionalLogic | null) => void;
  availableFields?: Element[];
  // Generic hidden elements
  hiddenElements?: HiddenHeaderElement[];
  isDragging?: boolean;
}

export default function FieldHeader({
  icon: Icon,
  label,
  fieldId,
  fieldType,
  isPreviewMode = false,
  onDelete,
  onFieldTypeChange,
  dragHandleProps,
  onRename,
  isRequired = false,
  onRequiredChange,
  hiddenElements = [],
  isDragging = false,
}: FieldHeaderProps) {
  const [editOpen, setEditOpen] = useState(false);
  const [newName, setNewName] = useState(fieldId);

  const { setConditionalSidebarOpen } = useSurveyStore();

  const isHidden = (element: HiddenHeaderElement): boolean => {
    return hiddenElements.includes(element);
  };

  useEffect(() => {
    setNewName(fieldId);
  }, [fieldId]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewName(e.target.value);
    onRename?.(e.target.value);
  };

  const handleAliasKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      setEditOpen(false);
    }
    if (e.key === "Enter") {
      e.preventDefault();
      setEditOpen(false);
    }
  };

  return (
    <div
      className="flex items-center justify-between w-full cursor-pointer select-none mb-4 min-h-[32px]"
      tabIndex={0}
      role="button"
    >
      <div className="flex items-center gap-2">
        <AnimatePresence initial={false} mode="popLayout">
          {" "}
          {!isHidden("dragHandle") && dragHandleProps && (
            <motion.div
              initial={{ opacity: 0, x: -24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
              {...(!isDragging ? { layout: true } : {})}
              key="drag-handle"
              className="flex items-center gap-2"
            >
              <div
                {...dragHandleProps}
                className="cursor-move text-gray-400"
                onClick={(e) => e.stopPropagation()}
              >
                <GripVertical className="h-5 w-5" />
              </div>
            </motion.div>
          )}
          {!isHidden("fieldLabel") && fieldType && onFieldTypeChange && (
            <motion.div
              key="fieldLabel"
              initial={{ opacity: 0, x: -24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              {...(!isDragging ? { layout: true } : {})}
              transition={{
                duration: 0.3,
                ease: [0.4, 0, 0.2, 1],
                delay: 0.05,
              }}
            >
              <Select
                value={fieldType}
                onValueChange={(value) => {
                  onFieldTypeChange(value);
                }}
              >
                <SelectTrigger
                  className="h-auto px-2 py-1 border-none bg-transparent hover:bg-gray-100 focus:outline-none focus:ring-0 gap-2 text-sm"
                  onClick={(e) => e.stopPropagation()}
                  aria-label="Change field type"
                >
                  <div className="flex items-center gap-2">
                    {Icon && <Icon className="h-5 w-5 text-gray-600" />}
                    <span className="font-medium text-gray-900">{label}</span>
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {availableSections.map((type) => {
                    const TypeIcon = type.icon;
                    return (
                      <SelectItem key={type.id} value={type.id}>
                        <div className="flex items-center gap-2">
                          <TypeIcon className="h-4 w-4" />
                          <span>{type.label}</span>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </motion.div>
          )}
          <Popover open={editOpen} onOpenChange={setEditOpen}>
            {!isHidden("rename") && (
              <motion.div
                key="rename"
                initial={{ opacity: 0, x: -24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -24 }}
                {...(!isDragging ? { layout: true } : {})}
                transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                className="flex items-center "
              >
                {isPreviewMode ? (
                  <Badge
                    variant="secondary"
                    className="text-xs font-normal border-gray-300 bg-transparent text-blue-700 hover:bg-transparent cursor-default flex items-center gap-1 cursor-pointer"
                  >
                    {fieldId}
                  </Badge>
                ) : (
                  <PopoverTrigger asChild>
                    <motion.button
                      {...(!isDragging ? { layout: true } : {})}
                      type="button"
                      aria-label="Edit field alias"
                      className="rounded-full focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Badge
                        variant="secondary"
                        className="text-xs font-normal border-gray-300 bg-transparent text-blue-700 hover:bg-transparent cursor-pointer flex items-center gap-1"
                      >
                        <Pencil className="h-3 w-3" />
                        {fieldId}
                      </Badge>
                    </motion.button>
                  </PopoverTrigger>
                )}
              </motion.div>
            )}
            {!isPreviewMode && (
              <PopoverContent align="start" side="bottom" className="w-72 p-2">
                <div className="space-y-2">
                  <div className="text-xs font-medium text-gray-900">
                    Edit name
                  </div>
                  <Input
                    className="border rounded px-2 py-1 w-full text-sm"
                    value={newName}
                    onChange={handleChange}
                    onKeyDown={handleAliasKeyDown}
                    autoFocus
                  />
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setEditOpen(false)}
                      type="button"
                    >
                      Close
                    </Button>
                  </div>
                </div>
              </PopoverContent>
            )}
          </Popover>
        </AnimatePresence>
      </div>

      <div className="flex items-center gap-2">
        <AnimatePresence initial={false}>
          {!isHidden("required") && (
            <motion.div
              key="required"
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 24 }}
              {...(!isDragging ? { layout: true } : {})}
              transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
              className="flex items-center gap-2"
            >
              <Switch
                checked={isRequired}
                onCheckedChange={onRequiredChange}
                onClick={(e) => e.stopPropagation()}
              />
              <span className="text-sm text-gray-600">Required</span>
            </motion.div>
          )}

          {!isHidden("required") && !isHidden("conditionalLogic") && (
            <motion.div
              key="divider1"
              initial={{ opacity: 0, scaleX: 0 }}
              animate={{ opacity: 1, scaleX: 1 }}
              exit={{ opacity: 0, scaleX: 0 }}
              {...(!isDragging ? { layout: true } : {})}
              transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
              className="border-l border-gray-300 h-5 mx-2"
            />
          )}
          <AnimatePresence>
            {!isHidden("conditionalLogic") && (
              <motion.div
                key="conditionalLogic"
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 24 }}
                {...(!isDragging ? { layout: true } : {})}
                transition={{
                  duration: 0.3,
                  ease: [0.4, 0, 0.2, 1],
                  delay: 0.05,
                }}
              >
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 hover:bg-gray-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    setConditionalSidebarOpen(true);
                  }}
                >
                  <Split className="h-4 w-4 text-gray-500" />
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
          {!isHidden("conditionalLogic") && !isHidden("delete") && onDelete && (
            <motion.div
              key="divider2"
              initial={{ opacity: 0, scaleX: 0 }}
              animate={{ opacity: 1, scaleX: 1 }}
              exit={{ opacity: 0, scaleX: 0 }}
              {...(!isDragging ? { layout: true } : {})}
              transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1], delay: 0.1 }}
              className="border-l border-gray-300 h-5 mx-2"
            />
          )}

          {!isHidden("delete") && onDelete && (
            <motion.div
              key="delete"
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 24 }}
              {...(!isDragging ? { layout: true } : {})}
              transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1], delay: 0.1 }}
            >
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                className="h-8 w-8 p-0 hover:bg-gray-100"
              >
                <Trash2 className="h-4 w-4 text-gray-500" />
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
