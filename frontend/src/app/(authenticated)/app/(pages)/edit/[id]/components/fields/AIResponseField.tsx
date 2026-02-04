"use client";

import React, {
  useRef,
  useEffect,
  useCallback,
  useState,
  useLayoutEffect,
} from "react";
import { X, Split, CirclePlus, HelpCircle } from "lucide-react";
import { Badge } from "../ui/badge";
import { motion, AnimatePresence } from "framer-motion";
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
  AIResponseInstruction,
} from "@/app/(authenticated)/app/types";
import { toast } from "react-toastify";
import "./styles.scss";
import InstructionConditionBox from "../shared/InstructionConditionBox";
import { useSurveyStore } from "../../store/editSurveyStore";

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
  isPreviewMode?: boolean;
  onChange?: (
    fieldId: string,
    content: string,
    instructions?: AIResponseInstruction[],
  ) => void;
  onInstructionConditionalLogicChange?: (
    instructionIndex: number,
    logic: ConditionalLogic | null,
  ) => void;
}

export default function AIResponseField({
  field,
  fields,
  onChange,
  isPreviewMode = false,
}: AIResponseFieldProps & {
  onRequiredChange?: (isRequired: boolean) => void;
  onConditionalLogicChange?: (logic: ConditionalLogic | null) => void;
}) {
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
  const [focusedInstruction, setFocusedInstruction] = useState<string | null>(
    null,
  );
  const { setConditionalSidebarOpen, setConditionalSidebarContext } =
    useSurveyStore();

  useEffect(() => {
    const handleGlobalClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;

      if (
        target.closest("span[data-tag-id]") ||
        target.closest(".cursor-move") ||
        target.closest(".instruction-action") ||
        target.closest('[role="dialog"]') ||
        target.closest("[data-radix-popper-content-wrapper]")
      ) {
        return;
      }

      let clickedInstruction: string | null = null;
      instructions.forEach((instruction) => {
        const editorElement = editorRefs.current.get(instruction.id);
        if (editorElement && editorElement.contains(target)) {
          clickedInstruction = instruction.id;
        }
      });

      setFocusedInstruction(clickedInstruction);
    };

    document.addEventListener("mousedown", handleGlobalClick);
    return () => {
      document.removeEventListener("mousedown", handleGlobalClick);
    };
  }, [instructions]);

  useEffect(() => {
    initialized.current = false;
  }, [field.id]);

  const isInstructionEmpty = useCallback((instruction: Instruction) => {
    return (
      !instruction.content ||
      instruction.content.trim() === "" ||
      instruction.content === "<br>"
    );
  }, []);

  useLayoutEffect(() => {
    if (field.instructions && field.instructions.length > 0) {
      setInstructions(
        field.instructions.map((inst, idx) => ({
          id: String(idx),
          content: inst.text,
          conditionalLogic: inst.conditionalLogic,
        })),
      );
    } else {
      setInstructions([{ id: "0", content: field.text || "" }]);
    }
  }, [field.instructions, field.text, field.id]);

  const handleAddInstruction = () => {
    const newInstruction: Instruction = {
      id: String(Date.now()),
      content: "",
    };
    setInstructions([...instructions, newInstruction]);
    updateFieldText([...instructions, newInstruction]);
  };

  const handleDeleteInstruction = (id: string) => {
    if (instructions.length === 1) return;
    const newInstructions = instructions
      .filter((inst) => inst.id !== id)
      .map((inst, idx) => ({ ...inst, id: String(idx) }));
    setInstructions(newInstructions);
    updateFieldText(newInstructions);
  };

  const handleOpenConditionDialog = (instructionId: string) => {
    const instructionIdx = instructions.findIndex(
      (inst) => inst.id === instructionId,
    );
    const instruction = instructions[instructionIdx];

    setConditionalSidebarContext({
      field: field,
      currentLogic: instruction?.conditionalLogic,
      instructionIndex: instructionIdx,
    });
    setConditionalSidebarOpen(true);
  };

  const handleSaveCondition = () => {
    if (!openDialog) return;

    const logic: ConditionalLogic = {
      sourceFieldId: selectedSourceField,
      operator: selectedOperator,
      value: conditionValue,
    };

    const updatedInstructions = instructions.map((inst) =>
      inst.id === openDialog ? { ...inst, conditionalLogic: logic } : inst,
    );

    setInstructions(updatedInstructions);

    updateFieldText(updatedInstructions);

    setOpenDialog(null);
  };

  const handleRemoveInstructionCondition = (instructionId: string) => {
    const targetInstruction = instructions.find(
      (inst) => inst.id === instructionId,
    );
    const previousLogic = targetInstruction?.conditionalLogic;
    const updatedInstructions = instructions.map((inst) =>
      inst.id === instructionId ? { ...inst, conditionalLogic: undefined } : inst,
    );
    setInstructions(updatedInstructions);
    updateFieldText(updatedInstructions);
    if (previousLogic) {
      let didUndo = false;
      const toastId = toast.info(
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-900">
            Conditional logic cleared.
          </span>
          <button
            type="button"
            onClick={() => {
              if (didUndo) return;
              didUndo = true;
              toast.dismiss(toastId);
              const restoredInstructions = instructions.map((inst) =>
                inst.id === instructionId
                  ? { ...inst, conditionalLogic: previousLogic }
                  : inst,
              );
              setInstructions(restoredInstructions);
              updateFieldText(restoredInstructions);
            }}
            className="text-sm text-primary-600 hover:text-primary-700"
          >
            Undo
          </button>
        </div>,
        {
          autoClose: 5000,
          closeOnClick: false,
          closeButton: false,
          draggable: false,
        },
      );
    }
  };

  const updateFieldText = useCallback(
    (insts: Instruction[]) => {
      const combinedText = insts.map((inst) => inst.content).join("\n\n");

      const instructions: AIResponseInstruction[] = insts.map((inst) => ({
        text: inst.content,
        ...(inst.conditionalLogic && {
          conditionalLogic: inst.conditionalLogic,
        }),
      }));

      onChange?.(field.id, combinedText, instructions);
    },
    [onChange, field.id],
  );

  useEffect(() => {
    // when leaving preview mode, sanitize multiple empty instructions
    if (!isPreviewMode) return;

    // if there is only one instruction, do nothing, even if it is empty
    if (instructions.length <= 1) return;

    const nonEmptyInstructions = instructions.filter(
      (instruction) => !isInstructionEmpty(instruction),
    );

    // if all instructions are non-empty, do nothing
    if (nonEmptyInstructions.length === instructions.length) {
      return;
    }

    // if there are non empty instructions, drop the empty ones from the UI,
    // otherwise leave only the first empty instruction so the UI never bloat with empty instructions
    const nextInstructions =
      nonEmptyInstructions.length > 0
        ? nonEmptyInstructions
        : [instructions[0]];

    setInstructions(nextInstructions);
    updateFieldText(nextInstructions);
  }, [instructions, isInstructionEmpty, isPreviewMode, updateFieldText]);

  const convertPlaceholdersToTags = useCallback(
    (text: string): string => {
      const preservedText = text.replace(/\u00A0/g, "___NBSP___");
      const convertedText = preservedText.replace(
        /\{([^}]+)\}/g,
        (match, tagName) => {
          const field = fields.find(
            (f) => f.name === tagName || f.id === tagName,
          );
          if (!field) return match;

          return `<span contenteditable="false" draggable="true" data-tag-id="${
            field.id
          }" data-tag-label="${
            field.name || field.id
          }" class="${!isPreviewMode ? "inline-flex items-center align-baseline px-2 py-0.5 rounded-full text-sm text-white cursor-move bg-primary-600"
            : "inline-flex items-center align-baseline px-2 py-0.5 rounded-full text-xs border-gray-300 border bg-white text-primary"}" style="margin: 0 0.25em;">${
            field.name || field.id
          }</span>`;
        },
      );
      return convertedText.replace(/___NBSP___/g, " ");
    },
    [fields, isPreviewMode],
  );

  const convertTagsToPlaceholders = useCallback(
    (html: string): string => {
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = html;
      const tagElements = tempDiv.querySelectorAll(
        'span[contenteditable="false"]',
      );
      tagElements.forEach((element) => {
        const tagName = element.textContent?.trim() || "";
        const field = fields.find(
          (f) => f.name === tagName || f.id === tagName,
        );
        if (field) {
          element.replaceWith(`{${field.name || field.id}}`);
        }
      });
      return tempDiv.innerHTML;
    },
    [fields],
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
    event: React.FormEvent<HTMLDivElement>,
  ) => {
    const target = event.target as HTMLDivElement;
    const newContent = target.innerHTML;

    saveSelection(instructionId);

    const placeholderContent = convertTagsToPlaceholders(newContent);

    const newInstructions = instructions.map((inst) =>
      inst.id === instructionId
        ? { ...inst, content: placeholderContent }
        : inst,
    );
    setInstructions(newInstructions);
    updateFieldText(newInstructions);
  };

  const createTagElement = (label: string): HTMLElement => {
    const field = fields.find((f) => f.name === label || f.id === label);

    const tagElement = document.createElement("span");
    tagElement.contentEditable = "false";
    tagElement.draggable = true;
    tagElement.setAttribute("data-tag-id", field?.id || label);
    tagElement.setAttribute("data-tag-label", label);
    tagElement.className = "inline-flex items-center align-baseline px-2 py-0.5 rounded-full text-sm text-white cursor-move bg-primary-600";
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

    const newContent = editorElement.innerHTML;
    const placeholderContent = convertTagsToPlaceholders(newContent);

    const newInstructions = instructions.map((inst) =>
      inst.id === instructionId
        ? { ...inst, content: placeholderContent }
        : inst,
    );
    setInstructions(newInstructions);
    updateFieldText(newInstructions);
    editorElement.focus();
    restoreSelection(instructionId);
  };

  const updateEditorContent = useCallback(
    (instructionId: string) => {
      const editorElement = editorRefs.current.get(instructionId);
      if (!editorElement) return;

      saveSelection(instructionId);

      const newContent = editorElement.innerHTML;
      const placeholderContent = convertTagsToPlaceholders(newContent);

      const newInstructions = instructions.map((inst) =>
        inst.id === instructionId
          ? { ...inst, content: placeholderContent }
          : inst,
      );
      setInstructions(newInstructions);
      updateFieldText(newInstructions);
    },
    [convertTagsToPlaceholders, instructions, updateFieldText],
  );

  const updateEditorHTML = useCallback(
    (instructionId: string, content: string) => {
      const editorElement = editorRefs.current.get(instructionId);
      if (!editorElement) return;

      const richText = convertPlaceholdersToTags(content);

      const selection = window.getSelection();
      const hadFocus = document.activeElement === editorElement;

      if (hadFocus && selection?.rangeCount) {
        const range = selection.getRangeAt(0);
        if (editorElement.contains(range.startContainer)) {
          saveSelection(instructionId);
        }
      }

      editorElement.innerHTML = richText;

      const tagElements = editorElement.querySelectorAll("span[data-tag-id]");
      tagElements.forEach((tagEl) => {
        tagEl.addEventListener("dragstart", (e) => {
          const dragEvent = e as DragEvent;
          const target = dragEvent.target as HTMLElement;
          const tagId = target.getAttribute("data-tag-id");
          const tagLabel = target.getAttribute("data-tag-label");
          if (tagId && tagLabel && dragEvent.dataTransfer) {
            dragEvent.dataTransfer.setData(
              "tag",
              JSON.stringify({ id: tagId, label: tagLabel }),
            );

            saveSelection(instructionId);

            target.setAttribute("data-dragging", "true");
            target.style.opacity = "0.5";
          }
        });

        tagEl.addEventListener("dragend", (e) => {
          const dragEvent = e as DragEvent;
          const target = dragEvent.target as HTMLElement;

          if (target.getAttribute("data-dragging") === "true") {
            target.remove();
            updateEditorContent(instructionId);
          }

          const editorElement = editorRefs.current.get(instructionId);
          if (editorElement) {
            setTimeout(() => {
              editorElement.focus();
              restoreSelection(instructionId);
            }, 10);
          }
        });
      });

      if (hadFocus) {
        setTimeout(() => {
          try {
            restoreSelection(instructionId);
          } catch {
            const range = document.createRange();
            range.selectNodeContents(editorElement);
            range.collapse(false);
            const sel = window.getSelection();
            sel?.removeAllRanges();
            sel?.addRange(range);
            editorElement.focus();
          }
        }, 0);
      }
    },
    [convertPlaceholdersToTags, updateEditorContent],
  );

  useEffect(() => {
    instructions.forEach((instruction) => {
      const editorElement = editorRefs.current.get(instruction.id);
      if (editorElement) {
        const richText = convertPlaceholdersToTags(instruction.content);
        if (editorElement.innerHTML !== richText) {
          updateEditorHTML(instruction.id, instruction.content);
        }
      }
    });
  }, [instructions, updateEditorHTML, convertPlaceholdersToTags]);

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
    preview.innerHTML = "\u00A0";
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
    instructionId: string,
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
    instructionId: string,
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
      instructionId,
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
    event.stopPropagation();

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

      const editorElement = editorRefs.current.get(instructionId);
      if (editorElement) {
        const draggingTags = editorElement.querySelectorAll(
          "[data-dragging='true']",
        );
        draggingTags.forEach((dragTag) => dragTag.remove());

        updateEditorContent(instructionId);

        setTimeout(() => {
          insertTag(tag, instructionId, dropPosition);

          setTimeout(() => {
            editorElement.focus();
            restoreSelection(instructionId);
          }, 0);
        }, 0);
      }
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

  const handleBlur = (instructionId: string) => {
    saveSelection(instructionId);
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
          { value: "not_equals", label: "Does not equal" },
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
          { value: "is_not_empty", label: "Is not empty" },
        );
        break;

      case "slider":
        operators.push(
          { value: "greater_than", label: "Greater than" },
          { value: "less_than", label: "Less than" },
          { value: "greater_than_or_equal", label: "Greater than or equal to" },
          { value: "less_than_or_equal", label: "Less than or equal to" },
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
    <div
      className="relative bg-white rounded-lg p-0"
      onMouseDown={(e) => {
        if (isPreviewMode) {
          e.preventDefault();
          e.stopPropagation();
        }
      }}
    >
      <div className="space-y-2">
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              Instructions
            </label>
            {isPreviewMode ? (
              <div className="space-y-2">
                {instructions.map((instruction) => (
                  <motion.div
                    key={instruction.id}
                    initial={{ opacity: 0, scale: 0.95, y: -10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, x: -20 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    className="space-y-2"
                  >
                    {" "}
                    {instruction.conditionalLogic && (
                      <InstructionConditionBox
                        conditionFieldName={
                          fields.find(
                            (f) =>
                              f.id ===
                              instruction.conditionalLogic?.sourceFieldId,
                          )?.name || instruction.conditionalLogic.sourceFieldId
                        }
                        operator={instruction.conditionalLogic.operator}
                        value={
                          instruction.conditionalLogic.value
                            ? String(instruction.conditionalLogic.value)
                            : undefined
                        }
                        onRemove={
                          isPreviewMode
                            ? undefined
                            : () =>
                                handleRemoveInstructionCondition(instruction.id)
                        }
                      />
                    )}
                    <div
                      className="w-full bg-gray-50 border border-gray-200 rounded px-3 py-2 text-gray-700 text-sm leading-relaxed break-words whitespace-pre-line resize-none cursor-pointer !mb-4 mt-2"
                      dangerouslySetInnerHTML={{
                        __html: instruction.content ? convertPlaceholdersToTags(instruction.content) : "&nbsp;"
                      }}
                    />
                  </motion.div>
                ))}
              </div>
            ) : (
              <AnimatePresence mode="popLayout">
                {instructions.map((instruction) => {
                  const isEmpty = isInstructionEmpty(instruction);

                  const isFocused = focusedInstruction === instruction.id;

                  return (
                    <motion.div
                      key={instruction.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
                      className="space-y-2"
                    >
                      {instruction.conditionalLogic && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
                          className="mt-6"
                        >
                          <InstructionConditionBox
                            conditionFieldName={
                              fields.find(
                                (f) =>
                                  f.id ===
                                  instruction.conditionalLogic?.sourceFieldId,
                              )?.name ||
                              instruction.conditionalLogic.sourceFieldId
                            }
                            operator={instruction.conditionalLogic.operator}
                            value={
                              instruction.conditionalLogic.value
                                ? String(instruction.conditionalLogic.value)
                                : undefined
                            }
                            onRemove={
                              isPreviewMode
                                ? undefined
                                : () =>
                                    handleRemoveInstructionCondition(
                                      instruction.id,
                                    )
                            }
                          />
                        </motion.div>
                      )}

                      <div
                        className="relative w-full box-border bg-white rounded-lg border focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 focus-within:ring-inset transition-all duration-200"
                        style={{
                          minHeight: isFocused ? "150px" : "40px",
                        }}
                      >
                        <div
                          ref={(el) => {
                            if (el) editorRefs.current.set(instruction.id, el);
                          }}
                          contentEditable
                          data-placeholder={"Add instruction..."}
                          className={`w-full h-full outline-none bg-transparent px-3 py-2 pr-20 ${
                            isEmpty
                              ? "empty-editor before:content-[attr(data-placeholder)] before:text-gray-400 before:pointer-events-none"
                              : ""
                          }`}
                          style={{
                            wordWrap: "break-word",
                            overflowWrap: "break-word",
                          }}
                          onInput={(e) =>
                            handleInstructionInput(instruction.id, e)
                          }
                          onClick={() => saveSelection(instruction.id)}
                          onKeyDown={() => {
                            requestAnimationFrame(() => {
                              saveSelection(instruction.id);
                            });
                          }}
                          onFocus={() => handleFocus(instruction.id)}
                          onBlur={() => handleBlur(instruction.id)}
                          onDrop={(e) => handleDrop(instruction.id, e)}
                          onDragOver={(e) => handleDragOver(instruction.id, e)}
                          onDragLeave={(e) =>
                            handleDragLeave(instruction.id, e)
                          }
                          suppressContentEditableWarning
                        />
                        <div className="absolute right-2 top-1 flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              handleOpenConditionDialog(instruction.id)
                            }
                            className="h-8 w-8 p-0 hover:bg-gray-100 instruction-action"
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
                              className="h-8 w-8 p-0 hover:bg-gray-100 instruction-action"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            )}
          </div>

          {!isPreviewMode && (
            <div className="flex items-center gap-2 text-sm">
              <span
                onClick={handleAddInstruction}
                className="text-blue-600 cursor-pointer hover:underline"
              >
                <CirclePlus size={16} className="inline-block mr-1" /> Add
                instructions
              </span>
            </div>
          )}

          {!isPreviewMode && (
            <div className="space-y-4">
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
                      onDragStart={(event) => {
                        handleDragStart(event, tagData);
                        if (focusedInstruction) {
                          event.dataTransfer.setData(
                            "focusedInstruction",
                            focusedInstruction,
                          );
                        }
                      }}
                      onDragEnd={() => {
                        if (focusedInstruction) {
                          const editorElement =
                            editorRefs.current.get(focusedInstruction);
                          if (editorElement) {
                            setTimeout(() => {
                              editorElement.focus();
                              restoreSelection(focusedInstruction);
                            }, 0);
                          }
                        }
                      }}
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        if (focusedInstruction) {
                          insertTag(tagData, focusedInstruction);
                          const editorElement =
                            editorRefs.current.get(focusedInstruction);
                          if (editorElement) {
                            setTimeout(() => {
                              editorElement.focus();
                              restoreSelection(focusedInstruction);
                            }, 0);
                          }
                        } else if (instructions.length > 0) {
                          insertTag(tagData, instructions[0].id);
                        }
                      }}
                      variant="default"
                      className="cursor-move bg-primary-600 text-white align-baseline"
                      style={{ margin: "0 0.25em" }}
                    >
                      {fieldIdentifier}
                    </Badge>
                  );
                })}
              </div>
              <div className="flex items-start gap-2 text-xs text-gray-400">
                <HelpCircle className="mt-[1px] h-3.5 w-3.5" />
                <span>
                  You can drag the tag and drop it into the desired position in
                  the instructions.
                </span>
              </div>
            </div>
          )}
        </div>
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
                <Button
                  variant="outline"
                  onClick={() => setOpenDialog(null)}
                  className="border-0 bg-gray-100 text-gray-900 hover:bg-gray-200"
                >
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
    </div>
  );
}
