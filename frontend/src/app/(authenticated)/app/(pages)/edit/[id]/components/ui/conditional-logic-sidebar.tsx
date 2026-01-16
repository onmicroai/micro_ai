"use client";

import React, { useState, useEffect } from "react";
import { X } from "lucide-react";
import { Button } from "../ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Element, ConditionalLogic } from "@/app/(authenticated)/app/types";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "../ui/badge";

interface ConditionalLogicSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (logic: ConditionalLogic) => void;
  onClear?: () => void;
  availableFields: Element[];
  currentLogic?: ConditionalLogic;
  targetFieldName?: string;
}

export default function ConditionalLogicSidebar({
  isOpen,
  onClose,
  onSave,
  onClear,
  availableFields,
  currentLogic,
  targetFieldName,
}: ConditionalLogicSidebarProps) {
  const [selectedSourceField, setSelectedSourceField] = useState<string>(
    currentLogic?.sourceFieldId || ""
  );
  const [selectedOperator, setSelectedOperator] = useState<string>(
    currentLogic?.operator || ""
  );
  const [conditionValue, setConditionValue] = useState<
    string | number | boolean
  >(currentLogic?.value || "");

  useEffect(() => {
    if (currentLogic) {
      setSelectedSourceField(currentLogic.sourceFieldId || "");
      setSelectedOperator(currentLogic.operator || "");
      setConditionValue(currentLogic.value || "");
    } else {
      setSelectedSourceField("");
      setSelectedOperator("");
      setConditionValue("");
    }
  }, [currentLogic, isOpen]);

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
        break;
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

  const selectedField = availableFields.find(
    (f) => f.id === selectedSourceField
  );
  const operators = selectedField
    ? getOperatorsForField(selectedField.type)
    : [];

  const handleSave = () => {
    const logic: ConditionalLogic = {
      sourceFieldId: selectedSourceField,
      operator: selectedOperator,
      value: conditionValue,
    };
    onSave(logic);
    onClose();
  };

  const handleClear = () => {
    setSelectedSourceField("");
    setSelectedOperator("");
    setConditionValue("");
    onClear?.();
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          id="conditional-logic-sidebar"
          initial={{ width: 400 }}
          animate={{ width: 400 }}
          exit={{ width: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 200 }}
          className="sticky top-0 right-0 h-screen bg-white z-50 flex flex-col overflow-hidden"
          style={{ minWidth: 0, maxWidth: 400 }}
        >
          <div className="px-4 flex items-center justify-between ">
            <div className="flex flex-col">
              <h2 className="text-base font-semibold text-black">
                Conditional Logic
              </h2>{" "}
            </div>
            <Button
              variant="ghost"
              size="lg"
              onClick={onClose}
              className="h-10 w-10 p-0 text-gray-500"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          <div className="overflow-y-auto p-4 space-y-4">
            {targetFieldName && (
              <div className="flex items-center gap-2 mb-5">
                <span className="text-xs text-gray-500">
                  Create a conditional logic for
                </span>
                <Badge
                  variant="secondary"
                  className="text-xs font-medium bg-blue-50 text-blue-700 hover:bg-blue-50"
                >
                  {targetFieldName}
                </Badge>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="sourceField" className="text-black font-semibold">
                Show this question if
              </Label>
              <Select
                value={selectedSourceField}
                onValueChange={setSelectedSourceField}
              >
                <SelectTrigger
                  id="sourceField"
                  className="text-gray-500 border-gray-500"
                >
                  <SelectValue placeholder="Select an item" />
                </SelectTrigger>
                <SelectContent>
                  {availableFields.length === 0 && (
                    <div className="px-3 py-2 text-gray-400 text-sm">
                      No fields available
                    </div>
                  )}
                  {availableFields.map((field) => (
                    <SelectItem key={field.id} value={field.id}>
                      {field.name || field.label || field.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="operator" className="text-black font-semibold">
                Condition
              </Label>
              <Select
                value={selectedOperator}
                onValueChange={setSelectedOperator}
                disabled={!selectedSourceField}
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

            {selectedSourceField &&
              selectedOperator &&
              operatorNeedsValue(selectedOperator) && (
                <div className="space-y-2">
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
                              const selectedChoice = sourceField.choices?.find(
                                (choice) => choice.value === value
                              );
                              setConditionValue(selectedChoice?.text || value);
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
                              const selectedChoice = sourceField.choices?.find(
                                (choice) => choice.value === value
                              );
                              setConditionValue(selectedChoice?.text || value);
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
                            onChange={(e) => setConditionValue(e.target.value)}
                            className="text-sm"
                            placeholder="Enter value to compare against..."
                          />
                        );
                    }
                  })()}
                </div>
              )}
          </div>

          <div className="p-4 flex gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleClear}
              className="w-1/2"
            >
              Clear
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              disabled={
                !selectedSourceField ||
                !selectedOperator ||
                (operatorNeedsValue(selectedOperator) && !conditionValue)
              }
              className="w-1/2"
            >
              Save
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
