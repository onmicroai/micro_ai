import React, { useState, useEffect, useMemo, useRef } from "react";
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

type ScoreBreakdown = {
  criteria: Array<{ name: string; score: number; max: number }>;
  total: number;
  totalMax: number;
};

function getScrollParent(el: HTMLElement): HTMLElement | Window {
  let node: HTMLElement | null = el.parentElement;
  while (node) {
    const style = window.getComputedStyle(node);
    const overflowY = style.overflowY;
    const scrollable =
      (overflowY === "auto" || overflowY === "scroll") &&
      node.scrollHeight > node.clientHeight;
    if (scrollable) return node;
    node = node.parentElement;
  }
  return window;
}

function smoothScrollToElement(el: HTMLElement, durationMs = 850): () => void {
  const container = getScrollParent(el);
  const startY =
    container === window
      ? window.scrollY
      : (container as HTMLElement).scrollTop;
  const targetY =
    container === window
      ? Math.max(0, window.scrollY + el.getBoundingClientRect().top - 16)
      : Math.max(
          0,
          (container as HTMLElement).scrollTop +
            (el.getBoundingClientRect().top -
              (container as HTMLElement).getBoundingClientRect().top) -
            16
        );
  const distance = targetY - startY;
  let rafId = 0;
  const start = performance.now();

  const easeInOutCubic = (t: number) =>
    t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

  const step = (now: number) => {
    const elapsed = now - start;
    const p = Math.min(1, elapsed / durationMs);
    const y = startY + distance * easeInOutCubic(p);
    if (container === window) {
      window.scrollTo(0, y);
    } else {
      (container as HTMLElement).scrollTop = y;
    }
    if (p < 1) {
      rafId = window.requestAnimationFrame(step);
    }
  };

  rafId = window.requestAnimationFrame(step);
  return () => window.cancelAnimationFrame(rafId);
}

const SCORE_BAR_COLORS = {
  red: "#DF3F46",
  yellow: "#E3A135",
  green: "#249953",
};

function getScoreColorByPct(pct: number): string {
  if (pct <= 25) return SCORE_BAR_COLORS.red;
  if (pct < 75) return SCORE_BAR_COLORS.yellow;
  return SCORE_BAR_COLORS.green;
}

function extractJsonObject(text: string): Record<string, unknown> | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  try {
    const direct = JSON.parse(trimmed);
    if (direct && typeof direct === "object" && !Array.isArray(direct)) {
      return direct as Record<string, unknown>;
    }
  } catch {}

  const fenceRe = /```(?:json)?\s*([\s\S]*?)\s*```/gi;
  let m: RegExpExecArray | null;
  while ((m = fenceRe.exec(trimmed)) !== null) {
    try {
      const parsed = JSON.parse(m[1].trim());
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {}
  }

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    try {
      const parsed = JSON.parse(trimmed.slice(firstBrace, lastBrace + 1));
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {}
  }
  return null;
}

function toNum(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const n = parseFloat(value.trim());
    return Number.isNaN(n) ? null : n;
  }
  return null;
}

function parseRubricMaxMap(rubric?: string): Record<string, number> {
  if (!rubric) return {};
  const out: Record<string, number> = {};

  try {
    const parsed = JSON.parse(rubric) as unknown;
    if (Array.isArray(parsed)) {
      parsed.forEach((item) => {
        if (!item || typeof item !== "object") return;
        const criteria = (item as { criteria?: unknown }).criteria;
        const lines = (item as { lines?: unknown }).lines;
        if (typeof criteria !== "string" || !Array.isArray(lines)) return;

        let max = 0;
        lines.forEach((line) => {
          if (!line || typeof line !== "object") return;
          const s = toNum((line as { score?: unknown }).score);
          if (s !== null && s > max) max = s;
        });
        if (max > 0) out[criteria] = max;
      });
      if (Object.keys(out).length > 0) return out;
    }
  } catch {}

  const json = extractJsonObject(rubric);

  if (json) {
    Object.entries(json).forEach(([k, v]) => {
      const n = toNum(v);
      if (n !== null && n > 0) out[k] = n;
    });
  }
  return out;
}

function buildScoreBreakdown(run: Run | null): ScoreBreakdown | null {
  if (!run?.run_score) return null;
  const scoreObj = extractJsonObject(run.run_score);
  if (!scoreObj) return null;

  const rubricMax = parseRubricMaxMap(run.scoreData?.rubric);
  const criteria: Array<{ name: string; score: number; max: number }> = [];
  let totalFromPayload: number | null = null;

  Object.entries(scoreObj).forEach(([key, value]) => {
    const n = toNum(value);
    if (n === null) return;
    if (key.toLowerCase() === "total") {
      totalFromPayload = n;
      return;
    }
    const max = rubricMax[key];
    criteria.push({ name: key, score: n, max });
  });

  if (!criteria.length && totalFromPayload === null) return null;

  const summed = criteria.reduce((acc, c) => acc + c.score, 0);
  const total = totalFromPayload ?? summed;
  const maxFromCriteria = criteria.reduce((acc, c) => acc + c.max, 0);
  const totalMax =
    maxFromCriteria > 0
      ? maxFromCriteria
      : Math.max(total, run.scoreData?.minimum_score || 0, 1);

  return { criteria, total, totalMax };
}

function criterionHint(name: string, score: number, max: number): string {
  const pct = max > 0 ? (score / max) * 100 : 0;
  if (pct <= 25) {
    return `Low score for ${name}. Focus on improving this area with clearer and more relevant points.`;
  }
  if (pct < 75) {
    return `Decent ${name} score, but there is room to improve with stronger detail and structure.`;
  }
  return `Great ${name} performance. Keep using this level of quality in your response.`;
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
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkBreaks, remarkMath]}
          rehypePlugins={[rehypeKatex]}
          components={{
            code: CodeBlock,
            table: TableWrapper,
          }}
        >
          {content}
        </ReactMarkdown>
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

export const RunScoreDisplay: React.FC<RunScoreDisplayProps> = ({
  run,
  isEvaluating = false,
  explanationContent,
}) => {
  const [animateBars, setAnimateBars] = useState(false);
  const breakdown = useMemo(() => buildScoreBreakdown(run), [run]);
  const scoreSectionRef = useRef<HTMLDivElement | null>(null);
  const lastAnimatedKeyRef = useRef<string>("");

  useEffect(() => {
    if (!run || !breakdown || isEvaluating) return;
    const key = `${run.id}:${run.run_score ?? ""}`;

    setAnimateBars(false);
    let cancelled = false;
    let stopScroll: (() => void) | undefined;
    let startBarsTimeout: number | undefined;

    const kickOffBars = () => {
      if (cancelled) return;
      // Two RAFs ensure we animate from width=0 after layout/paint.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (!cancelled) setAnimateBars(true);
        });
      });
    };

    const shouldAnimateScroll = !window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    const isNewScore = lastAnimatedKeyRef.current !== key;
    lastAnimatedKeyRef.current = key;

    if (scoreSectionRef.current && shouldAnimateScroll) {
      // Native smooth scroll first (works for many nested scroll containers)
      scoreSectionRef.current.scrollIntoView({
        behavior: "smooth",
        block: "start",
        inline: "nearest",
      });
      // Custom eased scroll as fallback/augment for container scrolling.
      stopScroll = smoothScrollToElement(scoreSectionRef.current, 1100);
      startBarsTimeout = window.setTimeout(kickOffBars, isNewScore ? 650 : 300);
      return () => {
        cancelled = true;
        if (stopScroll) stopScroll();
        if (startBarsTimeout) window.clearTimeout(startBarsTimeout);
      };
    }

    kickOffBars();
    return () => {
      cancelled = true;
    };
  }, [run, breakdown, isEvaluating]);

  if (!run) return null;
  if (isEvaluating) {
    return (
      <div className="mt-3 flex justify-end text-sm text-gray-500">
        Evaluating…
      </div>
    );
  }
  if (!run?.run_score || !breakdown) return null;

  return (
    <div ref={scoreSectionRef} className="mt-6 bg-white space-y-5">
      <h3 className="text-[18px] leading-5 font-semibold">Score</h3>
      <p className="text-sm leading-[18px] text-gray-600">
        Based on your score, let&apos;s break down the feedback.
      </p>

      {breakdown.criteria.map((c) => {
        const pct =
          c.max > 0 ? Math.max(0, Math.min(100, (c.score / c.max) * 100)) : 0;
        const barColor = getScoreColorByPct(pct);
        return (
          <div
            key={c.name}
            className="border border-[#ebedf2] px-5 py-4 space-y-3"
          >
            <div className="flex items-center gap-5">
              <div className="text-base leading-5 font-semibold w-[120px] truncate">
                {c.name}
              </div>
              <div className="flex-1 h-[10px] bg-[#ebedf2] overflow-hidden">
                <div
                  className="h-full"
                  style={{
                    width: animateBars ? `${pct}%` : "0%",
                    backgroundColor: barColor,
                    transition: "width 900ms cubic-bezier(0.22, 1, 0.36, 1)",
                  }}
                />
              </div>
              <div className="w-[56px] text-right">
                <span
                  className="text-[20px] leading-6 font-bold"
                  style={{ color: barColor }}
                >
                  {c.score}
                </span>
                <span className="text-sm leading-[18px] font-semibold text-[#878c98]">
                  /{c.max}
                </span>
              </div>
            </div>
            <p className="text-sm leading-[18px] text-gray-700">
              {criterionHint(c.name, c.score, c.max)}
            </p>
          </div>
        );
      })}

      <div className="bg-[#fafafb] p-5 space-y-4">
        <h4 className="text-center text-lg font-semibold text-primary">
          Overall Score: {breakdown.total}/{breakdown.totalMax} points
        </h4>
        {explanationContent ? (
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
