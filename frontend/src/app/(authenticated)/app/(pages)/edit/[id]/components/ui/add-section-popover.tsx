"use client";

import React from "react";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

export type AddSectionItem = {
  id: string;
  label: string;
  helper?: string;
  icon: React.ComponentType<{ className?: string }>;
};

export type SectionGroup = {
  label: string;
  color: "blue" | "green" | "brown" | string;
  sections: AddSectionItem[];
};

function resolveAccent(group: SectionGroup): { text: string; border: string } {
  switch (group.color) {
    case "green":
      return { text: "text-green-700", border: "border-green-700" };
    case "brown":
      return { text: "text-amber-700", border: "border-amber-700" };
    case "blue":
    default:
      return { text: "text-blue-800", border: "border-blue-800" };
  }
}

export function AddSectionPopover({
  open,
  onOpenChange,
  trigger,
  sections,
  onSelect,
  contentAlign = "start",
  contentSide = "bottom",
  contentClassName = "w-72 p-2",
  contentStyle,
  showHelpers = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: React.ReactNode;
  sections: SectionGroup[];
  onSelect: (sectionId: string) => void;
  contentAlign?: "start" | "center" | "end";
  contentSide?: "top" | "right" | "bottom" | "left";
  contentClassName?: string;
  contentStyle?: React.CSSProperties;
  showHelpers?: boolean;
}) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        align={contentAlign}
        side={contentSide}
        className={contentClassName}
        style={contentStyle}
      >
        <div className="space-y-2">
          {sections.map((sg, idx) => {
            const accent = resolveAccent(sg);
            return (
              <div key={sg.label} className="space-y-1">
                <div
                  className={`text-[11px] leading-tight font-medium px-2 mx-2 border-l-4 text-gray-500 ${accent.border}`}
                >
                  {sg.label}
                </div>

                <div className="space-y-1">
                  {sg.sections.map((section) => {
                    const Icon = section.icon;
                    return (
                      <button
                        key={section.id}
                        type="button"
                        onClick={() => onSelect(section.id)}
                        className={`w-full flex items-center gap-2 px-2 py-2 rounded-md transition-colors text-left`}
                      >
                        <Icon
                          className={`h-4 w-4 flex-shrink-0 ${accent.text}`}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium text-gray-900">
                            {section.label}
                          </div>
                          {showHelpers && section.helper ? (
                            <div className="text-[11px] leading-snug text-gray-500 line-clamp-2">
                              {section.helper}
                            </div>
                          ) : null}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {idx < sections.length - 1 ? (
                  <div className="my-2 border-t border-gray-200" />
                ) : null}
              </div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
