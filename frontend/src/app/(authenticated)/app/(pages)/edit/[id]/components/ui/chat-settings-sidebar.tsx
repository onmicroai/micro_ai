"use client";

import { X } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../../../../../../../../components/basic/input";
import { Label } from "../ui/label";
import { Switch } from "../ui/switch";
import { Badge } from "../ui/badge";
import { Element } from "@/app/(authenticated)/app/types";
import { motion, AnimatePresence } from "framer-motion";

interface ChatSettingsSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  field: Element | null;
  onMaxMessagesChange: (fieldId: string, maxMessages: number) => void;
  onWebSearchEnabledChange: (fieldId: string, enabled: boolean) => void;
}

export default function ChatSettingsSidebar({
  isOpen,
  onClose,
  field,
  onMaxMessagesChange,
  onWebSearchEnabledChange,
}: ChatSettingsSidebarProps) {
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
              </>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
