import { useEffect } from "react";
import { Button } from "@/app/(authenticated)/app/(pages)/edit/[id]/components/ui/button";
import { Sparkles, UploadCloud, X, FileText, Trash2 } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";
import { formatFileSize } from "../../utils/formatFileSize";

interface RubricAIModalProps {
  open: boolean;
  onClose: () => void;
  rubricText: string;
  setRubricText: (val: string) => void;
  uploadedFile: File | null;
  setUploadedFile?: (file: File | null) => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
  removeFile: () => void;
  triggerFileInput: () => void;
  handleFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleDrop: (e: React.DragEvent) => void;
  handleDragOver: (e: React.DragEvent) => void;
}

const RubricAIModal: React.FC<RubricAIModalProps> = ({
  open,
  onClose,
  rubricText,
  setRubricText,
  uploadedFile,
  setUploadedFile,
  fileInputRef,
  removeFile,
  triggerFileInput,
  handleFileSelect,
  handleDrop,
  handleDragOver,
}) => {
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

  const isGenerateDisabled = !rubricText.trim() && !uploadedFile;

  return (
    <div className="ai-modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 relative max-h-[90vh] overflow-y-auto">
        <button
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
          onClick={onClose}
        >
          <span className="sr-only">Close</span>
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <span className="font-semibold text-lg">Build rubric with AI</span>
        </div>

        {/* Hidden file input */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          accept=".jpg,.jpeg,.png,.pdf,.docx,.xlsx"
          className="hidden"
        />

        <p className="text-gray-600 text-sm mb-4">
          Type your rubric, provide related file or image and AI will prepare an
          editable scoring table for you.
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

        {!uploadedFile ? (
          <>
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
            <div className="relative flex py-2 items-center mb-4">
              <div className="flex-grow border-t border-gray-200"></div>
              <span className="flex-shrink-0 mx-4 text-gray-400 text-xs font-semibold uppercase tracking-wider">
                Attached file
              </span>
              <div className="flex-grow border-t border-gray-200"></div>
            </div>

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
                title="Remove file"
              >
                <Trash2 className="h-5 w-5" />
              </button>
            </div>
          </>
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
                    onClick={() => {
                      // TODO: Implement generation logic
                      onClose();
                      setRubricText("");
                      if (setUploadedFile) setUploadedFile(null);
                    }}
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
                  <p>Please enter text or upload a file to continue</p>
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    </div>
  );
};

export default RubricAIModal;
