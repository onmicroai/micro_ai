"use client";

import { Plus, Trash2, X } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../../../../../../../../components/basic/input";
import { Label } from "../ui/label";
import { Switch } from "../ui/switch";
import { Badge } from "../ui/badge";
import {
  CompletionCriterion,
  Element,
} from "@/app/(authenticated)/app/types";
import { motion, AnimatePresence } from "framer-motion";

const MAX_COMPLETION_CRITERIA = 20;

interface ChatSettingsSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  field: Element | null;
  onMaxMessagesChange: (fieldId: string, maxMessages: number) => void;
  onWebSearchEnabledChange: (fieldId: string, enabled: boolean) => void;
  onCompletionCriteriaChange: (
    fieldId: string,
    completionCriteria: CompletionCriterion[],
  ) => void;
}

function createCriterionId(): string {
  return (
    crypto.randomUUID?.() ??
    `criterion-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  );
}

export default function ChatSettingsSidebar({
  isOpen,
  onClose,
  field,
  onMaxMessagesChange,
  onWebSearchEnabledChange,
  onCompletionCriteriaChange,
}: ChatSettingsSidebarProps) {
  const criteria = field?.completionCriteria || [];

  const updateCriteria = (next: CompletionCriterion[]) => {
    if (!field) return;
    onCompletionCriteriaChange(field.id, next);
  };

  const handleCriterionTextChange = (id: string, text: string) => {
    updateCriteria(
      criteria.map((criterion) =>
        criterion.id === id ? { ...criterion, text } : criterion,
      ),
    );
  };

  const handleAddCriterion = () => {
    if (criteria.length >= MAX_COMPLETION_CRITERIA) return;
    updateCriteria([...criteria, { id: createCriterionId(), text: "" }]);
  };

  const handleRemoveCriterion = (id: string) => {
    updateCriteria(criteria.filter((criterion) => criterion.id !== id));
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          id="chat-settings-sidebar"
          initial={{ width: 400 }}
          animate={{ width: 400 }}
          exit={{ width: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 200 }}
          className="sticky top-16 bg-white z-50 flex flex-col overflow-hidden self-start h-[calc(100vh-4rem)]"
          style={{ minWidth: 0, maxWidth: 400 }}
        >
          <div className="flex items-center justify-between px-4 py-3 bg-white">
            <h2 className="text-base font-medium text-black">Chat settings</h2>
            <Button
              variant="ghost"
              size="lg"
              onClick={onClose}
              className="h-10 w-10 p-0 text-gray-500"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          <div className="overflow-y-auto p-4 space-y-6">
            {field && (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-gray-500">Settings for</span>
                  <Badge
                    variant="secondary"
                    className="text-white bg-primary-600 hover:bg-primary-600 text-xs font-normal flex items-center gap-1"
                  >
                    {field.name}
                  </Badge>
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`max-messages-${field.id}`}>
                    Max Messages
                  </Label>
                  <Input
                    id={`max-messages-${field.id}`}
                    type="number"
                    min="1"
                    value={field.maxMessages || 10}
                    onChange={(e) => {
                      const value = parseInt(e.target.value, 10);
                      if (!isNaN(value)) {
                        onMaxMessagesChange(field.id, value);
                      }
                    }}
                  />
                </div>

                <div className="flex items-start gap-3">
                  <Switch
                    checked={field.enableWebSearch || false}
                    onCheckedChange={(checked) => {
                      onWebSearchEnabledChange(field.id, checked);
                    }}
                  />
                  <div>
                    <Label>Enable Web Search</Label>
                    <p className="mt-1 text-xs text-gray-500">
                      Let the assistant search the web when a question needs
                      current information. Off by default.
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <Label>Completion criteria</Label>
                    <p className="mt-1 text-xs text-gray-500">
                      Add one or more yes/no statements (for example, “The user
                      introduced themselves”). After every reply, a check
                      updates which ones are currently true. The chat locks
                      while all of them are true.
                    </p>
                  </div>

                  <div className="space-y-2">
                    {criteria.map((criterion, index) => (
                      <div key={criterion.id} className="flex items-start gap-2">
                        <Input
                          id={`completion-criterion-${criterion.id}`}
                          value={criterion.text}
                          placeholder={`Criterion ${index + 1}`}
                          onChange={(e) =>
                            handleCriterionTextChange(
                              criterion.id,
                              e.target.value,
                            )
                          }
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveCriterion(criterion.id)}
                          className="h-10 w-10 shrink-0 p-0 text-gray-500"
                          aria-label={`Remove criterion ${index + 1}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddCriterion}
                    disabled={criteria.length >= MAX_COMPLETION_CRITERIA}
                    className="gap-1.5"
                  >
                    <Plus className="h-4 w-4" />
                    Add criterion
                  </Button>
                  {criteria.length >= MAX_COMPLETION_CRITERIA && (
                    <p className="text-xs text-gray-500">
                      Up to {MAX_COMPLETION_CRITERIA} criteria.
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
