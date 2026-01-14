"use client";

import { Split, Trash2, GripVertical } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Switch } from "../../components/ui/switch";
import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../../components/ui/dialog";
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
  SelectValue,
} from "../../components/ui/select";
import { Label } from "../../components/ui/label";
import { Input } from "../../components/ui/input";
import {
  ConditionalLogic,
  Element,
  HiddenHeaderElement,
} from "@/app/(authenticated)/app/types";
import { availableSections } from "../FormBuilder";
import { motion } from "framer-motion";

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
}

export default function FieldHeader({
  icon: Icon,
  label,
  fieldId,
  fieldType,
  isPreviewMode: isCollapsed = false,
  onDelete,
  onFieldTypeChange,
  dragHandleProps,
  onRename,
  isRequired = false,
  onRequiredChange,
  conditionalLogic,
  onConditionalLogicChange,
  availableFields = [],
  hiddenElements = [],
}: FieldHeaderProps) {
  const [editOpen, setEditOpen] = useState(false);
  const [newName, setNewName] = useState(fieldId);
  const [conditionalDialogOpen, setConditionalDialogOpen] = useState(false);
  const [selectedSourceField, setSelectedSourceField] = useState<string>(
    conditionalLogic?.sourceFieldId || ""
  );
  const [selectedOperator, setSelectedOperator] = useState<string>(
    conditionalLogic?.operator || ""
  );
  const [conditionValue, setConditionValue] = useState<
    string | number | boolean
  >(conditionalLogic?.value || "");

  const isHidden = (element: HiddenHeaderElement): boolean => {
    return hiddenElements.includes(element);
  };

  useEffect(() => {
    setNewName(fieldId);
  }, [fieldId]);

  useEffect(() => {
    if (conditionalLogic) {
      setSelectedSourceField(conditionalLogic.sourceFieldId);
      setSelectedOperator(conditionalLogic.operator);
      setConditionValue(conditionalLogic.value || "");
    }
  }, [conditionalLogic]);

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

  const getOperatorsForField = (fieldType: string) => {
    const operators = [];

    switch (fieldType) {
      case "text":
      case "textarea":
      case "radio":
      case "dropdown":
      case "boolean":
      case "slider":
        operators.push(
          { value: "equals", label: "Equals" },
          { value: "not_equals", label: "Does not equal" }
        );
    }

    switch (fieldType) {
      case "text":
      case "textarea":
      case "radio":
      case "checkbox":
      case "dropdown":
        operators.push(
          { value: "contains", label: "Contains" },
          { value: "not_contains", label: "Does not contain" },
          { value: "is_empty", label: "Is empty" },
          { value: "is_not_empty", label: "Is not empty" }
        );
        break;

      case "slider":
        operators.push(
          { value: "greater_than", label: "Greater than" },
          { value: "less_than", label: "Less than" },
          { value: "greater_than_or_equal", label: "Greater than or equal to" },
          { value: "less_than_or_equal", label: "Less than or equal to" }
        );
        break;
    }

    return operators;
  };

  const operatorNeedsValue = (operator: string) => {
    return !["is_empty", "is_not_empty"].includes(operator);
  };

  const handleSaveConditionalLogic = () => {
    if (!selectedSourceField || !selectedOperator) {
      onConditionalLogicChange?.(null);
      setConditionalDialogOpen(false);
      return;
    }

    const logic: ConditionalLogic = {
      sourceFieldId: selectedSourceField,
      operator: selectedOperator,
      value: conditionValue,
    };

    onConditionalLogicChange?.(logic);
    setConditionalDialogOpen(false);
  };

  const handleClearConditionalLogic = () => {
    setSelectedSourceField("");
    setSelectedOperator("");
    setConditionValue("");
    onConditionalLogicChange?.(null);
  };

  const selectedField = availableFields.find(
    (f) => f.id === selectedSourceField
  );
  const operators = selectedField
    ? getOperatorsForField(selectedField.type)
    : [];

  return (
    <div
      className="flex items-center justify-between w-full cursor-pointer select-none mb-4 min-h-[32px]"
      tabIndex={0}
      role="button"
    >
      <div className="flex items-center gap-2">
        <motion.div
          layout
          initial={{ opacity: 0, x: -24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -24 }}
          transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
          key="label-preview"
          className="flex items-center gap-2"
        >
          {!isHidden("dragHandle") && dragHandleProps && (
            <div
              {...dragHandleProps}
              className="cursor-move text-gray-400"
              onClick={(e) => e.stopPropagation()}
            >
              <GripVertical className="h-5 w-5" />
            </div>
          )}
        </motion.div>

        {!isHidden("fieldLabel") &&
          !isCollapsed &&
          fieldType &&
          onFieldTypeChange && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
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
              layout
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
              className="flex items-center"
            >
              <PopoverTrigger asChild>
                <button
                  type="button"
                  aria-label="Edit field alias"
                  className="rounded-full focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Badge
                    variant="secondary"
                    className="text-xs font-normal border-gray-300 bg-transparent text-blue-700 hover:bg-transparent cursor-pointer"
                  >
                    {fieldId}
                  </Badge>
                </button>
              </PopoverTrigger>
            </motion.div>
          )}
          <PopoverContent align="start" side="bottom" className="w-72 p-2">
            <div className="space-y-2">
              <div className="text-xs font-medium text-gray-900">Edit name</div>
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
        </Popover>
      </div>

      <div className="flex items-center gap-2">
        {!isHidden("required") && (
          <motion.div
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            className="flex items-center gap-2"
          >
            <Switch
              checked={isRequired}
              onCheckedChange={onRequiredChange}
              onClick={(e) => e.stopPropagation()}
            />
            <span className="text-sm text-gray-600">Required</span>
            <div className="border-l border-gray-300 h-5 mx-2"></div>
          </motion.div>
        )}

        {!isHidden("conditionalLogic") && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{
              duration: 0.3,
              ease: [0.4, 0, 0.2, 1],
              delay: 0.05,
            }}
          >
            <Dialog
              open={conditionalDialogOpen}
              onOpenChange={setConditionalDialogOpen}
            >
              <DialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 hover:bg-gray-100"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Split className="h-4 w-4 text-gray-500" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Conditional Logic</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="sourceField">Show this field if</Label>
                    <Select
                      value={selectedSourceField}
                      onValueChange={setSelectedSourceField}
                    >
                      <SelectTrigger id="sourceField">
                        <SelectValue placeholder="Select a field" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableFields.map((field) => (
                          <SelectItem key={field.id} value={field.id}>
                            {field.name || field.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {selectedSourceField && (
                    <div className="grid gap-2">
                      <Label htmlFor="operator">Condition</Label>
                      <Select
                        value={selectedOperator}
                        onValueChange={setSelectedOperator}
                      >
                        <SelectTrigger id="operator">
                          <SelectValue placeholder="Select condition" />
                        </SelectTrigger>
                        <SelectContent>
                          {operators.map((op) => (
                            <SelectItem key={op.value} value={op.value}>
                              {op.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {selectedSourceField &&
                    selectedOperator &&
                    operatorNeedsValue(selectedOperator) && (
                      <div className="grid gap-2">
                        <Label htmlFor="value">Value</Label>
                        {(() => {
                          const sourceField = availableFields.find(
                            (f) => f.id === selectedSourceField
                          );
                          if (!sourceField) return null;

                          switch (sourceField.type) {
                            case "radio":
                            case "dropdown":
                              return (
                                <Select
                                  value={
                                    sourceField.choices?.find(
                                      (choice) => choice.text === conditionValue
                                    )?.value ||
                                    (conditionValue === "Other" ? "other" : "")
                                  }
                                  onValueChange={(value) => {
                                    const selectedChoice =
                                      sourceField.choices?.find(
                                        (choice) => choice.value === value
                                      );
                                    setConditionValue(
                                      selectedChoice?.text || value
                                    );
                                  }}
                                >
                                  <SelectTrigger id="value">
                                    <SelectValue placeholder="Select value" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {sourceField.choices?.map((choice) => (
                                      <SelectItem
                                        key={choice.value}
                                        value={choice.value}
                                      >
                                        {choice.text}
                                      </SelectItem>
                                    ))}
                                    {sourceField.showOtherItem && (
                                      <SelectItem value="other">
                                        Other
                                      </SelectItem>
                                    )}
                                  </SelectContent>
                                </Select>
                              );
                            case "checkbox":
                              return (
                                <Select
                                  value={
                                    sourceField.choices?.find(
                                      (choice) => choice.text === conditionValue
                                    )?.value ||
                                    (conditionValue === "Other" ? "other" : "")
                                  }
                                  onValueChange={(value) => {
                                    const selectedChoice =
                                      sourceField.choices?.find(
                                        (choice) => choice.value === value
                                      );
                                    setConditionValue(
                                      selectedChoice?.text || value
                                    );
                                  }}
                                >
                                  <SelectTrigger id="value">
                                    <SelectValue placeholder="Select value" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {sourceField.choices?.map((choice) => (
                                      <SelectItem
                                        key={choice.value}
                                        value={choice.value}
                                      >
                                        {choice.text}
                                      </SelectItem>
                                    ))}
                                    {sourceField.showOtherItem && (
                                      <SelectItem value="other">
                                        Other
                                      </SelectItem>
                                    )}
                                  </SelectContent>
                                </Select>
                              );
                            case "boolean":
                              return (
                                <Select
                                  value={String(conditionValue)}
                                  onValueChange={(value) =>
                                    setConditionValue(value === "true")
                                  }
                                >
                                  <SelectTrigger id="value">
                                    <SelectValue placeholder="Select value" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="true">Yes</SelectItem>
                                    <SelectItem value="false">No</SelectItem>
                                  </SelectContent>
                                </Select>
                              );
                            case "slider":
                              return (
                                <Input
                                  id="value"
                                  type="number"
                                  value={conditionValue as number}
                                  onChange={(e) =>
                                    setConditionValue(Number(e.target.value))
                                  }
                                  min={sourceField.minValue}
                                  max={sourceField.maxValue}
                                  step={sourceField.step || 1}
                                  className="text-sm"
                                />
                              );
                            case "text":
                            case "textarea":
                            default:
                              return (
                                <Input
                                  id="value"
                                  type="text"
                                  value={String(conditionValue)}
                                  onChange={(e) =>
                                    setConditionValue(e.target.value)
                                  }
                                  className="text-sm"
                                  placeholder="Enter value to compare against..."
                                />
                              );
                          }
                        })()}
                      </div>
                    )}

                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={handleClearConditionalLogic}
                    >
                      Clear
                    </Button>
                    <Button type="button" onClick={handleSaveConditionalLogic}>
                      Save
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </motion.div>
        )}

        {!isHidden("conditionalLogic") && (
          <motion.div
            initial={{ opacity: 0, scaleX: 0 }}
            animate={{ opacity: 1, scaleX: 1 }}
            exit={{ opacity: 0, scaleX: 0 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1], delay: 0.1 }}
            className="border-l border-gray-300 h-5 mx-2"
          />
        )}

        {!isHidden("delete") && onDelete && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{
              duration: 0.3,
              ease: [0.4, 0, 0.2, 1],
              delay: 0.15,
            }}
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
      </div>
    </div>
  );
}
