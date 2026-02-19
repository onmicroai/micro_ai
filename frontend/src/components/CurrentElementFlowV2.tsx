"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef } from "react";
import evaluateVisibility from "@/utils/evaluateVisibility";
import { validateForm } from "@/utils/validateForms";
import { useSurveyStore } from "@/store/runtimeSurveyStore";
import { useConversationStore } from "@/store/conversationStore";
import {
  FixedResponseRuntimeState,
  StopRuntimeState,
  useRuntimeTryStore,
} from "@/store/runtimeTryStore";
import RenderQuestion from "./RenderQuestion";
import RenderPrompt from "./RenderPrompt";
import injectValuesIntoPrompt from "@/utils/injectValuesIntoPrompt";
import type {
  Answers,
  Base64Images,
  ConditionalLogic,
  Element,
  Prompt,
  handleInputChange,
  setInputValue,
} from "@/app/(authenticated)/app/types";
import {
  AIResponseDisplay,
  MarkdownResponseDisplay,
  RunScoreDisplay,
  passedTheRubricMinScore,
} from "@/utils/phaseResultDisplay";
import SkeletonLoader from "@/components/layout/loading/skeletonLoader";
import { Check, ChevronLeft, ChevronRight, Pencil, X } from "lucide-react";

const STOP_TYPES = new Set<Element["type"]>(["aiResponse", "fixedResponse", "scoring"]);

function isStopElement(el: Element): boolean {
  return STOP_TYPES.has(el.type);
}

/** Element types that do not show the hover Edit button in retry flow (display-only or special UX). */
function isEditSupportedElementType(type: Element["type"]): boolean {
  return type !== "chat" && type !== "title" && type !== "richText";
}

/** Types where the hover Edit button is positioned above the control to avoid overlapping. */
function isEditButtonAboveType(type: Element["type"]): boolean {
  return type === "textarea" || type === "dropdown" || type === "text" || type === "slider";
}

type VisibleEntry = { element: Element; originalIndex: number };

type Props = {
  appId: number;
  userId: number | null;
  isOwner?: boolean;
  isAdmin?: boolean;
  onComplete?: () => void;
};

function serializeAnswer(
  prev: Answers,
  name: string,
  value: string | string[] | undefined,
  otherValue: string,
  type: string,
): Answers {
  const updatedValue: any = {};
  switch (type) {
    case "radiogroup":
    case "dropdown":
      if (value !== "") updatedValue.value = value;
      if (otherValue !== "") updatedValue.otherValue = otherValue;
      break;
    case "checkbox":
      if (Array.isArray(value)) updatedValue.value = value;
      if (otherValue !== "") updatedValue.otherValue = otherValue;
      break;
    case "imageUpload":
      if (Array.isArray(value)) updatedValue.value = value;
      else if (value) updatedValue.value = [value];
      break;
    default:
      updatedValue.value = value;
  }
  return {
    ...prev,
    [name]: updatedValue,
  };
}

export default function CurrentElementFlowV2({
  appId,
  userId,
  isOwner = false,
  isAdmin = false,
  onComplete,
}: Props) {
  const {
    surveyJson,
    answers: surveyAnswers,
    images: surveyImages,
    errors,
    promptLoading,
    setErrors,
    setElements,
    setImages: setSurveyImages,
    sendPrompts,
  } = useSurveyStore();
  const { getRunsForTry, getLatestRunForStop } = useConversationStore();
  const {
    tryOrder,
    triesById,
    activeTryId,
    draftState,
    reset,
    initRuntimeTry,
    switchTry,
    applyDraftAnswers,
    applyDraftImages,
    applyDraftCursor,
    applyDraftFixedResponseState,
    applyDraftStopState,
    beginFieldEdit,
    cancelDraftEdits,
    setEditingFieldName,
    commitDraftToTry,
    forkTryFromDraft,
  } = useRuntimeTryStore();

  const fixedResponseRunTokenRef = useRef<Record<string, number>>({});
  const previousActiveOriginalIndexRef = useRef<number | null>(null);

  const appElements = useMemo(() => {
    const els = surveyJson?.elements;
    return Array.isArray(els) ? (els as Element[]) : [];
  }, [surveyJson]);

  const activeTry = activeTryId ? triesById[activeTryId] || null : null;
  const answers = useMemo(
    () => draftState?.answers || ({} as Answers),
    [draftState?.answers],
  );
  const images = useMemo(
    () => draftState?.images || ({} as Base64Images),
    [draftState?.images],
  );
  const cursor = draftState?.cursor || 0;
  const editingFieldName = draftState?.editingFieldName || null;
  const fixedResponseStateById = draftState?.fixedResponseStateById || {};
  const stopStateByElementId = draftState?.stopStateByElementId || {};
  const activeTryIndex = activeTry?.index || 1;

  useEffect(() => {
    setElements(appElements);
  }, [appElements, setElements]);

  useEffect(() => {
    reset();
    previousActiveOriginalIndexRef.current = null;
  }, [surveyJson?.id, reset]);

  useEffect(() => {
    if (!surveyJson) return;
    initRuntimeTry(
      structuredClone((surveyAnswers as Answers) || {}),
      structuredClone((surveyImages as Base64Images) || {}),
    );
  }, [surveyJson, initRuntimeTry, surveyAnswers, surveyImages]);

  const buildVisibleElements = useCallback(
    (sourceAnswers: Answers): VisibleEntry[] => {
      return appElements
        .map((element, originalIndex) => {
          const isVisible = evaluateVisibility(
            (element.conditionalLogic || {}) as ConditionalLogic,
            sourceAnswers as Answers,
          );
          return isVisible ? { element, originalIndex } : null;
        })
        .filter((entry): entry is VisibleEntry => Boolean(entry));
    },
    [appElements],
  );

  const visibleElements = useMemo(
    () => buildVisibleElements(answers as Answers),
    [answers, buildVisibleElements],
  );

  useEffect(() => {
    if (!activeTryId) return;
    // Why: this anchor is used to preserve cursor when visibility changes. On try switch
    // it must be recalculated from the target try, otherwise the previous try can drag
    // the new try's cursor and hide cards that should be visible immediately.
    previousActiveOriginalIndexRef.current =
      visibleElements[cursor]?.originalIndex ?? null;
  }, [activeTryId, cursor, visibleElements]);

  const advance = useCallback(
    (nextIndex: number) => {
      if (nextIndex === cursor) return;
      setErrors([]);
      previousActiveOriginalIndexRef.current =
        visibleElements[nextIndex]?.originalIndex ?? null;
      applyDraftCursor(nextIndex);
      if (nextIndex >= visibleElements.length) {
        onComplete?.();
      }
    },
    [cursor, onComplete, setErrors, visibleElements, applyDraftCursor],
  );

  useEffect(() => {
    if (visibleElements.length === 0) {
      if (cursor !== 0) {
        advance(0);
      }
      previousActiveOriginalIndexRef.current = null;
      return;
    }

    const previousOriginalIndex = previousActiveOriginalIndexRef.current;
    if (previousOriginalIndex !== null) {
      const newIndex = visibleElements.findIndex(
        (entry) => entry.originalIndex === previousOriginalIndex,
      );
      if (newIndex === -1) {
        const nextIndex = visibleElements.findIndex(
          (entry) => entry.originalIndex > previousOriginalIndex,
        );
        const targetIndex = nextIndex >= 0 ? nextIndex : visibleElements.length;
        if (targetIndex !== cursor) {
          advance(targetIndex);
          previousActiveOriginalIndexRef.current =
            visibleElements[targetIndex]?.originalIndex ?? null;
          return;
        }
      } else if (newIndex !== cursor) {
        applyDraftCursor(newIndex);
        previousActiveOriginalIndexRef.current = previousOriginalIndex;
        return;
      }
    }

    if (cursor > visibleElements.length) {
      advance(visibleElements.length);
      previousActiveOriginalIndexRef.current = null;
      return;
    }

    previousActiveOriginalIndexRef.current =
      visibleElements[cursor]?.originalIndex ?? null;
  }, [advance, cursor, visibleElements, applyDraftCursor]);

  const { stopIndex, stopElement, visibleUntil } = useMemo(() => {
    let i = cursor;
    while (i < visibleElements.length && !isStopElement(visibleElements[i].element)) {
      i += 1;
    }
    const hasStop =
      i < visibleElements.length && isStopElement(visibleElements[i].element);
    const stopIdx = hasStop ? i : null;
    const stopEl = hasStop ? visibleElements[i] : null;
    const until = hasStop ? i : visibleElements.length - 1;
    return { stopIndex: stopIdx, stopElement: stopEl, visibleUntil: until };
  }, [cursor, visibleElements]);

  const getVisibleInstructions = (
    instructions: Element["instructions"] | undefined,
  ) => {
    return (instructions || []).filter((inst) =>
      evaluateVisibility(
        (inst?.conditionalLogic || {}) as ConditionalLogic,
        answers as Answers,
      ),
    );
  };

  const setInputValueWithDraft: setInputValue = useCallback(
    (name, value, otherValue, type) => {
      applyDraftAnswers((prev) =>
        serializeAnswer(prev, name, value, otherValue, type),
      );
    },
    [applyDraftAnswers],
  );

  const handleInputChangeWithDraft: handleInputChange = useCallback(
    (e) => {
      const { name, value } = e.target;
      const inputType =
        e.target instanceof HTMLTextAreaElement ? "textarea" : e.target.type;
      setInputValueWithDraft(name, value, "", inputType);
    },
    [setInputValueWithDraft],
  );

  const setImagesWithDraft = useCallback(
    (updater: (prev: Base64Images) => Base64Images) => {
      applyDraftImages(updater);
    },
    [applyDraftImages],
  );

  const trimFixedStateFromOriginalIndex = useCallback(
    (
      source: Record<string, FixedResponseRuntimeState>,
      restartOriginalIndex: number,
    ) => {
      const removableIds = new Set(
        appElements
          .filter(
            (el, originalIndex) =>
              originalIndex >= restartOriginalIndex && el.type === "fixedResponse",
          )
          .map((el) => el.id),
      );
      return Object.fromEntries(
        Object.entries(source || {}).filter(([id]) => !removableIds.has(id)),
      ) as Record<string, FixedResponseRuntimeState>;
    },
    [appElements],
  );

  const trimStopStateFromOriginalIndex = useCallback(
    (source: Record<string, StopRuntimeState>, restartOriginalIndex: number) => {
      const removableIds = new Set(
        appElements
          .filter((_, originalIndex) => originalIndex >= restartOriginalIndex)
          .map((el) => el.id),
      );
      return Object.fromEntries(
        Object.entries(source || {}).filter(([id]) => !removableIds.has(id)),
      ) as Record<string, StopRuntimeState>;
    },
    [appElements],
  );

  const startFixedResponseTypewriter = useCallback(
    (id: string, fullText: string) => {
      const nextToken = (fixedResponseRunTokenRef.current[id] || 0) + 1;
      fixedResponseRunTokenRef.current[id] = nextToken;
      applyDraftFixedResponseState((prev) => ({
        ...prev,
        [id]: {
          fullText,
          displayedText: "",
          isAnimating: true,
        },
      }));

      (async () => {
        let i = 0;
        while (i < fullText.length && fixedResponseRunTokenRef.current[id] === nextToken) {
          const remaining = fullText.length - i;
          const chunkSize =
            remaining <= 2 ? remaining : Math.random() < 0.85 ? 1 : 2;
          i += chunkSize;
          applyDraftFixedResponseState((prev) => ({
            ...prev,
            [id]: {
              fullText,
              displayedText: fullText.slice(0, i),
              isAnimating: true,
            },
          }));
          const delayMs = 12 + Math.floor(Math.random() * 17);
          await new Promise((r) => setTimeout(r, delayMs));
        }
        if (fixedResponseRunTokenRef.current[id] !== nextToken) return;
        applyDraftFixedResponseState((prev) => ({
          ...prev,
          [id]: {
            fullText,
            displayedText: fullText,
            isAnimating: false,
          },
        }));
      })();
    },
    [applyDraftFixedResponseState],
  );

  const revealFullFixedResponse = useCallback(
    (id: string, fullText: string) => {
      fixedResponseRunTokenRef.current[id] =
        (fixedResponseRunTokenRef.current[id] || 0) + 1;
      applyDraftFixedResponseState((prev) => ({
        ...prev,
        [id]: {
          fullText,
          displayedText: fullText,
          isAnimating: false,
        },
      }));
    },
    [applyDraftFixedResponseState],
  );

  const getOriginalIndexByFieldName = useCallback(
    (fieldName: string): number | null => {
      const match = appElements.findIndex(
        (el) => !isStopElement(el) && el.name === fieldName,
      );
      return match >= 0 ? match : null;
    },
    [appElements],
  );

  const handleRun = async (event: FormEvent) => {
    event.preventDefault();
    if (!surveyJson || !activeTry || !draftState || !stopElement || stopIndex === null) return;

    const segmentInputs = visibleElements
      .slice(cursor, stopIndex)
      .map((entry) => entry.element)
      .filter((el) => !isStopElement(el));
    const newErrors = validateForm(segmentInputs, answers);
    if (newErrors.length > 0) {
      setErrors(newErrors);
      return;
    }

    const stop = stopElement.element;
    if (stop.type === "fixedResponse") {
      const text = injectValuesIntoPrompt(stop.text || "", answers);
      const existing = fixedResponseStateById[stop.id];
      applyDraftFixedResponseState((prev) => ({
        ...prev,
        [stop.id]: {
          fullText: text,
          displayedText: existing?.displayedText ?? "",
          isAnimating: existing?.isAnimating ?? false,
        },
      }));
      if (existing?.displayedText === undefined && !existing?.isAnimating) {
        startFixedResponseTypewriter(stop.id, text);
      }
      applyDraftStopState((prev) => ({
        ...prev,
        [stop.id]: {
          runId: undefined,
          resultVisible: true,
          requiredScoreFailed: false,
        },
      }));
      commitDraftToTry({ hasPostEditInteraction: true });
      return;
    }

    setSurveyImages(() => structuredClone(images));

    if (stop.type === "aiResponse") {
      const prompts: Prompt[] = getVisibleInstructions(stop.instructions).map((inst, idx) => ({
        id: `${stop.id}-p-${idx}`,
        name: `${stop.name}-p-${idx}`,
        type: "prompt",
        text: inst.text || "",
      }));
      const res = await sendPrompts(
        prompts,
        answers,
        appId,
        surveyJson,
        stopElement.originalIndex,
        userId,
        false,
        false,
        undefined,
        { tryId: activeTryId || undefined, tryIndex: activeTry.index },
      );
      if (res.run_passed === false) return;
      const nextCursor = stopIndex + 1;
      applyDraftCursor(nextCursor);
      applyDraftStopState((prev) => ({
        ...prev,
        [stop.id]: {
          runId: res.run_uuid,
          resultVisible: true,
          requiredScoreFailed: false,
        },
      }));
      commitDraftToTry({ cursor: nextCursor, hasPostEditInteraction: true });
      advance(nextCursor);
      return;
    }

    if (stop.type === "scoring") {
      const res = await sendPrompts(
        [
          {
            id: `${stop.id}-score`,
            name: `${stop.name}-score`,
            type: "prompt",
            text: ".",
          },
        ],
        answers,
        appId,
        surveyJson,
        stopElement.originalIndex,
        userId,
        false,
        false,
        {
          scoredPhase: true,
          rubric: stop.rubric || "",
          minScore: typeof stop.minScore === "number" ? stop.minScore : 0,
          scoreFeedbackEnabled: stop.scoreFeedbackEnabled ?? true,
          scoreFeedbackInstructions: stop.scoreFeedbackInstructions || "",
        },
        { tryId: activeTryId || undefined, tryIndex: activeTry.index },
      );
      const scoringIsRequired = stop.isRequired !== false;
      const failedRequired = res.run_passed === false && scoringIsRequired;
      const nextCursor = failedRequired ? cursor : stopIndex + 1;
      applyDraftCursor(nextCursor);
      applyDraftStopState((prev) => ({
        ...prev,
        [stop.id]: {
          runId: res.run_uuid,
          resultVisible: true,
          requiredScoreFailed: failedRequired,
        },
      }));
      commitDraftToTry({ cursor: nextCursor, hasPostEditInteraction: true });
      if (!failedRequired) {
        advance(nextCursor);
      }
    }
  };

  const saveEditingField = () => {
    if (!activeTry || !draftState) return;
    const changedFieldNames = Object.keys(answers).filter(
      (name) =>
        JSON.stringify(answers[name]) !== JSON.stringify(activeTry.answers[name]),
    );
    if (changedFieldNames.length === 0 && editingFieldName) {
      changedFieldNames.push(editingFieldName);
    }
    if (changedFieldNames.length === 0) {
      setEditingFieldName(null);
      return;
    }

    const changedOriginalIndexes = changedFieldNames
      .map((name) => getOriginalIndexByFieldName(name))
      .filter((idx): idx is number => idx !== null);
    const topEditedOriginalIndex =
      changedOriginalIndexes.length > 0 ? Math.min(...changedOriginalIndexes) : 0;
    const visibleAfterEdit = buildVisibleElements(answers);
    const restartVisibleStopIndex = visibleAfterEdit.findIndex(
      (entry) =>
        entry.originalIndex >= topEditedOriginalIndex && isStopElement(entry.element),
    );
    const restartCursor =
      restartVisibleStopIndex >= 0 ? restartVisibleStopIndex : visibleAfterEdit.length;
    const restartOriginalIndex =
      restartVisibleStopIndex >= 0
        ? visibleAfterEdit[restartVisibleStopIndex].originalIndex
        : Number.MAX_SAFE_INTEGER;

    const trimmedFixedState = trimFixedStateFromOriginalIndex(
      fixedResponseStateById,
      restartOriginalIndex,
    );
    const trimmedStopState = trimStopStateFromOriginalIndex(
      stopStateByElementId,
      restartOriginalIndex,
    );
    applyDraftCursor(restartCursor);
    applyDraftFixedResponseState(() => structuredClone(trimmedFixedState));
    applyDraftStopState(() => structuredClone(trimmedStopState));

    const overrides = {
      cursor: restartCursor,
      editedFieldIds: Array.from(
        new Set([...(activeTry.editedFieldIds || []), ...changedFieldNames]),
      ),
      firstEditedOriginalIndex:
        activeTry.firstEditedOriginalIndex === null
          ? topEditedOriginalIndex
          : Math.min(activeTry.firstEditedOriginalIndex, topEditedOriginalIndex),
    };

    if (activeTry.hasPostEditInteraction === false) {
      commitDraftToTry(overrides);
    } else {
      forkTryFromDraft(overrides);
    }
    previousActiveOriginalIndexRef.current = restartOriginalIndex;
    setEditingFieldName(null);
    setErrors([]);
  };

  const isComplete = cursor >= visibleElements.length;
  const renderUntil = isComplete
    ? visibleElements.length
    : Math.max(cursor, visibleUntil + 1);
  // Why: stops above the active cursor are part of this try's committed timeline.
  // Keeping everything up to cursor avoids "disappearing" AI/scoring cards when navigating tries.
  const visibleElementsForRender = visibleElements.slice(
    0,
    Math.min(renderUntil, visibleElements.length),
  );

  const lastRequiredScoringPassOriginalIndex = useMemo(() => {
    const runs = getRunsForTry(activeTryId ?? undefined).filter(
      (run) => run.run_passed !== false,
    );
    let maxPass = -1;
    for (const run of runs) {
      const el = appElements[run.phaseIndex];
      if (el?.type === "scoring" && el.isRequired !== false) {
        maxPass = Math.max(maxPass, run.phaseIndex);
      }
    }
    return maxPass;
  }, [getRunsForTry, activeTryId, appElements]);

  if (!surveyJson || !activeTry || !draftState) return null;

  return (
    <form onSubmit={handleRun} className="space-y-6">
      {visibleElementsForRender.map(({ element, originalIndex }, idx) => {
        const isLocked = idx < cursor;
        const isActiveStop = stopIndex !== null && idx === stopIndex;
        const isStop = isStopElement(element);

        if (element.type === "title") {
          return (
            <div key={element.id} className="pt-2">
              <h2 className={`text-base/7 font-semibold ${isLocked ? "text-gray-500" : "text-gray-900"}`}>
                {element.text || element.label}
              </h2>
              {element.description && (
                <p className={`mt-1 text-sm/6 ${isLocked ? "text-gray-500" : "text-gray-600"}`}>
                  {element.description}
                </p>
              )}
            </div>
          );
        }

        if (!isStop) {
          const canEditLockedField =
            isLocked &&
            originalIndex > lastRequiredScoringPassOriginalIndex &&
            isEditSupportedElementType(element.type);
          const isEditingThisField = editingFieldName === element.name;
          const showEditedChip = activeTry.editedFieldIds.includes(element.name);
          return (
            <div
              key={element.id}
              className={`mb-6 relative group rounded-md ${
                isEditButtonAboveType(element.type) ? "pt-8" : ""
              } ${
                isEditingThisField
                  ? "ring-2 ring-primary/25 border border-gray-300 bg-gray-50 p-3"
                  : ""
              }`}
            >
              {showEditedChip && (
                <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-100/70 px-2 py-0.5 text-[11px] text-gray-700 mb-2">
                  [Edited]
                </span>
              )}
              {canEditLockedField && !isEditingThisField && (
                <button
                  type="button"
                  className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
                  onClick={() => beginFieldEdit(element.name)}
                >
                  <Pencil className="h-3 w-3" />
                  Edit
                </button>
              )}
              <RenderQuestion
                key={element.name}
                errors={errors}
                element={{ ...element, isRequired: element.isRequired, conditionalLogic: element.conditionalLogic, type: element.type }}
                answers={answers as any}
                disabled={isEditingThisField ? false : isLocked}
                handleInputChange={handleInputChangeWithDraft}
                setInputValue={setInputValueWithDraft}
                setImages={setImagesWithDraft}
                visible={true}
                appId={appId}
                userId={userId}
                surveyJson={surveyJson}
                currentPhaseIndex={originalIndex}
                isOwner={isOwner}
                isAdmin={isAdmin}
              />
              {isEditingThisField && (
                <div className="mt-3 pt-3 border-t border-gray-100 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={cancelDraftEdits}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
                  >
                    <X className="h-4 w-4" />
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={saveEditingField}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-primary text-primary-foreground rounded-md hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                  >
                    <Check className="h-4 w-4" />
                    Save changes
                  </button>
                </div>
              )}
            </div>
          );
        }

        const stopState = stopStateByElementId[element.id];
        const runsForAllTries = getRunsForTry(undefined);
        const runByStoredId = stopState?.runId
          ? runsForAllTries.find((r) => r.id === stopState.runId) || null
          : null;
        const latestRunForStop = getLatestRunForStop(
          originalIndex,
          activeTryId ?? undefined,
        );
        // Why: a newly forked try can intentionally inherit already-visible stop cards
        // above the edited field. Those cards may reference a run created in the parent try,
        // so we must resolve stored runId across all runs, not only the active try.
        // Fallback then stays scoped to active try for newly produced runs in this branch.
        const run = runByStoredId || latestRunForStop;
        const runForThisStop = stopState?.resultVisible === false ? null : run;
        const scoringIsRequired = element.type === "scoring" ? element.isRequired !== false : false;
        const scoringFailed = Boolean(
          element.type === "scoring" &&
            (stopState?.requiredScoreFailed ||
              (runForThisStop && !passedTheRubricMinScore(runForThisStop))),
        );

        const fixedState = fixedResponseStateById[element.id];
        const hasRevealedFixed =
          element.type === "fixedResponse" && Boolean(fixedState?.fullText);
        const fixedDisplayed = fixedState?.displayedText || "";

        const aiPromptPreviewPrompts: Prompt[] =
          element.type === "aiResponse"
            ? getVisibleInstructions(element.instructions).map((inst, pIdx) => ({
                id: `${element.id}-preview-${pIdx}`,
                name: `${element.name}-preview-${pIdx}`,
                type: "prompt",
                text: inst?.text || "",
              }))
            : [];

        const isScoredRun = Boolean(
          runForThisStop?.score_expected ||
            runForThisStop?.scoreData?.scored_run ||
            runForThisStop?.run_score,
        );
        const scoreReady = Boolean(
          runForThisStop?.scoreData?.run_score || runForThisStop?.run_score,
        );
        const explanationRequested = Boolean(
          runForThisStop?.score_explanation ??
            runForThisStop?.scoreData?.score_explanation,
        );
        const explanationMode =
          runForThisStop?.score_explanation_mode ||
          runForThisStop?.scoreData?.score_explanation_mode ||
          "always";
        const shouldOfferExplanation =
          isScoredRun &&
          scoreReady &&
          explanationRequested &&
          (explanationMode === "always" ||
            (explanationMode === "failed_only" && runForThisStop?.run_passed === false) ||
            (explanationMode === "passed_only" && runForThisStop?.run_passed === true));
        const explanationContent = shouldOfferExplanation
          ? runForThisStop?.messages.findLast(
              (m) => m.role === "assistant" || m.role === "fixed_response",
            )?.content || ""
          : "";

        const isAwaitingResponseOrScore =
          promptLoading ||
          (isScoredRun && !scoreReady) ||
          (element.type === "fixedResponse" && fixedState?.isAnimating === true);

        return (
          <div key={element.id} className="mt-6">
            {element.type === "fixedResponse" && hasRevealedFixed && (
              <MarkdownResponseDisplay content={fixedDisplayed || fixedState?.fullText || ""} className="" />
            )}
            {runForThisStop && (
              <>
                {!isScoredRun && (
                  <>
                    <AIResponseDisplay run={runForThisStop} isOwner={isOwner} isAdmin={isAdmin} />
                    {element.type === "aiResponse" && aiPromptPreviewPrompts.length > 0 && (
                      <div className="mt-3">
                        <RenderPrompt
                          prompts={aiPromptPreviewPrompts}
                          answers={answers as any}
                          disabled={false}
                          isOwner={isOwner}
                          isAdmin={isAdmin}
                        />
                      </div>
                    )}
                  </>
                )}
                <RunScoreDisplay
                  run={runForThisStop}
                  isEvaluating={isScoredRun && !scoreReady}
                  explanationContent={explanationContent}
                />
                {!promptLoading && !passedTheRubricMinScore(runForThisStop) && (
                  <div className="mt-4 border rounded-lg p-3 bg-red-50">
                    <p className="text-sm/6 text-red-700">
                      {scoringIsRequired
                        ? "Did not pass the Minimum Score. Please adjust your answers and try again."
                        : "Did not pass the Minimum Score. You can adjust your answers to improve the score."}
                    </p>
                  </div>
                )}
              </>
            )}

            {isActiveStop && (
              <>
                {tryOrder.length > 1 && (
                  <div className="mt-2 mb-3 flex justify-end">
                    <div className="inline-flex items-center gap-2 text-xs text-gray-600">
                      <button
                        type="button"
                        className="p-1 rounded border border-gray-200 disabled:opacity-50"
                        disabled={activeTryIndex <= 1 || isAwaitingResponseOrScore}
                        onClick={() => {
                          const target = tryOrder.find(
                            (tryId) => triesById[tryId]?.index === activeTryIndex - 1,
                          );
                          if (target) switchTry(target);
                        }}
                      >
                        <ChevronLeft className="h-3.5 w-3.5" />
                      </button>
                      <span>{activeTryIndex}/{tryOrder.length}</span>
                      <button
                        type="button"
                        className="p-1 rounded border border-gray-200 disabled:opacity-50"
                        disabled={activeTryIndex >= tryOrder.length || isAwaitingResponseOrScore}
                        onClick={() => {
                          const target = tryOrder.find(
                            (tryId) => triesById[tryId]?.index === activeTryIndex + 1,
                          );
                          if (target) switchTry(target);
                        }}
                      >
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                )}
                {promptLoading ? (
                  <div className="mt-4">
                    <SkeletonLoader />
                  </div>
                ) : (
                  <div className="mt-4 flex justify-end">
                    {!(element.type === "scoring" && scoringIsRequired && scoringFailed) && (
                      <button
                        type="submit"
                        className="px-6 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                        onClick={(e) => {
                          if (element.type !== "fixedResponse") return;
                          const full = fixedState?.fullText || "";
                          const displayed = fixedState?.displayedText || "";
                          const anim = fixedState?.isAnimating === true;
                          // For empty fixed responses, there is nothing to reveal;
                          // treat Continue as simply advancing to the next element.
                          if (!full) {
                            e.preventDefault();
                            advance(idx + 1);
                            return;
                          }
                          if (anim || displayed !== full) {
                            e.preventDefault();
                            revealFullFixedResponse(element.id, full);
                            return;
                          }
                          e.preventDefault();
                          advance(idx + 1);
                        }}
                      >
                        {element.type === "scoring"
                          ? scoringIsRequired
                            ? "Evaluate"
                            : "Continue"
                          : "Continue"}
                      </button>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        );
      })}
    </form>
  );
}

