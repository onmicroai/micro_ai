import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/app/(authenticated)/app/(pages)/edit/[id]/components/ui/button";
import {
  Trash2,
  Plus,
  Sparkles,
  HelpCircle,
  UploadCloud,
  X,
  FileText,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";
import { formatFileSize } from "../../utils/formatFileSize";

interface ScoringLine {
  score: number | "";
  description: string;
}

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

const ScoringLineRow = ({
  line,
  catIdx,
  lineIdx,
  handleLineChange,
  handleRemoveLine,
  isPreview,
}: {
  line: ScoringLine;
  catIdx: number;
  lineIdx: number;
  handleLineChange: (
    catIdx: number,
    lineIdx: number,
    desc: string,
    score?: number | "",
  ) => void;
  handleRemoveLine: (catIdx: number, lineIdx: number) => void;
  isPreview: boolean;
}) => {
  const scoreRef = useRef<HTMLInputElement>(null);
  const descRef = useRef<HTMLTextAreaElement>(null);

  // Sync height of score and description fields
  const adjustHeight = () => {
    if (isPreview) return;

    const scoreEl = scoreRef.current;
    const descEl = descRef.current;

    if (!scoreEl || !descEl) return;

    scoreEl.style.height = "auto";
    descEl.style.height = "auto";

    const minHeight = 48;
    const newHeight = Math.max(minHeight, descEl.scrollHeight);

    scoreEl.style.height = `${newHeight}px`;
    descEl.style.height = `${newHeight}px`;
  };

  useEffect(() => {
    adjustHeight();
  }, [line.description]);

  return (
    <tr className="group border-b border-gray-200 last:border-0 hover:bg-gray-50 transition-colors relative">
      <td className="p-0 w-32 align-top relative transition-colors">
        {!isPreview ? (
          <>
            <div className="relative w-full h-full">
              <input
                ref={scoreRef}
                type="number"
                value={line.score}
                onChange={(e) => {
                  const val = e.target.value;
                  handleLineChange(
                    catIdx,
                    lineIdx,
                    line.description,
                    val === "" ? "" : Number(val),
                  );
                }}
                onBlur={(e) => {
                  if (e.target.value === "") {
                    handleLineChange(catIdx, lineIdx, line.description, 0);
                  }
                }}
                className="w-full h-full bg-transparent border-none outline-none focus:ring-0 focus:bg-white px-4 py-3 text-sm font-bold resize-none m-0 text-gray-900 placeholder:text-gray-300"
                style={{ minHeight: "48px", boxSizing: "border-box" }}
                placeholder="0"
              />
            </div>
            <div className="absolute right-0 top-0 bottom-0 w-px bg-gray-200 group-hover:bg-gray-300 z-10 pointer-events-none" />
          </>
        ) : (
          <div className="px-4 py-3 font-bold text-sm border-r border-gray-200">
            {line.score}
          </div>
        )}
      </td>

      <td className="p-0 relative align-top">
        {!isPreview ? (
          <div className="relative w-full h-full">
            <textarea
              ref={descRef}
              value={line.description}
              onChange={(e) => {
                handleLineChange(catIdx, lineIdx, e.target.value, line.score);
              }}
              className="w-full h-full bg-transparent border-none outline-none focus:ring-0 focus:bg-white px-4 py-3 text-sm text-gray-700 resize-none block m-0 placeholder:text-gray-300"
              placeholder="Describe the criteria for this score..."
              rows={2}
              style={{ minHeight: "48px", boxSizing: "border-box" }}
            />

            <div className="absolute top-2 right-2 z-20 opacity-0 group-hover:opacity-100 transition-all">
              <TooltipProvider delayDuration={0}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveLine(catIdx, lineIdx)}
                      className="h-8 w-8 p-0 text-gray-400 hover:text-red-600 hover:bg-transparent"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent className="bg-gray-900 text-white text-xs px-2 py-1">
                    <p>Remove line</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        ) : (
          <div className="px-4 py-3 text-sm text-gray-700 whitespace-pre-wrap">
            {line.description || (
              <span className="italic text-gray-400">No description</span>
            )}
          </div>
        )}
      </td>
    </tr>
  );
};

export default function ScoringField({
  field,
  onChange,
  isPreview = true,
}: ScoringFieldProps) {
  const [showAIModal, setShowAIModal] = useState(false);
  const [rubricText, setRubricText] = useState("");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
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
    if (e.target.files && e.target.files[0]) {
      setUploadedFile(e.target.files[0]);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setUploadedFile(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const removeFile = () => {
    setUploadedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
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

      {showAIModal && (
        <div className="ai-modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 relative max-h-[90vh] overflow-y-auto">
            <button
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
              onClick={() => setShowAIModal(false)}
            >
              <span className="sr-only">Close</span>
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <span className="font-semibold text-lg">
                Build rubric with AI
              </span>
            </div>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              accept=".jpg,.jpeg,.png,.pdf,.docx,.xlsx"
              className="hidden"
            />

            {!uploadedFile ? (
              <>
                <p className="text-gray-600 text-sm mb-4">
                  Type your rubric, provide related file or image and AI will
                  prepare an editable scoring table for you.
                </p>

                <div className="border-b border-gray-200 my-4" />

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Paste rubric text
                  </label>
                  <textarea
                    className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-y min-h-[100px]"
                    placeholder="e.g. 5 points: Excellent understanding of the topic. 3 points: Basic understanding..."
                    value={rubricText}
                    onChange={(e) => setRubricText(e.target.value)}
                  />
                </div>

                <div className="relative flex py-2 items-center mb-4">
                  <div className="flex-grow border-t border-gray-200"></div>
                  <span className="flex-shrink-0 mx-4 text-gray-400 text-xs font-semibold uppercase tracking-wider">
                    Or upload file
                  </span>
                  <div className="flex-grow border-t border-gray-200"></div>
                </div>

                <div
                  className="border-2 border-dashed border-gray-300 rounded-lg bg-gray-50 flex flex-col items-center justify-center py-6 hover:bg-gray-100 transition-colors cursor-pointer group"
                  onClick={triggerFileInput}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                >
                  <div className="bg-white p-2 rounded-full shadow-sm mb-2 group-hover:scale-110 transition-transform">
                    <UploadCloud className="h-6 w-6 text-primary" />
                  </div>
                  <div className="mt-1 text-gray-900 font-medium text-sm">
                    Click to upload or drag and drop
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    JPG, PNG, PDF, DOCX, XLSX
                  </div>
                </div>
              </>
            ) : (
              <>
                <p className="text-gray-600 text-sm mb-6 mt-4">
                  Looks good! Ready to generate your rubric.
                </p>

                <div className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg bg-white mb-6 shadow-sm">
                  <div className="bg-gray-100 p-2 rounded-lg text-gray-600">
                    <FileText className="h-6 w-6" />
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <div className="text-sm font-medium text-gray-900 truncate">
                      {uploadedFile.name}
                    </div>
                    <div className="text-xs text-gray-500">
                      {formatFileSize(uploadedFile.size)}
                    </div>
                  </div>
                  <button
                    onClick={removeFile}
                    className="text-gray-400 hover:text-red-500 p-2 transition-colors"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>

                {rubricText && rubricText.trim().length > 0 && (
                  <div className="mb-6">
                    <label className="block text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">
                      Included Instructions
                    </label>
                    <div className="w-full border border-gray-200 bg-gray-50 rounded-lg p-3 text-sm text-gray-700 max-h-[120px] overflow-y-auto whitespace-pre-wrap">
                      {rubricText}
                    </div>
                  </div>
                )}
              </>
            )}

            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={() => setShowAIModal(false)}>
                Cancel
              </Button>

              <TooltipProvider delayDuration={0}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    {/* Wrapper span needed for tooltip to work on disabled button */}
                    <span tabIndex={0} className="inline-block">
                      <Button
                        variant="default"
                        className="bg-primary text-white pointer-events-none"
                        disabled={!rubricText.trim() && !uploadedFile}
                        style={{
                          pointerEvents:
                            !rubricText.trim() && !uploadedFile
                              ? "none"
                              : "auto",
                        }}
                        onClick={() => {
                          // TODO: Implement generation logic
                          setShowAIModal(false);
                          setRubricText("");
                          setUploadedFile(null);
                        }}
                      >
                        Generate rubric
                      </Button>
                    </span>
                  </TooltipTrigger>

                  {!rubricText.trim() && !uploadedFile && (
                    <TooltipContent
                      side="top"
                      className="bg-gray-900 text-white border-0"
                    >
                      <p>Please enter text or upload a file to continue</p>
                    </TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
