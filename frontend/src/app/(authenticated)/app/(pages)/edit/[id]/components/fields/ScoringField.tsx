import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/app/(authenticated)/app/(pages)/edit/[id]/components/ui/button";
import { Trash2, Plus, Sparkles, HelpCircle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";
import RubricAIModal from "../ui/RubricAIModal";
import ScoringLineRow, { ScoringLine } from "../ui/ScoringLineRow";

interface ScoringCategory {
  criteria: string;
  lines: ScoringLine[];
}

interface ScoringFieldProps {
  field: {
    id: string;
    name: string;
    minScore?: number;
    rubric?: string; // JSON string
  };
  onChange?: (fieldId: string, updates: Partial<any>) => void;
  isPreview?: boolean;
}

export default function ScoringField({
  field,
  onChange,
  isPreview = true,
}: ScoringFieldProps) {
  const [showAIModal, setShowAIModal] = useState(false);
  const [rubricText, setRubricText] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Parse rubric from JSON string
  const categories: ScoringCategory[] = (() => {
    try {
      return JSON.parse(field.rubric || "[]");
    } catch {
      return [];
    }
  })();

  const handleLineChange = (
    catIdx: number,
    lineIdx: number,
    desc: string,
    score?: number | "",
  ) => {
    if (isPreview) return;
    const newCategories = categories.map((cat, i) =>
      i === catIdx
        ? {
            ...cat,
            lines: cat.lines.map((line, j) =>
              j === lineIdx
                ? {
                    ...line,
                    description: desc,
                    ...(score !== undefined ? { score } : {}),
                  }
                : line,
            ),
          }
        : cat,
    );
    onChange?.(field.id, { rubric: JSON.stringify(newCategories) });
  };

  const handleRemoveLine = (catIdx: number, lineIdx: number) => {
    if (isPreview) return;
    const newCategories = categories.map((cat, i) =>
      i === catIdx
        ? {
            ...cat,
            lines: cat.lines.filter((_, j) => j !== lineIdx),
          }
        : cat,
    );
    onChange?.(field.id, { rubric: JSON.stringify(newCategories) });
  };

  const handleAddLine = (catIdx: number) => {
    if (isPreview) return;
    const newCategories = categories.map((cat, i) =>
      i === catIdx
        ? {
            ...cat,
            lines: [...cat.lines, { score: 0, description: "" }],
          }
        : cat,
    );
    onChange?.(field.id, { rubric: JSON.stringify(newCategories) });
  };

  const handleAddCategory = () => {
    if (isPreview) return;
    const newCategories: ScoringCategory[] = [
      ...categories,
      { criteria: `Category ${categories.length + 1}`, lines: [] },
    ];
    onChange?.(field.id, { rubric: JSON.stringify(newCategories) });
  };

  const handleRemoveCategory = (catIdx: number) => {
    if (isPreview) return;
    const newCategories = categories.filter((_, i) => i !== catIdx);
    onChange?.(field.id, { rubric: JSON.stringify(newCategories) });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files);
      setUploadedFiles((prev) => [...prev, ...newFiles]);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const newFiles = Array.from(e.dataTransfer.files);
      setUploadedFiles((prev) => [...prev, ...newFiles]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const removeFile = (indexToRemove: number) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== indexToRemove));
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  // Block background scrolling when AI modal is open
  useEffect(() => {
    if (showAIModal) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [showAIModal]);

  return (
    <div className={`space-y-6`}>
      <div className="space-y-1">
        <label className="text-sm font-medium text-gray-700">
          Minimum Score
        </label>
        {isPreview ? (
          <div className="w-full border border-gray-100 rounded-md px-3 py-2 text-sm text-gray-500 bg-gray-50">
            {field.minScore ?? (
              <span className="italic text-gray-400">Not set</span>
            )}
          </div>
        ) : (
          <input
            type="number"
            value={field.minScore ?? ""}
            onChange={(e) => {
              if (isPreview) return;
              const val = e.target.value;
              onChange?.(field.id, {
                minScore: val === "" ? undefined : Number(val),
              });
            }}
            onBlur={(e) => {
              if (e.target.value === "") {
                onChange?.(field.id, { minScore: 0 });
              }
            }}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            placeholder="Enter minimum score"
          />
        )}
      </div>

      <div className="flex items-center justify-between mt-6 mb-2">
        <div className="flex items-center gap-2">
          <label className="text-sm font-bold text-gray-900">Rubric</label>
          <TooltipProvider delayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild>
                <HelpCircle className="h-4 w-4 text-gray-400 cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="right">
                <p className="w-[200px] text-xs">
                  Define the criteria and scores for evaluating responses.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {!isPreview && (
          <Button
            variant="ghost"
            size="sm"
            className="bg-indigo-50 text-indigo-600 hover:bg-indigo-100 hover:text-indigo-700 transition-colors"
            onClick={() => setShowAIModal(true)}
          >
            <Sparkles className="h-4 w-4 mr-2" />
            Build with AI
          </Button>
        )}
      </div>
      <AnimatePresence initial={false}>
        {categories.map((cat, catIdx) => (
          <motion.div
            key={catIdx}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden space-y-3"
          >
            {" "}
            <div className="flex items-center group/header">
              {!isPreview ? (
                <div className="flex-1 flex items-center gap-2">
                  <span className="font-bold text-gray-500">{catIdx + 1}.</span>
                  <input
                    type="text"
                    value={cat.criteria}
                    onChange={(e) => {
                      const newCategories = categories.map((c, i) =>
                        i === catIdx ? { ...c, criteria: e.target.value } : c,
                      );
                      onChange?.(field.id, {
                        rubric: JSON.stringify(newCategories),
                      });
                    }}
                    className="font-bold text-base bg-transparent border-b border-transparent hover:border-gray-300 focus:border-primary focus:outline-none focus:ring-0 px-0 py-1 text-gray-900 placeholder:text-gray-400 flex-1 transition-colors"
                    placeholder="Category Name"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveCategory(catIdx)}
                    className="opacity-0 group-hover/header:opacity-100 text-gray-400 hover:text-red-500 transition-opacity"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <span className="font-bold text-base text-gray-900">
                  {catIdx + 1}. {cat.criteria}
                </span>
              )}
            </div>
            <div className="border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm">
              <table className="w-full table-fixed border-collapse">
                <thead>
                  <tr className="bg-gray-50/50 border-b border-gray-200 text-xs text-gray-500 uppercase tracking-wider">
                    <th className="px-4 py-2 text-left font-medium w-32 border-r border-gray-200">
                      Score
                    </th>
                    <th className="px-4 py-2 text-left font-medium">
                      Description
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {cat.lines.map((line, lineIdx) => (
                    <ScoringLineRow
                      key={lineIdx}
                      line={line}
                      catIdx={catIdx}
                      lineIdx={lineIdx}
                      handleLineChange={handleLineChange}
                      handleRemoveLine={handleRemoveLine}
                      isPreview={isPreview}
                    />
                  ))}
                </tbody>
              </table>
            </div>
            {!isPreview && (
              <button
                onClick={() => handleAddLine(catIdx)}
                className="flex items-center gap-1 text-sm text-primary hover:text-primary/80 font-medium transition-colors px-1"
              >
                <Plus className="h-4 w-4" />
                Add line
              </button>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
      {!isPreview && (
        <Button
          type="button"
          onClick={handleAddCategory}
          variant="default"
          size="lg"
          className="bg-primary text-primary-foreground hover:bg-primary-600"
        >
          <Plus className="h-5 w-5 mr-2" />
          Add Category
        </Button>
      )}

      <RubricAIModal
        open={showAIModal}
        onClose={() => setShowAIModal(false)}
        rubricText={rubricText}
        setRubricText={setRubricText}
        uploadedFiles={uploadedFiles}
        setUploadedFiles={setUploadedFiles}
        fileInputRef={fileInputRef}
        removeFile={removeFile}
        triggerFileInput={triggerFileInput}
        handleFileSelect={handleFileSelect}
        handleDrop={handleDrop}
        handleDragOver={handleDragOver}
      />
    </div>
  );
}
