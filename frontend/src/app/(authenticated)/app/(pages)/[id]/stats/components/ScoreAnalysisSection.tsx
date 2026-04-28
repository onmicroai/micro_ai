"use client";

import { useCallback, useEffect, useState } from "react";
import { BarChart3, Info } from "lucide-react";
import axiosInstance from "@/utils/axiosInstance";
import SkeletonLoader from "@/components/layout/loading/skeletonLoader";
import {
  Badge,
  type BadgeVariant,
} from "../../../edit/[id]/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/(authenticated)/app/(pages)/edit/[id]/components/ui/select";

type VersionOption = {
  id: number;
  version_number: number;
  label: string;
  scored_run_count: number;
};

type CategoryRow = {
  name: string;
  attempts: number;
  possible_points: number;
  perfect_score_percent: number;
  average_score: number;
  median_score: number;
  difficulty: string;
  insight: string;
};

type GateBlock = {
  gate_name: string;
  attempts: number;
  possible_points: number;
  perfect_score_percent: number;
  average_score: number;
  median_score: number;
  difficulty: string;
  categories: CategoryRow[];
};

type ScoreAnalysisProps = {
  hashId: string;
  canLoad: boolean;
};

const COLS = [
  "GATE / CATEGORY",
  "ATTEMPTS",
  "POSSIBLE POINTS",
  "PERFECT SCORE %",
  "AVERAGE SCORE",
  "MEDIAN SCORE",
  "DIFFICULTY",
  "WHY STUDENTS GET POINTS OFF",
] as const;

export function ScoreAnalysisSection({ hashId, canLoad }: ScoreAnalysisProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<{
    active_rubric_version_id: number | null;
    selected_rubric_version_id: number | null;
    versions: VersionOption[];
    live_rubric_matches_selected_version: boolean | null;
    analysis: {
      scored_runs: number;
      gates: GateBlock[];
    } | null;
  } | null>(null);
  const [versionId, setVersionId] = useState<string>("");

  const load = useCallback(
    async (v?: string) => {
      if (!canLoad) return;
      setLoading(true);
      setError(null);
      try {
        const q = v ? `&rubric_version_id=${encodeURIComponent(v)}` : "";
        const res = await axiosInstance().get(
          `/api/microapps/stats/score-analysis?hash_id=${encodeURIComponent(
            hashId
          )}${q}`
        );
        const d = res.data?.data;
        if (!d) {
          setData(null);
          return;
        }
        setData({
          active_rubric_version_id: d.active_rubric_version_id ?? null,
          selected_rubric_version_id: d.selected_rubric_version_id ?? null,
          versions: Array.isArray(d.versions) ? d.versions : [],
          live_rubric_matches_selected_version:
            typeof d.live_rubric_matches_selected_version === "boolean"
              ? d.live_rubric_matches_selected_version
              : null,
          analysis: d.analysis,
        });
        if (!v && d.selected_rubric_version_id) {
          setVersionId(String(d.selected_rubric_version_id));
        } else if (v) {
          setVersionId(v);
        } else if (d.versions?.length) {
          setVersionId(String(d.versions[d.versions.length - 1].id));
        }
      } catch (e: unknown) {
        setError("Could not load score analysis.");
        setData(null);
      } finally {
        setLoading(false);
      }
    },
    [canLoad, hashId]
  );

  useEffect(() => {
    if (!canLoad) {
      setLoading(false);
      return;
    }
    void load();
  }, [canLoad, load]);

  if (!canLoad) return null;

  if (loading) {
    return (
      <div className="bg-white p-4 space-y-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="text-primary" />
          <h6 className="text-md font-semibold">Score Analysis</h6>
        </div>
        <SkeletonLoader />
      </div>
    );
  }

  if (error) {
    return <div className="bg-white p-4 text-sm text-red-600">{error}</div>;
  }

  const analysis = data?.analysis;
  const showVersionPicker = (data?.versions?.length || 0) > 0;
  const showBuilderMismatch =
    data?.live_rubric_matches_selected_version === false;

  const mismatchTooltip =
    "The scoring gates saved in the app editor no longer match this rubric snapshot. " +
    "Tables and counts here reflect student runs recorded for this version only. " +
    "After learners complete real (non-preview) scored runs, the app will record a new version automatically and you can track updated stats there.";

  return (
    <div className="bg-white p-4 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="text-primary" />
          <h6 className="text-md font-semibold">Score Analysis</h6>
        </div>
        {showVersionPicker && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-600 shrink-0">Rubric version</span>
            <Select
              value={versionId || undefined}
              onValueChange={(v) => {
                setVersionId(v);
                void load(v);
              }}
            >
              <SelectTrigger className="h-9 w-full sm:w-[min(100%,20rem)] border-gray-200">
                <SelectValue placeholder="Select version" />
              </SelectTrigger>
              <SelectContent align="end">
                {data?.versions.map((v) => (
                  <SelectItem key={v.id} value={String(v.id)}>
                    {v.label}
                    {v.id === data?.active_rubric_version_id
                      ? " (active)"
                      : ""}{" "}
                    — {v.scored_run_count} run
                    {v.scored_run_count === 1 ? "" : "s"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {showBuilderMismatch ? (
        <div
          className="flex gap-2 rounded-md border border-amber-200 bg-amber-50/90 px-3 py-2.5 text-sm text-amber-950"
          role="status"
        >
          <Info
            className="h-4 w-4 shrink-0 mt-0.5 text-amber-700"
            aria-hidden
          />
          <p>
            <span className="font-medium">
              Editor differs from this version.
            </span>{" "}
            Stats below are for the selected rubric snapshot, not the scoring
            gates currently in your app.{" "}
            <span className="text-amber-900/90" title={mismatchTooltip}>
              New real scored runs will create the next version automatically.
            </span>
          </p>
        </div>
      ) : null}

      {!analysis || !analysis.gates?.length ? (
        <p className="text-sm text-gray-600">
          No scored runs yet for a rubric version, or the app has no scoring
          gates. Complete real (non-preview) runs with rubric scoring to see
          breakdowns.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-secondary-grey-100 text-xs text-gray-500 uppercase tracking-wider">
              <tr>
                {COLS.map((c) => (
                  <th
                    key={c}
                    className="px-6 py-3 text-left font-semibold whitespace-nowrap"
                  >
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {analysis.gates.map((gate) => (
                <FragmentRows key={gate.gate_name} gate={gate} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function difficultyBadgeVariant(difficulty: string): BadgeVariant {
  switch (difficulty.trim().toLowerCase()) {
    case "easy":
      return "success";
    case "moderate":
      return "warning";
    case "difficult":
      return "danger";
    default:
      return "neutral";
  }
}

function FragmentRows({ gate }: { gate: GateBlock }) {
  return (
    <>
      <tr className="bg-gray-50">
        <td className="px-6 py-4 text-sm font-semibold text-gray-900 whitespace-nowrap">
          Scoring Gate: {gate.gate_name}
        </td>
        <td className="px-6 py-4 text-sm text-gray-500 text-right tabular-nums whitespace-nowrap">
          {gate.attempts}
        </td>
        <td className="px-6 py-4 text-sm text-gray-500 text-right tabular-nums whitespace-nowrap">
          {gate.possible_points}
        </td>
        <td className="px-6 py-4 text-sm text-gray-500 text-right tabular-nums whitespace-nowrap">
          {gate.perfect_score_percent.toFixed(1)}%
        </td>
        <td className="px-6 py-4 text-sm text-gray-500 text-right tabular-nums whitespace-nowrap">
          {gate.average_score.toFixed(2)}
        </td>
        <td className="px-6 py-4 text-sm text-gray-500 text-right tabular-nums whitespace-nowrap">
          {gate.median_score.toFixed(2)}
        </td>
        <td className="px-6 py-4 text-sm text-gray-500 whitespace-nowrap">
          <Badge
            variant={difficultyBadgeVariant(gate.difficulty)}
            size="md"
            className="rounded-none"
          >
            {gate.difficulty}
          </Badge>
        </td>
        <td className="px-6 py-4 text-sm text-gray-500 whitespace-nowrap">—</td>
      </tr>
      {gate.categories.map((c) => (
        <tr
          key={c.name}
          className="transition-colors cursor-default text-sm text-gray-500"
        >
          <td className="px-6 py-4 pl-10 whitespace-nowrap">{c.name}</td>
          <td className="px-6 py-4 text-sm text-gray-500 text-right tabular-nums whitespace-nowrap">
            {c.attempts}
          </td>
          <td className="px-6 py-4 text-right tabular-nums whitespace-nowrap">
            {c.possible_points}
          </td>
          <td className="px-6 py-4 text-right tabular-nums whitespace-nowrap">
            {c.perfect_score_percent.toFixed(1)}%
          </td>
          <td className="px-6 py-4  text-right tabular-nums whitespace-nowrap">
            {c.average_score.toFixed(2)}
          </td>
          <td className="px-6 py-4  text-right tabular-nums whitespace-nowrap">
            {c.median_score.toFixed(2)}
          </td>
          <td className="px-6 py-4 whitespace-nowrap">
            <Badge
              variant={difficultyBadgeVariant(c.difficulty)}
              size="md"
              className="rounded-none"
            >
              {c.difficulty}
            </Badge>
          </td>
          <td className="px-6 py-4  max-w-md min-w-[12rem] whitespace-normal">
            {c.insight}
          </td>
        </tr>
      ))}
    </>
  );
}
