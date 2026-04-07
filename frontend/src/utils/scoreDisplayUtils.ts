import type { Run } from "@/store/conversationStore";
import { extractJsonObject, toNum } from "@/utils/jsonUtils";
import { smoothScrollToElement } from "@/utils/scrollUtils";

export type ScoreBreakdown = {
  criteria: Array<{ name: string; score: number; max: number }>;
  total: number;
  totalMax: number;
};

const SCORE_BAR_COLORS = {
  red: "#DF3F46",
  yellow: "#E3A135",
  green: "#249953",
};

export { smoothScrollToElement };

export function getScoreColorByPct(pct: number): string {
  if (pct <= 25) return SCORE_BAR_COLORS.red;
  if (pct < 75) return SCORE_BAR_COLORS.yellow;
  return SCORE_BAR_COLORS.green;
}

export { extractJsonObject, toNum };

export function parseRubricMaxMap(rubric?: string): Record<string, number> {
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

export function buildScoreBreakdown(run: Run | null): ScoreBreakdown | null {
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

export function criterionHint(
  name: string,
  score: number,
  max: number
): string {
  const pct = max > 0 ? (score / max) * 100 : 0;
  if (pct <= 25) {
    return `Low score for ${name}. Focus on improving this area with clearer and more relevant points.`;
  }
  if (pct < 75) {
    return `Decent ${name} score, but there is room to improve with stronger detail and structure.`;
  }
  return `Great ${name} performance. Keep using this level of quality in your response.`;
}
