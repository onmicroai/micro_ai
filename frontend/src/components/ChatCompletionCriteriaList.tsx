"use client";

import React, { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown, Circle, Loader2 } from "lucide-react";
import { CompletionCriterion } from "@/app/(authenticated)/app/types";
import { cn } from "@/utils/cn";

interface ChatCompletionCriteriaListProps {
  criteria: CompletionCriterion[];
  status: Record<string, boolean>;
  isChecking?: boolean;
  /** When true, render a static list without the disclosure chrome. */
  readOnly?: boolean;
  /** Compact top-right header control with a dropdown checklist. */
  variant?: "header" | "default";
  className?: string;
}

export function getActiveCompletionCriteria(
  criteria: CompletionCriterion[] | undefined,
): CompletionCriterion[] {
  return (criteria || []).filter((criterion) => criterion.text.trim());
}

export function areAllCompletionCriteriaMet(
  criteria: CompletionCriterion[],
  status: Record<string, boolean>,
): boolean {
  if (criteria.length === 0) return false;
  return criteria.every((criterion) => status[criterion.id] === true);
}

function CriteriaItems({
  criteria,
  status,
}: {
  criteria: CompletionCriterion[];
  status: Record<string, boolean>;
}) {
  return (
    <ul className="space-y-1.5">
      {criteria.map((criterion) => {
        const isComplete = status[criterion.id] === true;
        return (
          <li
            key={criterion.id}
            className="flex items-start gap-2 text-xs text-gray-700"
          >
            {isComplete ? (
              <Check
                className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600"
                aria-hidden="true"
              />
            ) : (
              <Circle
                className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-300"
                aria-hidden="true"
              />
            )}
            <span className={cn(isComplete && "text-gray-900")}>
              {criterion.text}
            </span>
            <span className="sr-only">
              {isComplete ? "Completed" : "Not completed"}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export default function ChatCompletionCriteriaList({
  criteria,
  status,
  isChecking = false,
  readOnly = false,
  variant = "default",
  className,
}: ChatCompletionCriteriaListProps) {
  const completedCount = criteria.filter(
    (criterion) => status[criterion.id] === true,
  ).length;
  const total = criteria.length;
  const allComplete = total > 0 && completedCount === total;
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  if (readOnly) {
    return (
      <div className={cn("space-y-2", className)}>
        <p
          className={cn(
            "text-xs font-medium",
            allComplete ? "text-emerald-700" : "text-gray-600",
          )}
        >
          Completion Criteria: {completedCount}/{total}
        </p>
        <CriteriaItems criteria={criteria} status={status} />
      </div>
    );
  }

  if (variant === "header") {
    return (
      <div ref={rootRef} className={cn("relative shrink-0", className)}>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((prev) => !prev)}
          className={cn(
            "inline-flex max-w-[13rem] items-center gap-1 rounded-md px-1.5 py-1 text-left text-xs font-medium transition-colors hover:bg-black/[0.04]",
            allComplete ? "text-emerald-700" : "text-gray-600",
          )}
        >
          {isChecking ? (
            <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-primary" />
          ) : null}
          <span className="truncate">
            Completion Criteria: {completedCount}/{total}
          </span>
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 shrink-0 transition-transform",
              open && "rotate-180",
            )}
          />
        </button>
        {open && (
          <div
            id={panelId}
            role="region"
            aria-label="Completion criteria details"
            className="absolute right-0 top-full z-30 mt-1 w-64 rounded-lg border border-gray-200 bg-white p-3 shadow-lg"
          >
            <CriteriaItems criteria={criteria} status={status} />
          </div>
        )}
      </div>
    );
  }

  return (
    <details
      className={cn(
        "mb-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-2",
        className,
      )}
    >
      <summary
        className={cn(
          "flex cursor-pointer list-none items-center justify-between gap-2 text-xs font-medium [&::-webkit-details-marker]:hidden",
          allComplete ? "text-emerald-700" : "text-gray-700",
        )}
      >
        <span className="inline-flex items-center gap-1.5">
          {isChecking ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
          ) : null}
          {isChecking
            ? "Updating completion criteria…"
            : `Completion Criteria: ${completedCount}/${total}`}
        </span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-gray-400" />
      </summary>
      <div className="mt-2 border-t border-gray-200 pt-2">
        <CriteriaItems criteria={criteria} status={status} />
      </div>
    </details>
  );
}
