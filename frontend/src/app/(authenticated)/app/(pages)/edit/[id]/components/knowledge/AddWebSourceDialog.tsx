"use client";

import { useEffect, useState } from "react";
import { z } from "zod";
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
import { TEST_IDS } from "@/constants/testIds";
import {
  addWebSource,
  apiErrorMessage,
  KnowledgeSource,
  MAX_SITE_PAGES,
} from "./knowledgeApi";

const urlSchema = z
  .string()
  .trim()
  .min(1, "Enter a URL.")
  .max(2048, "This URL is too long.")
  .transform((value) => (value.includes("://") ? value : `https://${value}`))
  .refine((value) => {
    try {
      const parsed = new URL(value);
      return (
        (parsed.protocol === "http:" || parsed.protocol === "https:") &&
        parsed.hostname.includes(".")
      );
    } catch {
      return false;
    }
  }, "Enter a valid web address, for example https://example.com/page.");

type Mode = "page" | "site";

const MODES: { value: Mode; label: string; hint: string }[] = [
  {
    value: "page",
    label: "Just this page",
    hint: "Adds the text of this one page.",
  },
  {
    value: "site",
    label: "Whole website",
    hint: `Follows links from this page and adds up to ${MAX_SITE_PAGES} pages under the same address.`,
  },
];

interface AddWebSourceDialogProps {
  appId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdded: (source: KnowledgeSource) => void;
}

export default function AddWebSourceDialog({
  appId,
  open,
  onOpenChange,
  onAdded,
}: AddWebSourceDialogProps) {
  const [url, setUrl] = useState("");
  const [mode, setMode] = useState<Mode>("page");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setUrl("");
      setMode("page");
      setError(null);
    }
  }, [open]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const parsed = urlSchema.safeParse(url);
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      onAdded(await addWebSource(appId, parsed.data, mode));
      onOpenChange(false);
    } catch (e) {
      setError(apiErrorMessage(e, "This address could not be added."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent overlayStyle={{ backgroundColor: "rgba(0, 0, 0, 0.5)" }}>
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Add a web page or website</DialogTitle>
            <DialogDescription>
              The text is read once and saved. Use Refresh on the source
              whenever you want to pick up changes.
            </DialogDescription>
          </DialogHeader>

          <div>
            <label
              htmlFor="knowledge-web-url"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Web address
            </label>
            <Input
              id="knowledge-web-url"
              data-testid={TEST_IDS.KNOWLEDGE_WEB_URL_INPUT}
              type="text"
              inputMode="url"
              autoFocus
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/docs"
              aria-invalid={error ? true : undefined}
            />
            {error && (
              <p role="alert" className="mt-1 text-sm text-red-600">
                {error}
              </p>
            )}
          </div>

          <fieldset className="space-y-2">
            <legend className="mb-1 text-sm font-medium text-gray-700">
              What to add
            </legend>
            {MODES.map((option) => (
              <label
                key={option.value}
                className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 ${
                  mode === option.value
                    ? "border-primary-600 bg-primary-50"
                    : "border-gray-200"
                }`}
              >
                <input
                  type="radio"
                  name="knowledge-web-mode"
                  className="mt-1"
                  value={option.value}
                  checked={mode === option.value}
                  onChange={() => setMode(option.value)}
                />
                <span>
                  <span className="block text-sm font-medium text-gray-800">
                    {option.label}
                  </span>
                  <span className="block text-xs text-gray-500">
                    {option.hint}
                  </span>
                </span>
              </label>
            ))}
          </fieldset>

          <p className="text-xs text-gray-500">
            Pages that need a login, or that only show their content with
            JavaScript, cannot be read.
          </p>

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
              disabled={submitting}
              data-testid={TEST_IDS.KNOWLEDGE_WEB_SUBMIT}
            >
              {submitting ? "Adding…" : "Add"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
