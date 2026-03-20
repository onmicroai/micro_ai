"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/(authenticated)/app/(pages)/edit/[id]/components/ui/select";
import { Input } from "@/components/basic/input";
import { Collection } from "@/app/(authenticated)/(dashboard)/types";
import { cn } from "@/utils/cn";
import Modal, { useModalPortalContainer } from "../Modal";

//TODO: add restricted option
const PRIVACY_OPTIONS = [
  { name: "Private", value: "private" },
  { name: "Public", value: "public" },
] as const;

export interface CreateAppFormValues {
  title: string;
  collectionId: number;
  privacy: string;
}

interface CreateAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (values: CreateAppFormValues) => void | Promise<void>;
  collections: Collection[];
  defaultCollectionId: number | null;
  isLoading?: boolean;
}

function CreateAppForm({
  onConfirm,
  onClose,
  collections,
  defaultCollectionId,
  isLoading = false,
  onSelectOpenChange,
}: Omit<CreateAppModalProps, "isOpen"> & {
  onSelectOpenChange?: (open: boolean) => void;
}) {
  const portalContainer = useModalPortalContainer();
  const [title, setTitle] = useState("");
  const [collectionId, setCollectionId] = useState<string>("");
  const [privacy, setPrivacy] = useState<string>("private");
  const [error, setError] = useState<string | null>(null);

  const defaultId = defaultCollectionId ?? collections[0]?.id;

  useEffect(() => {
    setTitle("");
    setCollectionId(
      collections.length > 0 ? String(defaultId || collections[0].id) : ""
    );
    setPrivacy("private");
    setError(null);
  }, [defaultId, collections]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) {
      setError("App name is required.");
      return;
    }
    if (collections.length === 0) {
      setError("Please create a collection first.");
      return;
    }
    const cid = collectionId ? Number(collectionId) : collections[0]?.id;
    if (!cid) {
      setError("Please select a collection.");
      return;
    }
    setError(null);
    try {
      await onConfirm({
        title: trimmed,
        collectionId: cid,
        privacy: privacy || "private",
      });
      onClose();
    } catch {
      setError("Failed to create app. Please try again.");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label
          htmlFor="create-app-title"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
        >
          App name
        </label>
        <Input
          id="create-app-title"
          type="text"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            setError(null);
          }}
          placeholder="Enter app name"
          error={error === "App name is required."}
          errorMessage={error === "App name is required." ? error : undefined}
          autoFocus
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Collection
        </label>
        <Select
          value={collectionId}
          onValueChange={(v) => {
            setCollectionId(v);
            setError(null);
          }}
          onOpenChange={onSelectOpenChange}
        >
          <SelectTrigger
            className="w-full bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            id="create-app-collection"
          >
            <SelectValue placeholder="Select collection" />
          </SelectTrigger>
          <SelectContent
            container={portalContainer}
            className="z-[10001] bg-white dark:bg-gray-800"
          >
            {collections.map((c) => (
              <SelectItem key={c.id} value={String(c.id)}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Privacy
        </label>
        <Select
          value={privacy}
          onValueChange={setPrivacy}
          onOpenChange={onSelectOpenChange}
        >
          <SelectTrigger
            className="w-full bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            id="create-app-privacy"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent
            container={portalContainer}
            className="z-[10001] bg-white dark:bg-gray-800"
          >
            {PRIVACY_OPTIONS.map((p) => (
              <SelectItem key={p.value} value={p.value}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {error && error !== "App name is required." && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      <div className="flex justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isLoading}
          className={cn(
            "px-4 py-2 rounded-lg bg-primary text-white hover:bg-primary-600 transition-colors",
            isLoading && "opacity-50 cursor-not-allowed"
          )}
        >
          {isLoading ? "Creating..." : "Confirm"}
        </button>
      </div>
    </form>
  );
}

export default function CreateAppModal(props: CreateAppModalProps) {
  const { isOpen, onClose } = props;
  const openSelectRef = useRef(false);
  useEffect(() => {
    if (!isOpen) openSelectRef.current = false;
  }, [isOpen]);
  const handleSelectOpenChange = (open: boolean) => {
    if (open) {
      openSelectRef.current = true;
    } else {
      // Delay update so Modal's mousedown handler can still see "open" and prevent close
      queueMicrotask(() => {
        openSelectRef.current = false;
      });
    }
  };
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add new app"
      preventCloseOnOutsideClick={() => openSelectRef.current}
    >
      <CreateAppForm {...props} onSelectOpenChange={handleSelectOpenChange} />
    </Modal>
  );
}
