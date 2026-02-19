"use client";

import {
  useMemo,
  useRef,
  useState,
  FormEvent,
  useEffect,
  useCallback,
} from "react";
import evaluateVisibility from "@/utils/evaluateVisibility";
import { validateForm } from "@/utils/validateForms";
import { useSurveyStore } from "@/store/runtimeSurveyStore";
import { useConversationStore } from "@/store/conversationStore";
import RenderQuestion from "./RenderQuestion";
import RenderPrompt from "./RenderPrompt";
import injectValuesIntoPrompt from "@/utils/injectValuesIntoPrompt";
import type {
  Answers,
  ConditionalLogic,
  Element,
  Prompt,
} from "@/app/(authenticated)/app/types";
import {
  AIResponseDisplay,
  MarkdownResponseDisplay,
  RunScoreDisplay,
  passedTheRubricMinScore,
} from "@/utils/phaseResultDisplay";
import SkeletonLoader from "@/components/layout/loading/skeletonLoader";
import { Check, ChevronLeft, ChevronRight, Pencil, X } from "lucide-react";

const STOP_TYPES = new Set<Element["type"]>([
  "aiResponse",
  "fixedResponse",
  "scoring",
]);

function isStopElement(el: Element): boolean {
  return STOP_TYPES.has(el.type);
}

type VisibleEntry = { element: Element; originalIndex: number };

type TryState = {
  id: string;
  index: number;
  parentTryId: string | null;
  createdAt: number;
  answersSnapshot: Answers;
  cursor: number;
  imagesSnapshot: Record<string, Record<string, string>>;
  fixedResponsesById: Record<string, string>;
  fixedResponseDisplayedById: Record<string, string>;
  stopStateByElementId: Record<
    string,
    { runId?: string; resultVisible: boolean; requiredScoreFailed: boolean }
  >;
  editedFieldIds: string[];
  isDraft: boolean;
  hasPostEditInteraction: boolean;
  firstEditedOriginalIndex: number | null;
};

type Props = {
  appId: number;
  userId: number | null;
  isOwner?: boolean;
  isAdmin?: boolean;
  onComplete?: () => void;
};

export default function CurrentElementFlow({
  appId,
  userId,
  isOwner = false,
  isAdmin = false,
  onComplete,
}: Props) {
  const {
    surveyJson,
    answers,
    images,
    errors,
    promptLoading,
    setErrors,
    setElements,
    setAnswers,
    setImages,
    setInputValue,
    handleInputChange,
    sendPrompts,
  } = useSurveyStore();

  const { getRunsForTry, getLatestRunForStop } = useConversationStore();

  const [cursor, setCursor] = useState(0);
  const [fixedResponsesById, setFixedResponsesById] = useState<Record<string, string>>(
    {},
  );
  const [fixedResponseDisplayedById, setFixedResponseDisplayedById] = useState<
    Record<string, string>
  >({});
  const [fixedResponseAnimatingById, setFixedResponseAnimatingById] = useState<
    Record<string, boolean>
  >({});
  const [tries, setTries] = useState<TryState[]>([]);
  const [activeTryId, setActiveTryId] = useState<string | null>(null);
  const [editingFieldName, setEditingFieldName] = useState<string | null>(null);
  const [editBaseAnswers, setEditBaseAnswers] = useState<Answers | null>(null);
  const [editBaseImages, setEditBaseImages] = useState<
    Record<string, Record<string, string>> | null
  >(null);
  const hydratingTryRef = useRef(false);
  const lastHydratedTryIdRef = useRef<string | null>(null);
  const fixedResponseRunTokenRef = useRef<Record<string, number>>({});
  const previousActiveOriginalIndexRef = useRef<number | null>(null);

  const appElements = useMemo(() => {
    const els = surveyJson?.elements;
    return Array.isArray(els) ? (els as Element[]) : [];
  }, [surveyJson]);

  useEffect(() => {
    setElements(appElements);
  }, [appElements, setElements]);

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

  const activeTry = useMemo(
    () => tries.find((t) => t.id === activeTryId) ?? null,
    [tries, activeTryId],
  );

  useEffect(() => {
    if (!surveyJson || tries.length > 0) return;
    const initialTry: TryState = {
      id: crypto.randomUUID(),
      index: 1,
      parentTryId: null,
      createdAt: Date.now(),
      answersSnapshot: structuredClone((answers as Answers) || {}),
      cursor: 0,
      imagesSnapshot: structuredClone(images || {}),
      fixedResponsesById: {},
      fixedResponseDisplayedById: {},
      stopStateByElementId: {},
      editedFieldIds: [],
      isDraft: false,
      hasPostEditInteraction: false,
      firstEditedOriginalIndex: null,
    };
    setTries([initialTry]);
    setActiveTryId(initialTry.id);
    setCursor(0);
    setFixedResponsesById({});
    setFixedResponseDisplayedById({});
    setFixedResponseAnimatingById({});
  }, [surveyJson, tries.length, answers, images]);

  const advance = useCallback(
    (nextIndex: number) => {
      if (nextIndex === cursor) return;
      setErrors([]);
      previousActiveOriginalIndexRef.current =
        visibleElements[nextIndex]?.originalIndex ?? null;
      setCursor(nextIndex);
      if (nextIndex >= visibleElements.length) {
        onComplete?.();
      }
    },
    [cursor, onComplete, setErrors, visibleElements]
  );

  useEffect(() => {
    if (!activeTry || !activeTryId) return;
    if (lastHydratedTryIdRef.current === activeTryId) return;
    hydratingTryRef.current = true;
    setAnswers(() => structuredClone(activeTry.answersSnapshot || {}));
    setImages(() => structuredClone(activeTry.imagesSnapshot || {}));
    setCursor(activeTry.cursor);
    setFixedResponsesById(structuredClone(activeTry.fixedResponsesById || {}));
    setFixedResponseDisplayedById(
      structuredClone(
        activeTry.fixedResponseDisplayedById || activeTry.fixedResponsesById || {},
      ),
    );
    setFixedResponseAnimatingById({});
    setEditingFieldName(null);
    setEditBaseAnswers(null);
    setEditBaseImages(null);
    lastHydratedTryIdRef.current = activeTryId;
    queueMicrotask(() => {
      hydratingTryRef.current = false;
    });
  }, [activeTry, activeTryId, setAnswers, setImages]);

  const commitActiveTry = useCallback(
    (updates: Partial<TryState>) => {
      if (!activeTryId) return;
      setTries((prev) =>
        prev.map((t) => (t.id === activeTryId ? { ...t, ...updates } : t)),
      );
    },
    [activeTryId],
  );

  const trimStopStateFromOriginalIndex = useCallback(
    (
      source: TryState["stopStateByElementId"],
      restartOriginalIndex: number,
    ): TryState["stopStateByElementId"] => {
      const removableIds = new Set(
        appElements
          .filter((_, originalIndex) => originalIndex >= restartOriginalIndex)
          .map((el) => el.id),
      );
      return Object.fromEntries(
        Object.entries(source || {}).filter(([id]) => !removableIds.has(id)),
      );
    },
    [appElements],
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
        (entry) => entry.originalIndex === previousOriginalIndex
      );

      if (newIndex === -1) {
        const nextIndex = visibleElements.findIndex(
          (entry) => entry.originalIndex > previousOriginalIndex
        );
        const targetIndex =
          nextIndex >= 0 ? nextIndex : visibleElements.length;
        if (targetIndex !== cursor) {
          advance(targetIndex);
          previousActiveOriginalIndexRef.current =
            visibleElements[targetIndex]?.originalIndex ?? null;
          return;
        }
      } else if (newIndex !== cursor) {
        setCursor(newIndex);
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
  }, [advance, cursor, visibleElements]);

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
    instructions: Element["instructions"] | undefined
  ) => {
    return (instructions || []).filter((inst) =>
      evaluateVisibility(
        (inst?.conditionalLogic || {}) as ConditionalLogic,
        answers as Answers
      )
    );
  };

  const startFixedResponseTypewriter = useCallback((id: string, fullText: string) => {
    const nextToken = (fixedResponseRunTokenRef.current[id] || 0) + 1;
    fixedResponseRunTokenRef.current[id] = nextToken;

    setFixedResponseAnimatingById((prev) => ({ ...prev, [id]: true }));
    setFixedResponseDisplayedById((prev) => ({ ...prev, [id]: "" }));

    (async () => {
      let i = 0;
      const minDelayMs = 12;
      const maxDelayMs = 28;

      while (
        i < fullText.length &&
        fixedResponseRunTokenRef.current[id] === nextToken
      ) {
        const remaining = fullText.length - i;
        const chunkSize =
          remaining <= 2 ? remaining : Math.random() < 0.85 ? 1 : 2;
        i += chunkSize;
        setFixedResponseDisplayedById((prev) => ({
          ...prev,
          [id]: fullText.slice(0, i),
        }));
        const delayMs =
          minDelayMs +
          Math.floor(Math.random() * (maxDelayMs - minDelayMs + 1));
        await new Promise((r) => setTimeout(r, delayMs));
      }

      if (fixedResponseRunTokenRef.current[id] !== nextToken) return;
      setFixedResponseAnimatingById((prev) => ({ ...prev, [id]: false }));
      setFixedResponseDisplayedById((prev) => ({ ...prev, [id]: fullText }));
    })();
  }, []);

  const revealFullFixedResponse = useCallback((id: string, fullText: string) => {
    fixedResponseRunTokenRef.current[id] =
      (fixedResponseRunTokenRef.current[id] || 0) + 1;
    setFixedResponseAnimatingById((prev) => ({ ...prev, [id]: false }));
    setFixedResponseDisplayedById((prev) => ({ ...prev, [id]: fullText }));
  }, []);

  const handleRun = async (event: FormEvent) => {
    event.preventDefault();

    if (!surveyJson) return;
    if (!stopElement || stopIndex === null) return;
    // Validate only the current visible segment inputs (cursor..stopIndex-1)
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
      setFixedResponsesById((prev) => ({ ...prev, [stop.id]: text }));
      const alreadyDisplayed = fixedResponseDisplayedById[stop.id];
      const isAnimating = fixedResponseAnimatingById[stop.id];
      if (alreadyDisplayed === undefined && !isAnimating) {
        startFixedResponseTypewriter(stop.id, text);
      }
      commitActiveTry({
        answersSnapshot: structuredClone((answers as Answers) || {}),
        imagesSnapshot: structuredClone(images || {}),
        cursor,
        fixedResponsesById: { ...fixedResponsesById, [stop.id]: text },
        fixedResponseDisplayedById:
          alreadyDisplayed === undefined && !isAnimating
            ? fixedResponseDisplayedById
            : { ...fixedResponseDisplayedById, [stop.id]: text },
        stopStateByElementId: {
          ...(activeTry?.stopStateByElementId || {}),
          [stop.id]: {
            runId: undefined,
            resultVisible: true,
            requiredScoreFailed: false,
          },
        },
        hasPostEditInteraction: true,
        isDraft: false,
      });
      return;
    }

    if (stop.type === "aiResponse") {
      const visibleInstructions = getVisibleInstructions(stop.instructions);
      const prompts: Prompt[] = visibleInstructions.map((inst, idx) => ({
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
        {
          tryId: activeTryId || undefined,
          tryIndex: activeTry?.index,
        },
      );
      if (res.run_passed === false) return;
      const nextCursor = stopIndex + 1;
      advance(nextCursor);
      commitActiveTry({
        answersSnapshot: structuredClone((answers as Answers) || {}),
        imagesSnapshot: structuredClone(images || {}),
        cursor: nextCursor,
        fixedResponsesById: structuredClone(fixedResponsesById),
        fixedResponseDisplayedById: structuredClone(fixedResponseDisplayedById),
        stopStateByElementId: {
          ...(activeTry?.stopStateByElementId || {}),
          [stop.id]: {
            runId: res.run_uuid,
            resultVisible: true,
            requiredScoreFailed: false,
          },
        },
        hasPostEditInteraction: true,
        isDraft: false,
      });
      return;
    }

    if (stop.type === "scoring") {
      const prompt: Prompt[] = [
        {
          id: `${stop.id}-score`,
          name: `${stop.name}-score`,
          type: "prompt",
          text: ".",
        },
      ];

      const res = await sendPrompts(
        prompt,
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
          minScore:
            typeof stop.minScore === "number" ? stop.minScore : 0,
          scoreFeedbackEnabled: stop.scoreFeedbackEnabled ?? true,
          scoreFeedbackInstructions: stop.scoreFeedbackInstructions || "",
        },
        {
          tryId: activeTryId || undefined,
          tryIndex: activeTry?.index,
        },
      );
      const scoringIsRequired = stop.isRequired !== false;
      const failedRequired = res.run_passed === false && scoringIsRequired;
      const nextCursor = failedRequired ? cursor : stopIndex + 1;
      if (!failedRequired) {
        advance(nextCursor);
      }
      commitActiveTry({
        answersSnapshot: structuredClone((answers as Answers) || {}),
        imagesSnapshot: structuredClone(images || {}),
        cursor: nextCursor,
        fixedResponsesById: structuredClone(fixedResponsesById),
        fixedResponseDisplayedById: structuredClone(fixedResponseDisplayedById),
        stopStateByElementId: {
          ...(activeTry?.stopStateByElementId || {}),
          [stop.id]: {
            runId: res.run_uuid,
            resultVisible: true,
            requiredScoreFailed: failedRequired,
          },
        },
        hasPostEditInteraction: true,
        isDraft: false,
      });
      if (failedRequired) return;
      return;
    }
  };

  const isComplete = cursor >= visibleElements.length;
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

  const canEditFieldByOriginalIndex = useCallback(
    (originalIndex: number) => {
      return originalIndex > lastRequiredScoringPassOriginalIndex;
    },
    [lastRequiredScoringPassOriginalIndex],
  );

  const handleInputChangeWithRetryMark: typeof handleInputChange = (e) => {
    handleInputChange(e);
  };
  const setInputValueWithRetryMark: typeof setInputValue = (
    name,
    value,
    otherValue,
    type,
  ) => {
    setInputValue(name, value, otherValue, type);
  };

  const getOriginalIndexByFieldName = useCallback(
    (fieldName: string): number | null => {
      const match = appElements.findIndex(
        (el) => !isStopElement(el) && el.name === fieldName,
      );
      return match >= 0 ? match : null;
    },
    [appElements],
  );

  const trimFixedResponsesFromOriginalIndex = useCallback(
    (
      source: Record<string, string>,
      restartOriginalIndex: number,
    ): Record<string, string> => {
      const removableIds = new Set(
        appElements
          .filter(
            (el, originalIndex) =>
              originalIndex >= restartOriginalIndex && el.type === "fixedResponse",
          )
          .map((el) => el.id),
      );
      return Object.fromEntries(
        Object.entries(source).filter(([id]) => !removableIds.has(id)),
      );
    },
    [appElements],
  );

  const startEditingField = (fieldName: string) => {
    if (!activeTry) return;
    setEditBaseAnswers(structuredClone(activeTry.answersSnapshot || {}));
    setEditBaseImages(structuredClone(activeTry.imagesSnapshot || {}));
    setEditingFieldName(fieldName);
  };

  const cancelEditingField = () => {
    if (editBaseAnswers) {
      setAnswers(() => structuredClone(editBaseAnswers));
    }
    if (editBaseImages) {
      setImages(() => structuredClone(editBaseImages));
    }
    setEditingFieldName(null);
    setEditBaseAnswers(null);
    setEditBaseImages(null);
  };

  const saveEditingField = () => {
    if (!activeTry) return;
    const currentAnswers = structuredClone((answers as Answers) || {});
    const changedFieldNames = Object.keys(currentAnswers).filter(
      (name) =>
        JSON.stringify(currentAnswers[name]) !==
        JSON.stringify(activeTry.answersSnapshot[name]),
    );
    if (changedFieldNames.length === 0 && editingFieldName) {
      changedFieldNames.push(editingFieldName);
    }
    if (changedFieldNames.length === 0) {
      setEditingFieldName(null);
      setEditBaseAnswers(null);
      setEditBaseImages(null);
      return;
    }

    const changedOriginalIndexes = changedFieldNames
      .map((name) => getOriginalIndexByFieldName(name))
      .filter((idx): idx is number => idx !== null);
    const topEditedOriginalIndex =
      changedOriginalIndexes.length > 0 ? Math.min(...changedOriginalIndexes) : 0;
    const visibleAfterEdit = buildVisibleElements(currentAnswers);
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
    const trimmedFixedResponses = trimFixedResponsesFromOriginalIndex(
      fixedResponsesById,
      restartOriginalIndex,
    );
    const trimmedDisplayedResponses = trimFixedResponsesFromOriginalIndex(
      fixedResponseDisplayedById,
      restartOriginalIndex,
    );
    const trimmedStopState = trimStopStateFromOriginalIndex(
      activeTry.stopStateByElementId || {},
      restartOriginalIndex,
    );

    const shouldUpdateCurrentDraft =
      activeTry.isDraft === true && activeTry.hasPostEditInteraction === false;

    if (shouldUpdateCurrentDraft) {
      setTries((prev) =>
        prev.map((t) =>
          t.id !== activeTry.id
            ? t
            : {
                ...t,
                answersSnapshot: currentAnswers,
                imagesSnapshot: structuredClone(images || {}),
                cursor: restartCursor,
                fixedResponsesById: trimmedFixedResponses,
                fixedResponseDisplayedById: trimmedDisplayedResponses,
                stopStateByElementId: trimmedStopState,
                editedFieldIds: Array.from(
                  new Set([...(t.editedFieldIds || []), ...changedFieldNames]),
                ),
                firstEditedOriginalIndex:
                  t.firstEditedOriginalIndex === null
                    ? topEditedOriginalIndex
                    : Math.min(t.firstEditedOriginalIndex, topEditedOriginalIndex),
              },
        ),
      );
      previousActiveOriginalIndexRef.current = restartOriginalIndex;
      setCursor(restartCursor);
      setFixedResponsesById(trimmedFixedResponses);
      setFixedResponseDisplayedById(trimmedDisplayedResponses);
    } else {
      const newTryId = crypto.randomUUID();
      const newTry: TryState = {
        id: newTryId,
        index: tries.length + 1,
        parentTryId: activeTry.id,
        createdAt: Date.now(),
        answersSnapshot: currentAnswers,
        imagesSnapshot: structuredClone(images || {}),
        cursor: restartCursor,
        fixedResponsesById: trimmedFixedResponses,
        fixedResponseDisplayedById: trimmedDisplayedResponses,
        stopStateByElementId: trimmedStopState,
        editedFieldIds: Array.from(
          new Set([...(activeTry.editedFieldIds || []), ...changedFieldNames]),
        ),
        isDraft: true,
        hasPostEditInteraction: false,
        firstEditedOriginalIndex:
          activeTry.firstEditedOriginalIndex === null
            ? topEditedOriginalIndex
            : Math.min(activeTry.firstEditedOriginalIndex, topEditedOriginalIndex),
      };
      setTries((prev) => [...prev, newTry]);
      setActiveTryId(newTry.id);
      previousActiveOriginalIndexRef.current = restartOriginalIndex;
      setCursor(restartCursor);
      setFixedResponsesById(trimmedFixedResponses);
      setFixedResponseDisplayedById(trimmedDisplayedResponses);
    }

    setEditingFieldName(null);
    setEditBaseAnswers(null);
    setEditBaseImages(null);
    setErrors([]);
  };

  const visibleElementsForRender = isComplete
    ? visibleElements
    : visibleElements.slice(
        0,
        Math.min(visibleUntil + 1, visibleElements.length)
      );

  if (!surveyJson) return null;

  return (
    <form onSubmit={handleRun} className="space-y-6">
      {visibleElementsForRender.map(({ element, originalIndex }, idx) => {
        const isLocked = idx < cursor;
        const isActiveStop = stopIndex !== null && idx === stopIndex;
        const isStop = isStopElement(element);

        if (element.type === "title") {
          return (
            <div key={element.id} className="pt-2">
              <h2
                className={`text-base/7 font-semibold ${
                  isLocked ? "text-gray-500" : "text-gray-900"
                }`}
              >
                {element.text || element.label}
              </h2>
              {element.description && (
                <p
                  className={`mt-1 text-sm/6 ${
                    isLocked ? "text-gray-500" : "text-gray-600"
                  }`}
                >
                  {element.description}
                </p>
              )}
            </div>
          );
        }

        if (!isStop) {
          const canEditLockedField =
            isLocked && canEditFieldByOriginalIndex(originalIndex);
          const isEditingThisField = editingFieldName === element.name;
          const showEditedChip = activeTry?.editedFieldIds?.includes(element.name);
          return (
            <div
              className={`mb-6 relative group rounded-md ${
                isEditingThisField ? "ring-2 ring-primary/25 bg-primary/5 p-3" : ""
              }`}
              key={element.id}
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
                  onClick={() => startEditingField(element.name)}
                >
                  <Pencil className="h-3 w-3" />
                  Edit
                </button>
              )}

              <RenderQuestion
                key={element.name}
                errors={errors}
                element={{
                  ...element,
                  isRequired: element.isRequired,
                  conditionalLogic: element.conditionalLogic,
                  type: element.type,
                }}
                answers={answers as any}
                disabled={isEditingThisField ? false : isLocked}
                handleInputChange={handleInputChangeWithRetryMark}
                setInputValue={setInputValueWithRetryMark}
                setImages={setImages}
                visible={true}
                appId={appId}
                userId={userId}
                surveyJson={surveyJson}
                currentPhaseIndex={originalIndex}
                isOwner={isOwner}
                isAdmin={isAdmin}
              />

              {isEditingThisField && (
                <div className="mt-3 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={cancelEditingField}
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

        const latestRunForThisStop = getLatestRunForStop(
          originalIndex,
          activeTryId ?? undefined,
        );
        const stopState = activeTry?.stopStateByElementId?.[element.id];
        const runForThisStop =
          stopState?.resultVisible === false ? null : latestRunForThisStop;
        const scoringIsRequired =
          element.type === "scoring" ? element.isRequired !== false : false;
        const scoringFailed = Boolean(
          element.type === "scoring" &&
            (stopState?.requiredScoreFailed ||
              (latestRunForThisStop && !passedTheRubricMinScore(latestRunForThisStop))),
        );

        const revealedFixed =
          element.type === "fixedResponse"
            ? fixedResponsesById[element.id]
            : null;
        const hasRevealedFixed =
          element.type === "fixedResponse" && revealedFixed != null;
        const fixedDisplayed =
          element.type === "fixedResponse"
            ? fixedResponseDisplayedById[element.id]
            : null;
        const fixedAnimating =
          element.type === "fixedResponse"
            ? fixedResponseAnimatingById[element.id] === true
            : false;
        const isBareFixedReveal =
          element.type === "fixedResponse" && isActiveStop && !hasRevealedFixed;
        const isFixedResponseCard =
          element.type === "fixedResponse" && hasRevealedFixed;

        const aiPromptPreviewPrompts: Prompt[] =
          element.type === "aiResponse"
            ? getVisibleInstructions(element.instructions).map(
                (inst: any, pIdx: number) => ({
                  id: `${element.id}-preview-${pIdx}`,
                  name: `${element.name}-preview-${pIdx}`,
                  type: "prompt",
                  text: inst?.text || "",
                })
              )
            : [];

        const isBorderlessStopWrapper =
          element.type === "aiResponse" ||
          element.type === "scoring" ||
          isBareFixedReveal ||
          isFixedResponseCard ||
          !!runForThisStop;

        const isScoredRun = Boolean(
          runForThisStop?.score_expected ||
          runForThisStop?.scoreData?.scored_run ||
          runForThisStop?.run_score
        );
        const scoreReady = Boolean(
          runForThisStop?.scoreData?.run_score || runForThisStop?.run_score
        );
        const explanationRequested = Boolean(
          runForThisStop?.score_explanation ?? runForThisStop?.scoreData?.score_explanation
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
        const isEvaluatingScore = isScoredRun && !scoreReady;
        const explanationContent = shouldOfferExplanation
          ? runForThisStop?.messages.findLast(
              (m) => m.role === "assistant" || m.role === "fixed_response"
            )?.content || ""
          : "";

        return (
          <div
            key={element.id}
            className={
              isBorderlessStopWrapper
                ? "mt-6"
                : "mt-6 border rounded-lg p-4 bg-white"
            }
          >
            {/* Intentionally no helper text for aiResponse stops (button-only UX like older runtime). */}

            {element.type === "fixedResponse" && hasRevealedFixed && (
              <MarkdownResponseDisplay
                content={fixedDisplayed ?? revealedFixed ?? ""}
                className=""
              />
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
                  isEvaluating={isEvaluatingScore}
                  explanationContent={explanationContent}
                />
                {!promptLoading && !passedTheRubricMinScore(runForThisStop) && (
                  <div className="mt-4 border rounded-lg p-3 bg-red-50">
                    <p className="text-sm/6 text-red-700">
                      Did not pass the Minimum Score. Please try again.
                    </p>
                  </div>
                )}
              </>
            )}

            {isActiveStop && (
              <>
                {tries.length > 1 && (
                  <div className="mt-2 mb-3 flex justify-end">
                    <div className="inline-flex items-center gap-2 text-xs text-gray-600">
                      <button
                        type="button"
                        className="p-1 rounded border border-gray-200 disabled:opacity-50"
                        disabled={(activeTry?.index || 1) <= 1}
                        onClick={() => {
                          const targetIndex = (activeTry?.index || 1) - 1;
                          const target = tries.find((t) => t.index === targetIndex);
                          if (target) setActiveTryId(target.id);
                        }}
                      >
                        <ChevronLeft className="h-3.5 w-3.5" />
                      </button>
                      <span>
                        {activeTry?.index || 1}/{tries.length}
                      </span>
                      <button
                        type="button"
                        className="p-1 rounded border border-gray-200 disabled:opacity-50"
                        disabled={(activeTry?.index || 1) >= tries.length}
                        onClick={() => {
                          const targetIndex = (activeTry?.index || 1) + 1;
                          const target = tries.find((t) => t.index === targetIndex);
                          if (target) setActiveTryId(target.id);
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
                          const hasFull = hasRevealedFixed;
                          const full = revealedFixed ?? "";
                          const displayed = fixedDisplayed ?? "";
                          const anim = fixedAnimating;

                          if (!hasFull) {
                            e.currentTarget.blur();
                            return;
                          }

                          if (anim || displayed !== full) {
                            e.preventDefault();
                            e.currentTarget.blur();
                            revealFullFixedResponse(element.id, full);
                            return;
                          }

                          if (displayed === full) {
                            e.preventDefault();
                            e.currentTarget.blur();
                            advance(idx + 1);
                          }
                        }}
                      >
                        {element.type === "aiResponse"
                          ? "Continue"
                          : element.type === "scoring"
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

      {/* No stop element left → end */}
      {!isComplete && !stopElement && stopIndex === null && (
        <div className="mt-6 space-y-3">
          {tries.length > 1 && (
            <div className="flex justify-end">
              <div className="inline-flex items-center gap-2 text-xs text-gray-600">
                <button
                  type="button"
                  className="p-1 rounded border border-gray-200 disabled:opacity-50"
                  disabled={(activeTry?.index || 1) <= 1}
                  onClick={() => {
                    const targetIndex = (activeTry?.index || 1) - 1;
                    const target = tries.find((t) => t.index === targetIndex);
                    if (target) setActiveTryId(target.id);
                  }}
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                <span>
                  {activeTry?.index || 1}/{tries.length}
                </span>
                <button
                  type="button"
                  className="p-1 rounded border border-gray-200 disabled:opacity-50"
                  disabled={(activeTry?.index || 1) >= tries.length}
                  onClick={() => {
                    const targetIndex = (activeTry?.index || 1) + 1;
                    const target = tries.find((t) => t.index === targetIndex);
                    if (target) setActiveTryId(target.id);
                  }}
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
          <div className="flex justify-end">
            <button
              type="button"
              className="px-6 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
              onClick={() => advance(visibleElements.length)}
            >
              Finish
            </button>
          </div>
        </div>
      )}
    </form>
  );
}
