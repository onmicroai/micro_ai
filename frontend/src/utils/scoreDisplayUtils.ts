import type { Run } from "@/store/conversationStore";
import { extractJsonObject, toNum } from "@/utils/jsonUtils";
import { smoothScrollToElement } from "@/utils/scrollUtils";

export type ScoreCriterion = {
  name: string;
  score: number;
  max: number;
  rationale?: string;
};

export type ScoreBreakdown = {
  criteria: ScoreCriterion[];
  total: number;
  totalMax: number;
};

const RESERVED_SCORE_KEYS = new Set([
  "total",
  "overall_rationale",
  "score",
  "rationale",
]);

export function getRubricCriteriaNames(rubric?: string): string[] {
  if (!rubric) return [];
  try {
    const parsed = JSON.parse(rubric) as unknown;
    if (Array.isArray(parsed)) {
      const names: string[] = [];
      parsed.forEach((item) => {
        if (!item || typeof item !== "object") return;
        const criteria = (item as { criteria?: unknown }).criteria;
        if (typeof criteria === "string" && criteria.trim()) {
          names.push(criteria.trim());
        }
      });
      if (names.length > 0) return names;
    }
  } catch {}
  return Object.keys(parseRubricMaxMap(rubric));
}

function criterionScoreAndRationale(value: unknown): {
  score: number | null;
  rationale?: string;
} {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;
    const score = toNum(obj.score);
    const rationale =
      typeof obj.rationale === "string" ? obj.rationale : undefined;
    return { score, rationale };
  }
  return { score: toNum(value) };
}

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
  const raw = run.run_score;
  const scoreObj =
    typeof raw === "object" && raw !== null && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : extractJsonObject(String(raw));
  if (!scoreObj) return null;

  const rubric = run.scoreData?.rubric;
  const rubricMax = parseRubricMaxMap(rubric);
  const rubricOrder = getRubricCriteriaNames(rubric);
  const criteria: ScoreCriterion[] = [];
  let totalFromPayload: number | null = null;

  const totalValue = scoreObj.total;
  const totalNum = toNum(totalValue);
  if (totalNum !== null) totalFromPayload = totalNum;

  const addCriterion = (key: string, value: unknown) => {
    if (RESERVED_SCORE_KEYS.has(key.toLowerCase())) return;
    const { score, rationale } = criterionScoreAndRationale(value);
    if (score === null) return;
    const max = rubricMax[key] ?? 0;
    criteria.push({ name: key, score, max, rationale });
  };

  if (rubricOrder.length > 0) {
    rubricOrder.forEach((name) => {
      if (!(name in scoreObj)) return;
      addCriterion(name, scoreObj[name]);
    });
  } else {
    Object.entries(scoreObj).forEach(([key, value]) => {
      if (RESERVED_SCORE_KEYS.has(key.toLowerCase())) return;
      addCriterion(key, value);
    });
  }

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

export function extractOverallRationale(run: Run | null): string | null {
  if (!run?.run_score) return null;
  const raw = run.run_score;
  const scoreObj =
    typeof raw === "object" && raw !== null && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : extractJsonObject(String(raw));
  if (!scoreObj) return null;
  const overall = scoreObj.overall_rationale;
  return typeof overall === "string" && overall.trim() ? overall : null;
}

export function shouldShowOverallFeedback(run: Run | null): boolean {
  if (!run) return false;
  const enabled =
    run.score_feedback_enabled ?? run.scoreData?.score_feedback_enabled ?? false;
  return enabled && Boolean(extractOverallRationale(run)?.trim());
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
