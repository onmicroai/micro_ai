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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { Label } from "../../components/ui/label";
import { Input } from "../../components/ui/input";
import { ConditionalLogic, Element } from "@/app/(authenticated)/app/types";

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
  // Required toggle props
  showRequired?: boolean;
  isRequired?: boolean;
  onRequiredChange?: (isRequired: boolean) => void;
  // Conditional logic props
  showConditionalLogic?: boolean;
  conditionalLogic?: ConditionalLogic;
  onConditionalLogicChange?: (logic: ConditionalLogic | null) => void;
  availableFields?: Element[];
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
  showRequired = false,
  isRequired = false,
  onRequiredChange,
  showConditionalLogic = true,
  conditionalLogic,
  onConditionalLogicChange,
  availableFields = [],
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
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center gap-2">
        {dragHandleProps && (
          <div {...dragHandleProps} className="cursor-move text-gray-400">
            <GripVertical className="h-5 w-5" />
          </div>
        )}
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

      <div className="flex items-center gap-2">
        {showRequired && (
          <>
            <Switch checked={isRequired} onCheckedChange={onRequiredChange} />
            <span className="text-sm text-gray-600">Required</span>
            <div className="border-l border-gray-300 h-5 mx-2"></div>
          </>
        )}

        {showConditionalLogic && (
          <Dialog
            open={conditionalDialogOpen}
            onOpenChange={setConditionalDialogOpen}
          >
            <DialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 hover:bg-gray-100"
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
                                    <SelectItem value="other">Other</SelectItem>
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
                                    <SelectItem value="other">Other</SelectItem>
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
        )}

        {showConditionalLogic && (
          <div className="border-l border-gray-300 h-5 mx-2"></div>
        )}

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
