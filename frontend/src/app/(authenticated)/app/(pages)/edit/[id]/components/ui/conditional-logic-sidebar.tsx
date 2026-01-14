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
import { Badge } from "../ui/badge"; // Додай імпорт

interface ConditionalLogicSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (logic: ConditionalLogic) => void;
  onClear?: () => void;
  availableFields: Element[];
  currentLogic?: ConditionalLogic;
  targetFieldId?: string; // Додали
}

export default function ConditionalLogicSidebar({
  isOpen,
  onClose,
  onSave,
  onClear,
  availableFields,
  currentLogic,
  targetFieldId,
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
        <>
          {/* Sidebar */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed right-0 top-16 h-[calc(100vh-64px)] w-[400px] bg-white border-l border-gray-200 z-50 flex flex-col"
          >
            {/* Header */}
            <div className="p-4 border-b">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  Conditional Logic
                </h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClose}
                  className="h-8 w-8 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm text-gray-500">
                  Create a conditional logic for
                </span>
                <Badge
                  variant="secondary"
                  className="text-xs font-medium bg-blue-50 text-blue-700 hover:bg-blue-50"
                >
                  {targetFieldId}
                </Badge>
              </div>
            </div>
            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="sourceField">Show this question if</Label>
                <Select
                  value={selectedSourceField}
                  onValueChange={setSelectedSourceField}
                >
                  <SelectTrigger id="sourceField">
                    <SelectValue placeholder="Select a field" />
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

              {selectedSourceField && (
                <div className="space-y-2">
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

              <div className="mt-auto pt-4 flex gap-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClear}
                  className="w-1/2 rounded-none rounded-bl-lg"
                  style={{
                    borderTopRightRadius: 0,
                    borderBottomRightRadius: 0,
                  }}
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
                  className="w-1/2 rounded-none rounded-br-lg"
                  style={{ borderTopLeftRadius: 0, borderBottomLeftRadius: 0 }}
                >
                  Save
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
