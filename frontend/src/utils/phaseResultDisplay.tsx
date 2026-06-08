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
  parseRubricMaxMap,
  ScoreCriterion,
  shouldShowOverallFeedback,
  smoothScrollToElement,
} from "@/utils/scoreDisplayUtils";
import ReactMarkdownWrapper from "@/components/basic/ReactMarkdownWrapper";
import { cn } from "@/utils/cn";

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
      className={cn(
        "rounded-sm border border-gray-200/80 bg-gradient-to-b from-white to-gray-50/50 p-6 shadow-sm backdrop-blur-sm",
        className,
      )}
    >
      <div className={proseClasses}>
        <ReactMarkdownWrapper>{content}</ReactMarkdownWrapper>
      </div>
      {footer ? (
        <div className="mt-4 border-t border-gray-100 pt-4">{footer}</div>
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

    updateRunUtil(
      run.id,
      {
        satisfaction: newLiked ? 1 : null,
      },
      user?.id || null,
    );
  };

  const handleDislike = () => {
    if (!run.id) return;
    const newDisliked = !disliked;
    setDisliked(newDisliked);
    setLiked(false);

    updateRunUtil(
      run.id,
      {
        satisfaction: newDisliked ? -1 : null,
      },
      user?.id || null,
    );
  };

  const assistantMessage = run.messages.findLast(
    (m) => m.role === "assistant" || m.role === "fixed_response",
  );
  if (!assistantMessage?.content) return null;

  return (
    <MarkdownResponseDisplay
      content={assistantMessage.content || ""}
      className="mt-6"
      footer={
        <div className="flex items-center justify-between">
          <div className="flex space-x-3">
            <button
              type="button"
              onClick={() => handleCopy(assistantMessage.content)}
              className="text-gray-400 transition-colors hover:text-gray-600"
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
            <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
              Credits:{" "}
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

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function ScoreCriterionSlot({
  name,
  criterion,
  isLoading,
  isStreaming,
  entranceDelayMs,
  knownMax,
}: {
  name: string;
  criterion?: ScoreCriterion;
  isLoading: boolean;
  isStreaming: boolean;
  entranceDelayMs: number;
  knownMax?: number;
}) {
  const startedAsLoadingRef = useRef(isLoading);
  const hasScoreAnimatedRef = useRef(false);
  const hadRationaleRef = useRef(false);

  const score = criterion?.score ?? null;
  const max = criterion?.max ?? knownMax ?? 0;
  const rationale = criterion?.rationale;
  const hasScore = score !== null;
  const isWaitingForScore = isLoading && !hasScore;

  const targetPct =
    hasScore && max > 0
      ? Math.max(0, Math.min(100, (score / max) * 100))
      : 0;
  const barColor = hasScore ? getScoreColorByPct(targetPct) : "#dfe1e8";

  const [rowVisible, setRowVisible] = useState(
    () => startedAsLoadingRef.current || isStreaming,
  );
  const [barPct, setBarPct] = useState(0);
  const [scoreVisible, setScoreVisible] = useState(false);
  const [rationaleVisible, setRationaleVisible] = useState(false);

  const rationaleText =
    rationale?.trim() ||
    (hasScore && !isWaitingForScore && !isStreaming
      ? criterionHint(name, score!, max)
      : null);

  const isWaitingForRationale =
    hasScore && !rationale?.trim() && (isStreaming || isWaitingForScore);

  // Row entrance for batch reveal (non-streaming, not started as skeleton)
  useEffect(() => {
    if (startedAsLoadingRef.current || isStreaming) {
      setRowVisible(true);
      return;
    }

    if (prefersReducedMotion()) {
      setRowVisible(true);
      return;
    }

    const timer = window.setTimeout(() => setRowVisible(true), entranceDelayMs);
    return () => window.clearTimeout(timer);
  }, [entranceDelayMs, isStreaming]);

  // Bar and score animation
  useEffect(() => {
    if (!hasScore) return;

    if (prefersReducedMotion()) {
      hasScoreAnimatedRef.current = true;
      setBarPct(targetPct);
      setScoreVisible(true);
      return;
    }

    if (hasScoreAnimatedRef.current) {
      setBarPct(targetPct);
      setScoreVisible(true);
      return;
    }

    const delay =
      startedAsLoadingRef.current || isStreaming ? 0 : entranceDelayMs + 80;

    const timer = window.setTimeout(() => {
      hasScoreAnimatedRef.current = true;
      setBarPct(targetPct);
      setScoreVisible(true);
    }, delay);

    return () => window.clearTimeout(timer);
  }, [hasScore, targetPct, entranceDelayMs, isStreaming]);

  // Rationale crossfade
  useEffect(() => {
    if (isWaitingForScore || isWaitingForRationale) {
      if (!rationale?.trim()) {
        setRationaleVisible(false);
      }
      return;
    }

    const hasRationaleText = Boolean(rationaleText);
    if (!hasRationaleText) return;

    if (rationale?.trim() && !hadRationaleRef.current) {
      hadRationaleRef.current = true;
    }

    if (prefersReducedMotion()) {
      setRationaleVisible(true);
      return;
    }

    const frame = window.requestAnimationFrame(() => setRationaleVisible(true));
    return () => window.cancelAnimationFrame(frame);
  }, [rationale, rationaleText, isWaitingForScore, isWaitingForRationale]);

  return (
    <div
      className={cn(
        "space-y-3 rounded-lg border border-gray-200 px-5 py-4 ring-1 ring-black/[0.04] transition-all duration-500 ease-out",
        rowVisible ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0",
      )}
    >
      <h4 className="text-sm font-semibold leading-snug text-gray-900">{name}</h4>

      <div className="flex items-center gap-4">
        <div
          className={cn(
            "h-[10px] flex-1 overflow-hidden rounded-sm bg-gray-100",
            isWaitingForScore && "animate-pulse",
          )}
        >
          <div
            className="h-full rounded-sm"
            style={{
              width: hasScore ? `${barPct}%` : "0%",
              backgroundColor: barColor,
              transition: BAR_TRANSITION,
            }}
          />
        </div>

        <div className="w-14 shrink-0 text-right tabular-nums">
          {hasScore ? (
            <span
              className="transition-opacity duration-300"
              style={{ opacity: scoreVisible ? 1 : 0 }}
            >
              <span
                className="text-xl font-bold leading-6"
                style={{ color: barColor }}
              >
                {score}
              </span>
              <span className="text-sm font-semibold leading-[18px] text-gray-500">
                /{max}
              </span>
            </span>
          ) : (
            <span
              className="inline-block h-6 w-12 animate-pulse rounded bg-gray-100"
              aria-hidden
            />
          )}
        </div>
      </div>

      <div className="min-h-[18px]">
        {isWaitingForScore || isWaitingForRationale ? (
          <div
            className="h-4 w-4/5 animate-pulse rounded bg-gray-100"
            aria-hidden
          />
        ) : (
          <p
            className={cn(
              "text-sm leading-[18px] text-gray-700 transition-opacity duration-300",
              rationaleVisible ? "opacity-100" : "opacity-0",
            )}
          >
            {rationaleText}
          </p>
        )}
      </div>
    </div>
  );
}

function getScoreSubtitle(
  isLoadingScores: boolean,
  hasBreakdown: boolean,
  isScoreStreaming: boolean,
): string {
  if (isLoadingScores && !hasBreakdown) {
    return "Evaluating your response…";
  }
  if (isScoreStreaming || (isLoadingScores && hasBreakdown)) {
    return "Scoring in progress…";
  }
  return "Based on your score, let\u2019s break down the feedback.";
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
    [run?.scoreData?.rubric],
  );
  const rubricMaxMap = useMemo(
    () => parseRubricMaxMap(run?.scoreData?.rubric),
    [run?.scoreData?.rubric],
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
    if (prefersReducedMotion()) return;

    hasScrolledRef.current = true;
    const stopScroll = smoothScrollToElement(scoreSectionRef.current, 900);
    return () => {
      if (stopScroll) stopScroll();
    };
  }, [hasBreakdown, run?.id]);

  const criteriaByName = useMemo(() => {
    const map = new Map<string, ScoreCriterion>();
    breakdown?.criteria.forEach((c) => map.set(c.name, c));
    return map;
  }, [breakdown]);

  if (!run) return null;

  const isLoadingScores = isEvaluating || isScoreStreaming;
  const slotNames =
    rubricNames.length > 0
      ? rubricNames
      : (breakdown?.criteria.map((c) => c.name) ?? []);

  if (!isLoadingScores && !hasBreakdown) return null;

  const feedbackPanelClass =
    "rounded-lg border border-primary/20 bg-primary/10 p-5";

  return (
    <div ref={scoreSectionRef} className="mt-6 space-y-5 bg-white">
      <h3 className="text-lg font-semibold leading-5">Score</h3>
      <p className="text-sm leading-[18px] text-gray-600">
        {getScoreSubtitle(isLoadingScores, hasBreakdown, isScoreStreaming)}
      </p>

      <div className="space-y-3">
        {slotNames.length === 0 && isLoadingScores ? (
          <>
            <ScoreCriterionSlot
              name="Evaluating…"
              isLoading
              isStreaming={isScoreStreaming}
              entranceDelayMs={0}
            />
            <ScoreCriterionSlot
              name="Evaluating…"
              isLoading
              isStreaming={isScoreStreaming}
              entranceDelayMs={0}
            />
          </>
        ) : (
          slotNames.map((name, idx) => {
            const criterion = criteriaByName.get(name);
            const stillLoading = isLoadingScores && !criterion;

            if (!criterion && !stillLoading) return null;

            return (
              <ScoreCriterionSlot
                key={name}
                name={name}
                criterion={criterion}
                isLoading={stillLoading}
                isStreaming={isScoreStreaming}
                entranceDelayMs={
                  isScoreStreaming
                    ? 0
                    : Math.min(idx * ROW_ENTRANCE_MS, 840)
                }
                knownMax={rubricMaxMap[name]}
              />
            );
          })
        )}
      </div>

      {showOverallTotal && breakdown ? (
        <div className="space-y-4 rounded-lg bg-gray-50 p-5">
          <h4 className="text-center text-lg font-semibold text-primary">
            Overall Score: {breakdown.total}/{breakdown.totalMax} points
          </h4>
          {showOverallFeedback && overallRationale ? (
            <div className={feedbackPanelClass}>
              <div className={proseClasses}>
                <ReactMarkdownWrapper>{overallRationale}</ReactMarkdownWrapper>
              </div>
            </div>
          ) : explanationContent ? (
            <div className={feedbackPanelClass}>
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
