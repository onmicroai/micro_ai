"use client";

import React, { useRef, useEffect, useCallback, useState } from "react";
import { MessageCircle, X, Split } from "lucide-react";
import { Badge } from "../ui/badge";
import { Button } from "../../components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Input } from "../ui/input";
import {
  Prompt,
  Element,
  ConditionalLogic,
} from "@/app/(authenticated)/app/types";
import FieldHeader from "../shared/FieldHeader";
import "./styles.scss";
import InstructionConditionBox from "../shared/InstructionConditionBox";

interface Tag {
  id: string;
  label: string;
}

interface Instruction {
  id: string;
  content: string;
  conditionalLogic?: ConditionalLogic;
}

interface AIResponseFieldProps {
  field: Prompt;
  fields: Element[];
  onChange?: (fieldId: string, content: string) => void;
  onDelete?: () => void;
  onUpdateConditionalLogic?: (
    instructionId: string,
    logic: ConditionalLogic | null
  ) => void;
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
}

export default function AIResponseField({
  field,
  fields,
  onChange,
  onDelete,
  onUpdateConditionalLogic,
  dragHandleProps,
}: AIResponseFieldProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [instructions, setInstructions] = useState<Instruction[]>([
    { id: "1", content: field.text || "" },
  ]);
  const editorRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const lastRangeRefs = useRef<Map<string, Range>>(new Map());
  const initialized = useRef(false);
  const [openDialog, setOpenDialog] = useState<string | null>(null);
  const [previewElements, setPreviewElements] = useState<
    Map<string, HTMLElement>
  >(new Map());

  const [selectedSourceField, setSelectedSourceField] = useState<string>("");
  const [selectedOperator, setSelectedOperator] = useState<string>("");
  const [conditionValue, setConditionValue] = useState<string>("");

  useEffect(() => {
    if (!initialized.current && field.text && field.text.includes("\n\n")) {
      const lines = field.text.split("\n\n").filter((line) => line.trim());
      setInstructions(
        lines.map((line, idx) => ({
          id: String(Date.now() + idx),
          content: line,
        }))
      );
      initialized.current = true;
    }
  }, []);

  const handleAddInstruction = () => {
    const newInstruction: Instruction = {
      id: String(Date.now()),
      content: "",
    };
    setInstructions([...instructions, newInstruction]);
  };

  const handleDeleteInstruction = (id: string) => {
    if (instructions.length === 1) return;
    const newInstructions = instructions.filter((inst) => inst.id !== id);
    setInstructions(newInstructions);
    updateFieldText(newInstructions);
  };

  const handleOpenConditionDialog = (instructionId: string) => {
    const instruction = instructions.find((inst) => inst.id === instructionId);
    if (instruction?.conditionalLogic) {
      setSelectedSourceField(instruction.conditionalLogic.sourceFieldId || "");
      setSelectedOperator(instruction.conditionalLogic.operator || "");
      setConditionValue(String(instruction.conditionalLogic.value || ""));
    } else {
      setSelectedSourceField("");
      setSelectedOperator("");
      setConditionValue("");
    }
    setOpenDialog(instructionId);
  };

  const handleSaveCondition = () => {
    if (!openDialog) return;

    const logic: ConditionalLogic = {
      sourceFieldId: selectedSourceField,
      operator: selectedOperator,
      value: conditionValue,
    };

    setInstructions((prev) =>
      prev.map((inst) =>
        inst.id === openDialog ? { ...inst, conditionalLogic: logic } : inst
      )
    );

    onUpdateConditionalLogic?.(openDialog, logic);
    setOpenDialog(null);
  };

  const handleDeleteCondition = (instructionId: string) => {
    setInstructions((prev) =>
      prev.map((inst) =>
        inst.id === instructionId
          ? { ...inst, conditionalLogic: undefined }
          : inst
      )
    );
    onUpdateConditionalLogic?.(instructionId, null);
  };

  const updateFieldText = (insts: Instruction[]) => {
    const combinedText = insts.map((inst) => inst.content).join("\n\n");
    onChange?.(field.id, combinedText);
  };

  const convertPlaceholdersToTags = useCallback(
    (text: string): string => {
      const preservedText = text.replace(/\u00A0/g, "___NBSP___");
      const convertedText = preservedText.replace(
        /\{([^}]+)\}/g,
        (match, tagName) => {
          const field = fields.find(
            (f) => f.name === tagName || f.id === tagName
          );
          if (!field) return match;

          return `<span contenteditable="false" draggable="true" class="inline-flex items-center align-baseline px-2 py-0.5 rounded-full text-sm text-white cursor-move bg-primary-600" style="margin: 0 0.25em;">${
            field.name || field.id
          }</span>`;
        }
      );
      return convertedText.replace(/___NBSP___/g, " ");
    },
    [fields]
  );

  const checkIfEmpty = useCallback(
    (element: HTMLDivElement | null | undefined) => {
      if (!element) return true;
      const contentText = element.textContent?.trim() || "";
      return contentText === "";
    },
    []
  );

  const convertTagsToPlaceholders = useCallback(
    (html: string): string => {
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = html;
      const tagElements = tempDiv.querySelectorAll(
        'span[contenteditable="false"]'
      );
      tagElements.forEach((element) => {
        const tagName = element.textContent?.trim() || "";
        const field = fields.find(
          (f) => f.name === tagName || f.id === tagName
        );
        if (field) {
          element.replaceWith(`{${field.name || field.id}}`);
        }
      });
      return tempDiv.innerHTML;
    },
    [fields]
  );

  const saveSelection = (instructionId: string) => {
    const selection = window.getSelection();
    const editorElement = editorRefs.current.get(instructionId);
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      if (editorElement?.contains(range.commonAncestorContainer)) {
        lastRangeRefs.current.set(instructionId, range.cloneRange());
      }
    }
  };

  const restoreSelection = (instructionId: string) => {
    const lastRange = lastRangeRefs.current.get(instructionId);
    if (lastRange) {
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(lastRange);
    }
  };

  const handleInstructionInput = (
    instructionId: string,
    event: React.FormEvent<HTMLDivElement>
  ) => {
    const target = event.target as HTMLDivElement;
    const newContent = target.innerHTML;

    saveSelection(instructionId);

    const placeholderContent = convertTagsToPlaceholders(newContent);

    const newInstructions = instructions.map((inst) =>
      inst.id === instructionId
        ? { ...inst, content: placeholderContent }
        : inst
    );
    setInstructions(newInstructions);
    updateFieldText(newInstructions);
  };

  const createTagElement = (label: string): HTMLElement => {
    const tagElement = document.createElement("span");
    tagElement.contentEditable = "false";
    tagElement.draggable = true;
    tagElement.className =
      "inline-flex items-center align-baseline px-2 py-0.5 rounded-full text-sm text-white cursor-move bg-primary-600";
    tagElement.style.margin = "0 0.25em";
    tagElement.textContent = label;
    return tagElement;
  };

  const insertNodeAndUpdateSelection = (node: Node, range: Range) => {
    const beforeText =
      range.startContainer.textContent?.substring(0, range.startOffset) || "";
    if (beforeText.length > 0 && !beforeText.endsWith(" ")) {
      const spaceBeforeNode = document.createTextNode(" ");
      range.insertNode(spaceBeforeNode);
      range.setStartAfter(spaceBeforeNode);
    }

    range.insertNode(node);

    const spaceAfterNode = document.createTextNode(" ");
    range.setStartAfter(node);
    range.insertNode(spaceAfterNode);
    range.setStartAfter(spaceAfterNode);
    range.collapse(true);

    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  };

  const getCurrentRange = (instructionId: string): Range | null => {
    restoreSelection(instructionId);
    const selection = window.getSelection();
    if (!selection?.rangeCount) return null;
    return selection.getRangeAt(0);
  };

  const insertTag = (tag: Tag, instructionId: string, range?: Range) => {
    const editorElement = editorRefs.current.get(instructionId);
    if (!editorElement) return;

    const insertionRange = range || getCurrentRange(instructionId);
    if (!insertionRange) return;

    const tagElement = createTagElement(tag.label);
    insertNodeAndUpdateSelection(tagElement, insertionRange);
    saveSelection(instructionId);
    updateEditorContent(instructionId);
    editorElement.focus();
    restoreSelection(instructionId);
  };

  const updateEditorContent = (instructionId: string) => {
    const editorElement = editorRefs.current.get(instructionId);
    if (!editorElement) return;

    saveSelection(instructionId);

    const newContent = editorElement.innerHTML;
    const placeholderContent = convertTagsToPlaceholders(newContent);

    const newInstructions = instructions.map((inst) =>
      inst.id === instructionId
        ? { ...inst, content: placeholderContent }
        : inst
    );
    setInstructions(newInstructions);
    updateFieldText(newInstructions);
  };

  const handleDragStart = (event: React.DragEvent, tag: Tag) => {
    event.dataTransfer.setData("tag", JSON.stringify(tag));
  };

  const getDropPosition = (event: React.DragEvent): Range | null => {
    const { clientX, clientY } = event;
    if (document.caretPositionFromPoint) {
      const position = document.caretPositionFromPoint(clientX, clientY);
      if (!position || !position.offsetNode) return null;
      const range = document.createRange();
      range.setStart(position.offsetNode, position.offset);
      range.collapse(true);
      return range;
    }
    if (document.caretRangeFromPoint) {
      return document.caretRangeFromPoint(clientX, clientY);
    }
    return null;
  };

  const createPreviewElement = (): HTMLElement => {
    const preview = document.createElement("span");
    preview.className =
      "tag-preview inline-flex items-center align-baseline rounded-full bg-gray-200 opacity-50 pointer-events-none text-sm";
    preview.style.width = "80px";
    preview.style.margin = "0 0.25em";
    preview.style.padding = "0.125rem 0.5rem";
    preview.style.height = "1.25rem";
    preview.innerHTML = " ";
    return preview;
  };

  const removeAllPreviews = (instructionId: string) => {
    const editor = editorRefs.current.get(instructionId);
    if (!editor) return;
    const previews = editor.querySelectorAll(".tag-preview");
    previews.forEach((preview) => preview.remove());
  };

  const adjustDropPosition = (
    dropPosition: Range,
    instructionId: string
  ): Range => {
    const editorElement = editorRefs.current.get(instructionId);
    let currentNode = dropPosition.startContainer;
    while (currentNode && currentNode !== editorElement) {
      if (currentNode.nodeType === Node.ELEMENT_NODE) {
        const element = currentNode as HTMLElement;
        if (element.getAttribute("contenteditable") === "false") {
          dropPosition.setStartAfter(element);
          dropPosition.setEndAfter(element);
          break;
        }
      }
      currentNode = currentNode.parentNode as Node;
      if (!currentNode) break;
    }
    return dropPosition;
  };

  const updatePreviewPosition = (
    event: React.DragEvent,
    instructionId: string
  ) => {
    const editor = editorRefs.current.get(instructionId);
    if (!editor) return;

    const dropPosition = getDropPosition(event);
    if (!dropPosition) return;

    const { clientX, clientY } = event;
    const previewElement = previewElements.get(instructionId);

    if (
      previewElement &&
      previewElement.dataset.lastX &&
      previewElement.dataset.lastY &&
      Math.abs(Number(previewElement.dataset.lastX) - clientX) < 5 &&
      Math.abs(Number(previewElement.dataset.lastY) - clientY) < 5
    ) {
      return;
    }

    removeAllPreviews(instructionId);

    const preview = createPreviewElement();
    if (previewElement) {
      preview.dataset.lastX = clientX.toString();
      preview.dataset.lastY = clientY.toString();
    }

    const adjustedPosition = adjustDropPosition(
      dropPosition.cloneRange(),
      instructionId
    );
    adjustedPosition.insertNode(preview);

    setPreviewElements((prev) => new Map(prev).set(instructionId, preview));
  };

  const handleDragOver = (instructionId: string, event: React.DragEvent) => {
    event.preventDefault();
    requestAnimationFrame(() => {
      updatePreviewPosition(event, instructionId);
    });
  };

  const handleDragLeave = (instructionId: string, event: React.DragEvent) => {
    const editor = editorRefs.current.get(instructionId);
    if (event.target === editor) {
      removeAllPreviews(instructionId);
      setPreviewElements((prev) => {
        const newMap = new Map(prev);
        newMap.delete(instructionId);
        return newMap;
      });
    }
  };

  const handleDrop = (instructionId: string, event: React.DragEvent) => {
    event.preventDefault();

    removeAllPreviews(instructionId);
    setPreviewElements((prev) => {
      const newMap = new Map(prev);
      newMap.delete(instructionId);
      return newMap;
    });

    const dropPosition = getDropPosition(event);
    if (!dropPosition) return;

    const tagData = event.dataTransfer.getData("tag");
    if (tagData) {
      const tag = JSON.parse(tagData) as Tag;
      insertTag(tag, instructionId, dropPosition);
    }
  };

  const handleFocus = (instructionId: string) => {
    const editorElement = editorRefs.current.get(instructionId);
    const lastRange = lastRangeRefs.current.get(instructionId);

    if (
      lastRange &&
      editorElement?.contains(lastRange.commonAncestorContainer)
    ) {
      try {
        restoreSelection(instructionId);
      } catch {
        if (editorElement) {
          const range = document.createRange();
          range.selectNodeContents(editorElement);
          range.collapse(false);
          const selection = window.getSelection();
          selection?.removeAllRanges();
          selection?.addRange(range);
          saveSelection(instructionId);
        }
      }
    } else if (editorElement) {
      const range = document.createRange();
      range.selectNodeContents(editorElement);
      range.collapse(false);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      saveSelection(instructionId);
    }
  };

  useEffect(() => {
    instructions.forEach((instruction) => {
      const editorElement = editorRefs.current.get(instruction.id);
      if (editorElement) {
        const selection = window.getSelection();
        const hadFocus = document.activeElement === editorElement;
        const cursorPosition = selection?.rangeCount
          ? selection.getRangeAt(0).cloneRange()
          : null;

        const richText = convertPlaceholdersToTags(instruction.content);

        if (editorElement.innerHTML !== richText) {
          const prevHTML = editorElement.innerHTML;
          editorElement.innerHTML = richText;

          if (hadFocus && cursorPosition) {
            try {
              const prevTextNoSpaces = prevHTML.replace(/<[^>]*>|\s+/g, "");
              const newTextNoSpaces = richText.replace(/<[^>]*>|\s+/g, "");
              const isOnlySpaceChange = prevTextNoSpaces === newTextNoSpaces;

              if (isOnlySpaceChange) {
                const range = document.createRange();
                const textNode = editorElement.lastChild;
                if (textNode && textNode.nodeType === Node.TEXT_NODE) {
                  const textLength = textNode.textContent?.length || 0;
                  range.setStart(textNode, textLength);
                  range.setEnd(textNode, textLength);
                } else {
                  range.selectNodeContents(editorElement);
                  range.collapse(false);
                }
                selection?.removeAllRanges();
                selection?.addRange(range);
              } else {
                restoreSelection(instruction.id);
              }
            } catch {
              const range = document.createRange();
              range.selectNodeContents(editorElement);
              range.collapse(false);
              selection?.removeAllRanges();
              selection?.addRange(range);
            }
          }
        }
      }
    });
  }, [instructions, convertPlaceholdersToTags]);

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

  const selectedField = fields.find((f) => f.id === selectedSourceField);
  const operators = selectedField
    ? getOperatorsForField(selectedField.type)
    : [];

  return (
    <div className="space-y-4">
      <FieldHeader
        icon={MessageCircle}
        label="AI response"
        fieldId={field.name}
        isCollapsed={isCollapsed}
        onToggleCollapse={() => setIsCollapsed(!isCollapsed)}
        onMove={() => {}}
        onDelete={onDelete}
        dragHandleProps={dragHandleProps}
      />

      {!isCollapsed && (
        <div className="space-y-4 mt-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              Instructions
            </label>
            {instructions.map((instruction) => {
              const editorElement = editorRefs.current.get(instruction.id);
              const isEmpty = checkIfEmpty(editorElement);

              return (
                <div key={instruction.id} className="space-y-2">
                  {instruction.conditionalLogic && (
                    <div className="mt-6">
                      <InstructionConditionBox
                        property={
                          fields.find(
                            (f) =>
                              f.id ===
                              instruction.conditionalLogic?.sourceFieldId
                          )?.name || instruction.conditionalLogic.sourceFieldId
                        }
                        operator={instruction.conditionalLogic.operator}
                        value={
                          instruction.conditionalLogic.value
                            ? String(instruction.conditionalLogic.value)
                            : undefined
                        }
                        onRemove={() => handleDeleteCondition(instruction.id)}
                      />
                    </div>
                  )}

                  <div className="relative">
                    <div
                      ref={(el) => {
                        if (el) editorRefs.current.set(instruction.id, el);
                      }}
                      contentEditable
                      data-placeholder={"Add instruction..."}
                      className={`w-full bg-white rounded-lg shadow-sm border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-20 ${
                        instructions.length === 1
                          ? "min-h-[150px] px-3 py-3"
                          : "h-[40px] flex items-center px-3"
                      } ${
                        isEmpty
                          ? "empty-editor before:content-[attr(data-placeholder)] before:text-gray-400 before:pointer-events-none"
                          : ""
                      }`}
                      onInput={(e) => handleInstructionInput(instruction.id, e)}
                      onClick={() => saveSelection(instruction.id)}
                      onKeyDown={() => {
                        requestAnimationFrame(() => {
                          saveSelection(instruction.id);
                        });
                      }}
                      onFocus={() => handleFocus(instruction.id)}
                      onBlur={() => saveSelection(instruction.id)}
                      onDrop={(e) => handleDrop(instruction.id, e)}
                      onDragOver={(e) => handleDragOver(instruction.id, e)}
                      onDragLeave={(e) => handleDragLeave(instruction.id, e)}
                      suppressContentEditableWarning
                    />
                    <div
                      className={`absolute right-2 ${
                        instructions.length === 1
                          ? "top-2"
                          : "top-1/2 -translate-y-1/2"
                      } flex items-center gap-1`}
                    >
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          handleOpenConditionDialog(instruction.id)
                        }
                        className="h-8 w-8 p-0 hover:bg-gray-100"
                      >
                        <Split className="h-4 w-4" />
                      </Button>
                      {instructions.length > 1 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            handleDeleteInstruction(instruction.id)
                          }
                          className="h-8 w-8 p-0 hover:bg-gray-100"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center gap-2 text-sm">
            <span
              onClick={handleAddInstruction}
              className="text-blue-600 cursor-pointer hover:underline"
            >
              ⊕ Add instructions
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            {fields.map((sourceField) => {
              const fieldIdentifier = sourceField.name || sourceField.id;
              const tagData = {
                id: sourceField.id,
                label: sourceField.name || "",
              };
              return (
                <Badge
                  key={sourceField.id}
                  draggable="true"
                  onDragStart={(event) => handleDragStart(event, tagData)}
                  onClick={() => {
                    if (instructions.length > 0) {
                      insertTag(tagData, instructions[0].id);
                    }
                  }}
                  variant="default"
                  className="cursor-move bg-primary-600 align-baseline"
                >
                  {fieldIdentifier}
                </Badge>
              );
            })}
          </div>
        </div>
      )}

      {/* Conditional Logic Dialog */}
      <Dialog
        open={!!openDialog}
        onOpenChange={(open) => !open && setOpenDialog(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Conditional Logic</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Show this instruction if
              </label>
              <Select
                value={selectedSourceField}
                onValueChange={setSelectedSourceField}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a field" />
                </SelectTrigger>
                <SelectContent>
                  {fields.map((field) => (
                    <SelectItem key={field.id} value={field.id}>
                      {field.name || field.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedSourceField && (
              <>
                <div className="space-y-2">
                  <Select
                    value={selectedOperator}
                    onValueChange={setSelectedOperator}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select operator" />
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

                {selectedOperator && operatorNeedsValue(selectedOperator) && (
                  <div className="space-y-2">
                    <Input
                      value={conditionValue}
                      onChange={(e) => setConditionValue(e.target.value)}
                      placeholder="Enter value"
                    />
                  </div>
                )}
              </>
            )}

            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setOpenDialog(null)}>
                Cancel
              </Button>
              <Button
                onClick={handleSaveCondition}
                disabled={
                  !selectedSourceField ||
                  !selectedOperator ||
                  (operatorNeedsValue(selectedOperator) && !conditionValue)
                }
              >
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
