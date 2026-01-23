import React, { useEffect, useState } from "react";
import { Button } from "@/app/(authenticated)/app/(pages)/edit/[id]/components/ui/button";
import {
  Sparkles,
  UploadCloud,
  X,
  FileText,
  Trash2,
  BrainCircuit,
  ScanSearch,
  PenTool,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";
import { formatFileSize } from "../../utils/formatFileSize";
import { motion, AnimatePresence } from "framer-motion";

interface RubricAIModalProps {
  open: boolean;
  onClose: () => void;
  rubricText: string;
  setRubricText: (val: string) => void;
  uploadedFiles: File[];
  fileInputRef: React.RefObject<HTMLInputElement>;
  removeFile: (index: number) => void;
  triggerFileInput: () => void;
  handleFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleDrop: (e: React.DragEvent) => void;
  handleDragOver: (e: React.DragEvent) => void;
  onGenerateRubric: () => void;
  loading: boolean;
  error: string | null;
}

const LOADING_PHASES = {
  READING: "reading",
  THINKING: "thinking",
  GENERATING: "generating",
};

const RubricAIModal: React.FC<RubricAIModalProps> = ({
  open,
  onClose,
  rubricText,
  setRubricText,
  uploadedFiles,
  fileInputRef,
  removeFile,
  triggerFileInput,
  handleFileSelect,
  handleDrop,
  handleDragOver,
  loading,
  error,
  onGenerateRubric,
}) => {
  const [loadingPhase, setLoadingPhase] = useState(LOADING_PHASES.READING);

  // 1. Loading phase management
  useEffect(() => {
    if (!loading) {
      setLoadingPhase(LOADING_PHASES.READING);
      return;
    }
    // 0-7с: Reading
    const thinkingTimer = setTimeout(() => {
      setLoadingPhase(LOADING_PHASES.THINKING);
    }, 7000);
    // 7-14с: Thinking -> Generating
    const generatingTimer = setTimeout(() => {
      setLoadingPhase(LOADING_PHASES.GENERATING);
    }, 14000);

    return () => {
      clearTimeout(thinkingTimer);
      clearTimeout(generatingTimer);
    };
  }, [loading]);

  // Block background scrolling when modal is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [open]);

  if (!open) return null;

  const isGenerateDisabled = !rubricText.trim() && uploadedFiles.length === 0;

  const getLoadingState = () => {
    switch (loadingPhase) {
      case LOADING_PHASES.READING:
        return {
          text:
            uploadedFiles.length > 0
              ? "Reading documents..."
              : "Reading prompt...",
          subText: "Analyzing your requirements",
          icon: (
            <ScanSearch className="w-10 h-10 text-blue-500 animate-pulse" />
          ),
          color: "bg-blue-500",
        };
      case LOADING_PHASES.THINKING:
        return {
          text: "Thinking...",
          subText: "Structuring evaluation criteria",
          icon: (
            <BrainCircuit className="w-10 h-10 text-purple-500 animate-pulse" />
          ),
          color: "bg-purple-500",
        };
      case LOADING_PHASES.GENERATING:
      default:
        return {
          text: "Generating rubric...",
          subText: "Writing scoring descriptions",
          icon: <PenTool className="w-10 h-10 text-green-500 animate-bounce" />,
          color: "bg-green-500",
        };
    }
  };

  const currentLoadingState = getLoadingState();

  return (
    <div className="ai-modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 relative max-h-[90vh] overflow-y-auto">
        {!loading && (
          <button
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors z-10"
            onClick={onClose}
          >
            <span className="sr-only">Close</span>
            <X className="h-5 w-5" />
          </button>
        )}

        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex flex-col items-center justify-center py-10 min-h-[400px]"
            >
              <div className="relative mb-6">
                <div
                  className={`absolute inset-0 ${currentLoadingState.color} blur-2xl opacity-20 rounded-full scale-150`}
                ></div>
                <div className="relative bg-white p-3 rounded-xl shadow-sm border border-gray-100">
                  {currentLoadingState.icon}
                </div>
              </div>

              <motion.h3
                key={currentLoadingState.text}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-lg font-bold text-gray-900 mb-1"
              >
                {currentLoadingState.text}
              </motion.h3>

              <motion.p
                key={currentLoadingState.subText}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-gray-500 text-sm mb-6"
              >
                {currentLoadingState.subText}
              </motion.p>

              <div className="w-full max-w-xs h-1 bg-gray-100 rounded-full overflow-hidden mb-8">
                <motion.div
                  className={`h-full ${currentLoadingState.color}`}
                  initial={{ x: "-100%" }}
                  animate={{ x: "100%" }}
                  transition={{
                    repeat: Infinity,
                    duration: 1.5,
                    ease: "linear",
                  }}
                />
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={onClose}
                className="border-primary text-primary hover:bg-primary/10 hover:text-primary transition-colors"
              >
                Stop generating
              </Button>
            </motion.div>
          ) : (
            <motion.div
              key="form"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <span className="font-semibold text-lg">
                  Build rubric with AI
                </span>
              </div>

              {/* Hidden file input */}
              <input
                type="file"
                multiple
                ref={fileInputRef}
                onChange={handleFileSelect}
                accept=".jpg,.jpeg,.png,.pdf,.docx,.xlsx"
                className="hidden"
              />

              <p className="text-gray-600 text-sm mb-4">
                Type your rubric, provide related files or images and AI will
                prepare an editable scoring table for you.
              </p>

              <div className="border-b border-gray-200 my-4" />

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Type rubric text
                </label>
                <textarea
                  className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-y min-h-[100px]"
                  placeholder="e.g. 5 points: Excellent understanding of the topic. 3 points: Basic understanding..."
                  value={rubricText}
                  onChange={(e) => setRubricText(e.target.value)}
                />
              </div>
              {uploadedFiles.length > 0 && (
                <div className="mb-4 space-y-2">
                  <div className="relative flex py-2 items-center">
                    <div className="flex-grow border-t border-gray-200"></div>
                    <span className="flex-shrink-0 mx-4 text-gray-400 text-xs font-semibold uppercase tracking-wider">
                      Attached files ({uploadedFiles.length})
                    </span>
                    <div className="flex-grow border-t border-gray-200"></div>
                  </div>

                  {uploadedFiles.map((file, index) => (
                    <div
                      key={`${file.name}-${index}`}
                      className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg bg-white shadow-sm"
                    >
                      <div className="bg-gray-100 p-2 rounded-lg text-gray-600">
                        <FileText className="h-5 w-5" />
                      </div>
                      <div className="flex-1 overflow-hidden">
                        <div className="text-sm font-medium text-gray-900 truncate">
                          {file.name}
                        </div>
                        <div className="text-xs text-gray-500">
                          {formatFileSize(file.size)}
                        </div>
                      </div>
                      <button
                        onClick={() => removeFile(index)}
                        className="text-gray-400 hover:text-red-500 p-2 transition-colors"
                        title="Remove file"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="relative flex py-2 items-center mb-4">
                <div className="flex-grow border-t border-gray-200"></div>
                <span className="flex-shrink-0 mx-4 text-gray-400 text-xs font-semibold uppercase tracking-wider">
                  {uploadedFiles.length > 0
                    ? "Add more files"
                    : "Or upload files"}
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

              {error && (
                <div className="text-red-500 text-sm mt-2">{error}</div>
              )}

              <div className="flex justify-end gap-2 mt-6">
                <Button variant="outline" onClick={onClose}>
                  Cancel
                </Button>

                <TooltipProvider delayDuration={0}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span tabIndex={0} className="inline-block">
                        <Button
                          variant="default"
                          className="bg-primary text-white pointer-events-none"
                          disabled={isGenerateDisabled}
                          style={{
                            pointerEvents: isGenerateDisabled ? "none" : "auto",
                          }}
                          onClick={onGenerateRubric}
                        >
                          Generate rubric
                        </Button>
                      </span>
                    </TooltipTrigger>

                    {isGenerateDisabled && (
                      <TooltipContent
                        side="top"
                        className="bg-gray-900 text-white border-0"
                      >
                        <p>
                          Please enter text or upload related files to continue
                        </p>
                      </TooltipContent>
                    )}
                  </Tooltip>
                </TooltipProvider>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default RubricAIModal;
