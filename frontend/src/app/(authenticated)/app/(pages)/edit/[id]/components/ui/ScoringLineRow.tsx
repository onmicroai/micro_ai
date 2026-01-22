import React, { useCallback, useEffect, useRef } from "react";
import { Button } from "@/app/(authenticated)/app/(pages)/edit/[id]/components/ui/button";
import { Trash2 } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";

export interface ScoringLine {
  score: number | "";
  description: string;
}

interface ScoringLineRowProps {
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
}

const ScoringLineRow: React.FC<ScoringLineRowProps> = ({
  line,
  catIdx,
  lineIdx,
  handleLineChange,
  handleRemoveLine,
  isPreview,
}) => {
  const scoreRef = useRef<HTMLInputElement>(null);
  const descRef = useRef<HTMLTextAreaElement>(null);

  // Sync height of score and description fields
  const adjustHeight = useCallback(() => {
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
  }, [isPreview]);

  useEffect(() => {
    adjustHeight();
  }, [line.description, adjustHeight]);

  return (
    <tr className="group border-b border-gray-200 last:border-0 hover:bg-gray-50 transition-colors relative">
      <td className="p-0 w-32 align-top relative transition-colors text-center">
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
                className="w-full h-full bg-transparent border-none outline-none focus:ring-0 focus:bg-white px-4 py-3 text-sm font-bold resize-none m-0 text-gray-900 placeholder:text-gray-300 text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none h-[48px]"
                style={{ boxSizing: "border-box" }}
                placeholder="0"
              />
            </div>
            <div className="absolute right-0 top-0 bottom-0 w-px bg-gray-200 group-hover:bg-gray-300 z-10 pointer-events-none" />
          </>
        ) : (
          <div className="px-4 py-3 font-bold text-sm border-r border-gray-200 flex items-center justify-center h-full min-h-[48px]">
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

export default ScoringLineRow;
