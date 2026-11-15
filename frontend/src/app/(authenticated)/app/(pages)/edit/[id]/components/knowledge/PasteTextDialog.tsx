"use client";

import { useEffect, useState } from "react";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Input } from "@/components/basic/input";
import { Textarea } from "@/components/basic/textarea";
import SkeletonLoader from "@/components/layout/loading/skeletonLoader";
import { TEST_IDS } from "@/constants/testIds";
import {
  addTextSource,
  apiErrorMessage,
  getSource,
  KnowledgeSource,
  MAX_TEXT_LENGTH,
  updateTextSource,
} from "./knowledgeApi";

const MAX_TITLE_LENGTH = 255;

interface PasteTextDialogProps {
  appId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When set, the dialog edits this pasted-text source instead of adding one. */
  editingSourceId?: number | null;
  /** `previousId` is the id the source had before saving; it changes when the app gets its own copy. */
  onSaved: (source: KnowledgeSource, previousId?: number) => void;
}

export default function PasteTextDialog({
  appId,
  open,
  onOpenChange,
  editingSourceId,
  onSaved,
}: PasteTextDialogProps) {
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [original, setOriginal] = useState<{ title: string; text: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const editing = editingSourceId != null;

  useEffect(() => {
    if (!open) return;
    setTitle("");
    setText("");
    setOriginal(null);
    setError(null);
    if (editingSourceId == null) return;

    let cancelled = false;
    setLoading(true);
    getSource(appId, editingSourceId)
      .then((source) => {
        if (cancelled) return;
        setTitle(source.name);
        setText(source.text ?? "");
        setOriginal({ title: source.name, text: source.text ?? "" });
      })
      .catch((e) => {
        if (!cancelled) setError(apiErrorMessage(e, "This text could not be loaded."));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, appId, editingSourceId]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError("Give this text a title.");
      return;
    }
    if (!text.trim()) {
      setError("Paste or type some text.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      if (editingSourceId != null) {
        const changes: { title?: string; text?: string } = {};
        if (trimmedTitle !== original?.title) changes.title = trimmedTitle;
        if (text !== original?.text) changes.text = text;
        if (Object.keys(changes).length > 0) {
          onSaved(
            await updateTextSource(appId, editingSourceId, changes),
            editingSourceId
          );
        }
      } else {
        onSaved(await addTextSource(appId, trimmedTitle, text));
      }
      onOpenChange(false);
    } catch (e) {
      setError(apiErrorMessage(e, "This text could not be saved."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        overlayStyle={{ backgroundColor: "rgba(0, 0, 0, 0.5)" }}
        className="max-w-2xl"
      >
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit text" : "Paste text"}</DialogTitle>
            <DialogDescription>
              Add notes, FAQs or any other text you want the AI to draw on.
            </DialogDescription>
          </DialogHeader>

          {loading ? (
            <div className="flex justify-center py-8">
              <SkeletonLoader />
            </div>
          ) : (
            <>
              <div>
                <label
                  htmlFor="knowledge-text-title"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  Title
                </label>
                <Input
                  id="knowledge-text-title"
                  data-testid={TEST_IDS.KNOWLEDGE_TEXT_TITLE_INPUT}
                  type="text"
                  autoFocus={!editing}
                  value={title}
                  maxLength={MAX_TITLE_LENGTH}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="For example: Course FAQ"
                />
              </div>
              <div>
                <label
                  htmlFor="knowledge-text-body"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  Text
                </label>
                <Textarea
                  id="knowledge-text-body"
                  data-testid={TEST_IDS.KNOWLEDGE_TEXT_BODY_INPUT}
                  value={text}
                  maxLength={MAX_TEXT_LENGTH}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Paste your text here"
                  className="min-h-[240px] max-h-[50vh]"
                />
                <p className="mt-1 text-right text-xs text-gray-400">
                  {text.length.toLocaleString()} /{" "}
                  {MAX_TEXT_LENGTH.toLocaleString()} characters
                </p>
              </div>
            </>
          )}

          {error && (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting || loading}
              data-testid={TEST_IDS.KNOWLEDGE_TEXT_SUBMIT}
            >
              {submitting ? "Saving…" : editing ? "Save" : "Add"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
