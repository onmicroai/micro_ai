import React, { useState, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { FaRegCopy, FaCopy, FaThumbsUp, FaThumbsDown } from "react-icons/fa6";
import CodeBlock from "@/components/MessageCodeBlock";
import TableWrapper from "@/components/MessageTableWrapper";
import { Run } from "@/store/conversationStore";
import { proseClasses } from "@/styles/proseClasses";
import { updateRunUtil } from "@/utils/sendPrompts";
import { useUserStore } from "@/store/userStore";
import {
  buildScoreBreakdown,
  criterionHint,
  extractOverallRationale,
  getRubricCriteriaNames,
  getScoreColorByPct,
  ScoreCriterion,
  shouldShowOverallFeedback,
  smoothScrollToElement,
} from "@/utils/scoreDisplayUtils";
import ReactMarkdownWrapper from "@/components/basic/ReactMarkdownWrapper";

interface AIResponseDisplayProps {
  run: Run | null;
  isOwner?: boolean;
  isAdmin?: boolean;
}

interface RunScoreDisplayProps {
  run: Run | null;
  isEvaluating?: boolean;
  explanationContent?: string | null;
}

export const MarkdownResponseDisplay: React.FC<{
  content: string;
  footer?: React.ReactNode;
  className?: string;
}> = ({ content, footer, className }) => {
  if (!content) return null;

  return (
    <div
      className={`bg-gradient-to-b from-white to-gray-50/50 border border-gray-200/80 rounded-sm p-6 shadow-sm backdrop-blur-sm ${
        className || ""
      }`}
    >
      <div className={proseClasses}>
        <ReactMarkdownWrapper>{content}</ReactMarkdownWrapper>
      </div>
      {footer ? (
        <div className="mt-4 pt-4 border-t border-gray-100">{footer}</div>
      ) : null}
    </div>
  );
};

export const AIResponseDisplay: React.FC<AIResponseDisplayProps> = ({
  run,
  isOwner = false,
  isAdmin = false,
}) => {
  const [copied, setCopied] = useState(false);
  const [liked, setLiked] = useState(false);
  const [disliked, setDisliked] = useState(false);
  const { user } = useUserStore();

  // Initialize liked/disliked states based on run.satisfaction
  useEffect(() => {
    if (run) {
      setLiked(run.satisfaction === 1);
      setDisliked(run.satisfaction === -1);
    }
  }, [run]);

  if (!run) return null;

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLike = () => {
    if (!run.id) return;
    const newLiked = !liked;
    setLiked(newLiked);
    setDisliked(false);

    // Update on server
    updateRunUtil(
      run.id,
      {
        satisfaction: newLiked ? 1 : null,
      },
      user?.id || null
    );
  };

  const handleDislike = () => {
    if (!run.id) return;
    const newDisliked = !disliked;
    setDisliked(newDisliked);
    setLiked(false);

    // Update on server
    updateRunUtil(
      run.id,
      {
        satisfaction: newDisliked ? -1 : null,
      },
      user?.id || null
    );
  };

  // Get the last assistant message as the response
  const assistantMessage = run.messages.findLast(
    (m) => m.role === "assistant" || m.role === "fixed_response"
  );
  if (!assistantMessage?.content) return null;

  return (
    <MarkdownResponseDisplay
      content={assistantMessage.content || ""}
      className="mt-6"
      footer={
        <div className="flex justify-between items-center">
          <div className="flex space-x-3">
            <button
              type="button"
              onClick={() => handleCopy(assistantMessage.content)}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              title={copied ? "Copied!" : "Copy to clipboard"}
            >
              {copied ? <FaCopy /> : <FaRegCopy />}
            </button>
            <button
              type="button"
              onClick={handleLike}
              className={`${
                liked ? "text-green-500" : "text-gray-500 hover:text-gray-700"
              }`}
              title="Like"
            >
              <FaThumbsUp />
            </button>
            <button
              type="button"
              onClick={handleDislike}
              className={`${
                disliked ? "text-red-500" : "text-gray-500 hover:text-gray-700"
              }`}
              title="Dislike"
            >
              <FaThumbsDown />
            </button>
          </div>
          {(isOwner || isAdmin) && (
            <span className="text-xs text-gray-400">
              Credits Used:{" "}
              {typeof run.credits === "string"
                ? Number(run.credits).toFixed(0)
                : run.credits?.toFixed(0) || "0"}
            </span>
          )}
        </div>
      }
    />
  );
};

const BAR_TRANSITION = "width 900ms cubic-bezier(0.22, 1, 0.36, 1)";
const ROW_ENTRANCE_MS = 420;

function ScoreCriterionRow({
  criterion,
  entranceDelayMs,
}: {
  criterion: ScoreCriterion;
  entranceDelayMs: number;
}) {
  const { name, score, max, rationale } = criterion;
  const targetPct =
    max > 0 ? Math.max(0, Math.min(100, (score / max) * 100)) : 0;
  const barColor = getScoreColorByPct(targetPct);
  const [visible, setVisible] = useState(false);
  const [barPct, setBarPct] = useState(0);
  const hasEnteredRef = useRef(false);

  useEffect(() => {
    if (hasEnteredRef.current) {
      setBarPct(targetPct);
      return;
    }

    let showTimer: number | undefined;
    let barTimer: number | undefined;
    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (prefersReduced) {
      hasEnteredRef.current = true;
      setVisible(true);
      setBarPct(targetPct);
      return;
    }

    showTimer = window.setTimeout(() => {
      hasEnteredRef.current = true;
      setVisible(true);
    }, entranceDelayMs);
    barTimer = window.setTimeout(
      () => setBarPct(targetPct),
      entranceDelayMs + 80
    );

    return () => {
      if (showTimer) window.clearTimeout(showTimer);
      if (barTimer) window.clearTimeout(barTimer);
    };
  }, [entranceDelayMs, targetPct]);

  return (
    <div
      className="border border-[#ebedf2] px-5 py-4 space-y-3 transition-all duration-500 ease-out"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(8px)",
      }}
    >
      <div className="flex items-center gap-5">
        <div className="text-base leading-5 font-semibold w-[120px] truncate">
          {name}
        </div>
        <div className="flex-1 h-[10px] bg-[#ebedf2] overflow-hidden rounded-sm">
          <div
            className="h-full rounded-sm"
            style={{
              width: `${barPct}%`,
              backgroundColor: barColor,
              transition: BAR_TRANSITION,
            }}
          />
        </div>
        <div className="w-[56px] text-right tabular-nums">
          <span
            className="text-[20px] leading-6 font-bold"
            style={{ color: barColor }}
          >
            {score}
          </span>
          <span className="text-sm leading-[18px] font-semibold text-[#878c98]">
            /{max}
          </span>
        </div>
      </div>
      <p className="text-sm leading-[18px] text-gray-700 min-h-[18px]">
        {rationale?.trim() ? rationale : criterionHint(name, score, max)}
      </p>
    </div>
  );
}

function ScoreCriterionSkeletonRow({ label }: { label: string }) {
  return (
    <div
      className="border border-[#ebedf2] px-5 py-4 space-y-3"
      aria-hidden
    >
      <div className="flex items-center gap-5 animate-pulse">
        <div className="text-base leading-5 font-semibold w-[120px] truncate text-gray-400">
          {label}
        </div>
        <div className="flex-1 h-[10px] bg-[#ebedf2] rounded-sm overflow-hidden">
          <div className="h-full w-1/3 bg-[#dfe1e8] rounded-sm" />
        </div>
        <div className="w-[56px] h-6 bg-[#ebedf2] rounded" />
      </div>
      <div className="h-4 bg-[#f4f5f7] rounded w-4/5 animate-pulse" />
    </div>
  );
}

export const RunScoreDisplay: React.FC<RunScoreDisplayProps> = ({
  run,
  isEvaluating = false,
  explanationContent,
}) => {
  const breakdown = useMemo(() => buildScoreBreakdown(run), [run]);
  const hasBreakdown = Boolean(breakdown?.criteria.length);
  const rubricNames = useMemo(
    () => getRubricCriteriaNames(run?.scoreData?.rubric),
    [run?.scoreData?.rubric]
  );
  const overallRationale = extractOverallRationale(run);
  const showOverallFeedback = shouldShowOverallFeedback(run);
  const isScoreStreaming = Boolean(run?.scoreData?.partial);
  const showOverallTotal =
    Boolean(breakdown) && (!isScoreStreaming || breakdown!.total > 0);
  const scoreSectionRef = useRef<HTMLDivElement | null>(null);
  const hasScrolledRef = useRef(false);

  useLayoutEffect(() => {
    hasScrolledRef.current = false;
  }, [run?.id]);

  useEffect(() => {
    if (!hasBreakdown || hasScrolledRef.current) return;
    if (!scoreSectionRef.current) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    hasScrolledRef.current = true;
    const stopScroll = smoothScrollToElement(scoreSectionRef.current, 900);
    return () => {
      if (stopScroll) stopScroll();
    };
  }, [hasBreakdown, run?.id]);

  if (!run) return null;

  const criteriaByName = useMemo(() => {
    const map = new Map<string, ScoreCriterion>();
    breakdown?.criteria.forEach((c) => map.set(c.name, c));
    return map;
  }, [breakdown]);

  const isLoadingScores = isEvaluating || isScoreStreaming;
  const slotNames =
    rubricNames.length > 0
      ? rubricNames
      : breakdown?.criteria.map((c) => c.name) ?? [];

  if (!isLoadingScores && !hasBreakdown) return null;

  return (
    <div ref={scoreSectionRef} className="mt-6 bg-white space-y-5">
      <h3 className="text-[18px] leading-5 font-semibold">Score</h3>
      <p className="text-sm leading-[18px] text-gray-600">
        {isLoadingScores && !hasBreakdown
          ? "Evaluating your response…"
          : "Based on your score, let\u2019s break down the feedback."}
      </p>

      <div className="space-y-3">
        {slotNames.length === 0 && isLoadingScores ? (
          <>
            <ScoreCriterionSkeletonRow label="Evaluating…" />
            <ScoreCriterionSkeletonRow label="Evaluating…" />
          </>
        ) : (
          slotNames.map((name, idx) => {
            const criterion = criteriaByName.get(name);
            if (criterion) {
              return (
                <ScoreCriterionRow
                  key={name}
                  criterion={criterion}
                  entranceDelayMs={Math.min(idx * ROW_ENTRANCE_MS, 840)}
                />
              );
            }
            if (isLoadingScores) {
              return <ScoreCriterionSkeletonRow key={name} label={name} />;
            }
            return null;
          })
        )}
      </div>

      {showOverallTotal && breakdown ? (
      <div className="bg-[#fafafb] p-5 space-y-4">
        <h4 className="text-center text-lg font-semibold text-primary">
          Overall Score: {breakdown.total}/{breakdown.totalMax} points
        </h4>
        {showOverallFeedback && overallRationale ? (
          <div className="bg-[rgba(225,227,255,0.5)] border border-primary p-5">
            <div className={proseClasses}>
              <ReactMarkdownWrapper>{overallRationale}</ReactMarkdownWrapper>
            </div>
          </div>
        ) : explanationContent ? (
          <div className="bg-[rgba(225,227,255,0.5)] border border-primary p-5">
            <div className={proseClasses}>
              <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkBreaks, remarkMath]}
                rehypePlugins={[rehypeKatex]}
                components={{
                  code: CodeBlock,
                  table: TableWrapper,
                }}
              >
                {explanationContent}
              </ReactMarkdown>
            </div>
          </div>
        ) : null}
      </div>
      ) : null}
    </div>
  );
};

export const getRunScore = (run: Run | null): string | null => {
  return run?.run_score || null;
};

export const hasNoSubmission = (run: Run | null): boolean => {
  return run?.no_submission === true;
};

export const passedTheRubricMinScore = (run: Run | null): boolean => {
  if (!run) return true;
  return run.run_passed !== false;
};
