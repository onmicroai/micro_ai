/**
 * Extract rubric total from Run.run_score (API may return raw LLM prose + fenced JSON).
 */

function coerceTotal(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const n = parseFloat(value.trim());
    return Number.isNaN(n) ? null : n;
  }
  return null;
}

export function parseRunScoreTotal(runScore: unknown): number | null {
  if (runScore == null) return null;
  if (typeof runScore === "number" && Number.isFinite(runScore)) return runScore;
  if (typeof runScore === "string") {
    const text = runScore.trim();
    if (!text) return null;
    const fenceRe = /```(?:json)?\s*([\s\S]*?)\s*```/gi;
    let m: RegExpExecArray | null;
    while ((m = fenceRe.exec(text)) !== null) {
      try {
        const obj = JSON.parse(m[1].trim()) as unknown;
        if (obj && typeof obj === "object" && "total" in obj) {
          const v = coerceTotal((obj as { total: unknown }).total);
          if (v !== null) return v;
        }
      } catch {
        /* next fence */
      }
    }
    const jsonTotal = text.match(/"total"\s*:\s*"?([\d.]+)"?/i);
    if (jsonTotal) {
      const v = parseFloat(jsonTotal[1]);
      if (!Number.isNaN(v)) return v;
    }
    const proseTotal = text.match(/\btotal\s*:\s*([\d.]+)\b/i);
    if (proseTotal) {
      const v = parseFloat(proseTotal[1]);
      if (!Number.isNaN(v)) return v;
    }
    return null;
  }
  if (typeof runScore === "object" && runScore !== null && "total" in runScore) {
    return coerceTotal((runScore as { total: unknown }).total);
  }
  return null;
}

export function formatScoreGateTotal(
  scoreTotal: number | null | undefined,
  runScore: unknown
): string {
  const n =
    typeof scoreTotal === "number" && Number.isFinite(scoreTotal)
      ? scoreTotal
      : parseRunScoreTotal(runScore);
  if (n === null) return "-";
  if (Number.isInteger(n)) return String(Math.trunc(n));
  return String(n);
}
