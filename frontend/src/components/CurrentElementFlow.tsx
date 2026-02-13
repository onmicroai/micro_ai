"use client";

import { useMemo, useRef, useState, FormEvent, useEffect, useCallback } from "react";
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

const STOP_TYPES = new Set<Element["type"]>([
  "aiResponse",
  "fixedResponse",
  "scoring",
]);

function isStopElement(el: Element): boolean {
  return STOP_TYPES.has(el.type);
}

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
    errors,
    promptLoading,
    setErrors,
    setElements,
    setImages,
    setInputValue,
    handleInputChange,
    sendPrompts,
  } = useSurveyStore();

  const { currentConversation } = useConversationStore();
  /**
   * cursor: start index of the active segment (everything before is completed/locked).
   */
  const [cursor, setCursor] = useState(0);
  /**
   * Fixed responses are "revealed" without an API call; once revealed, keep them visible
   * when the UI accumulates.
   */
  const [fixedResponsesById, setFixedResponsesById] = useState<
    Record<string, string>
  >({});
  /**
   * Fixed response "stream-like" typewriter display state (frontend only).
   */
  const [fixedResponseDisplayedById, setFixedResponseDisplayedById] = useState<
    Record<string, string>
  >({});
  const [fixedResponseAnimatingById, setFixedResponseAnimatingById] = useState<
    Record<string, boolean>
  >({});
  const [retryDirtyStopIds, setRetryDirtyStopIds] = useState<Record<string, boolean>>(
    {},
  );
  const fixedResponseRunTokenRef = useRef<Record<string, number>>({});

  const appElements = useMemo(() => {
    const els = surveyJson?.elements;
    return Array.isArray(els) ? (els as Element[]) : [];
  }, [surveyJson]);

  useEffect(() => {
    setElements(appElements);
  }, [appElements, setElements]);

  const visibleElements = useMemo(() => {
    return appElements
      .map((element, originalIndex) => {
        const isVisible = evaluateVisibility(
          (element.conditionalLogic || {}) as ConditionalLogic,
          answers as Answers
        );
        return isVisible ? { element, originalIndex } : null;
      })
      .filter((entry): entry is { element: Element; originalIndex: number } =>
        Boolean(entry)
      );
  }, [appElements, answers]);

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

  const previousActiveOriginalIndexRef = useRef<number | null>(null);

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

  const startFixedResponseTypewriter = (id: string, fullText: string) => {
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
  };

  const revealFullFixedResponse = (id: string, fullText: string) => {
    fixedResponseRunTokenRef.current[id] =
      (fixedResponseRunTokenRef.current[id] || 0) + 1;
    setFixedResponseAnimatingById((prev) => ({ ...prev, [id]: false }));
    setFixedResponseDisplayedById((prev) => ({ ...prev, [id]: fullText }));
  };

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
        false
      );
      if (res.run_passed === false) return;
      advance(stopIndex + 1);
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
        }
      );
      setRetryDirtyStopIds((prev) => {
        if (!prev[stop.id]) return prev;
        const next = { ...prev };
        delete next[stop.id];
        return next;
      });

      const scoringIsRequired = stop.isRequired !== false;
      if (res.run_passed === false && scoringIsRequired) return;
      advance(stopIndex + 1);
      return;
    }
  };

  if (!surveyJson) return null;

  const isComplete = cursor >= visibleElements.length;
  const activeStopOriginalIndex = stopElement?.originalIndex ?? null;
  const activeStopRun =
    activeStopOriginalIndex === null
      ? null
      : currentConversation?.runs
          ?.filter((run) => run.phaseIndex === activeStopOriginalIndex)
          .sort((a, b) => b.createdAt - a.createdAt)[0] || null;
  const activeStopIsRequiredScoringFailed =
    stopElement?.element.type === "scoring" &&
    stopElement.element.isRequired !== false &&
    !!activeStopRun &&
    !passedTheRubricMinScore(activeStopRun);
  const markActiveScoringRetryDirty = useCallback(() => {
    if (!activeStopIsRequiredScoringFailed) return;
    const activeScoringStopId =
      stopElement?.element.type === "scoring" ? stopElement.element.id : null;
    if (!activeScoringStopId) return;
    setRetryDirtyStopIds((prev) =>
      prev[activeScoringStopId] ? prev : { ...prev, [activeScoringStopId]: true },
    );
  }, [activeStopIsRequiredScoringFailed, stopElement]);
  const handleInputChangeWithRetryMark: typeof handleInputChange = (e) => {
    markActiveScoringRetryDirty();
    handleInputChange(e);
  };
  const setInputValueWithRetryMark: typeof setInputValue = (
    name,
    value,
    otherValue,
    type,
  ) => {
    markActiveScoringRetryDirty();
    setInputValue(name, value, otherValue, type);
  };

  const visibleElementsForRender = isComplete
    ? visibleElements
    : visibleElements.slice(
        0,
        Math.min(visibleUntil + 1, visibleElements.length)
      );

  return (
    <form onSubmit={handleRun} className="space-y-6">
      {visibleElementsForRender.map(({ element, originalIndex }, idx) => {
        const isLocked = activeStopIsRequiredScoringFailed ? false : idx < cursor;
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
          return (
            <div className="mb-6" key={element.id}>
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
                disabled={isLocked}
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
            </div>
          );
        }

        // Stop card rendering (aiResponse/fixedResponse/scoring)
        const latestRunForThisStop =
          currentConversation?.runs
            ?.filter((run) => run.phaseIndex === originalIndex)
            .sort((a, b) => b.createdAt - a.createdAt)[0] || null;
        const hideRunForDirtyRetry =
          element.type === "scoring" &&
          isActiveStop &&
          retryDirtyStopIds[element.id] === true;
        const runForThisStop = hideRunForDirtyRetry ? null : latestRunForThisStop;
        const scoringIsRequired =
          element.type === "scoring" ? element.isRequired !== false : false;
        const scoringFailed =
          element.type === "scoring" && latestRunForThisStop
            ? !passedTheRubricMinScore(latestRunForThisStop)
            : false;

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
                content={fixedDisplayed ?? ""}
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
                {promptLoading ? (
                  <div className="mt-4">
                    <SkeletonLoader />
                  </div>
                ) : (
                  <div className="mt-4 flex justify-end">
                    <button
                      type="submit"
                      className="px-6 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                      onClick={(e) => {
                        if (element.type !== "fixedResponse") return;
                        const hasFull = hasRevealedFixed;
                        const full = revealedFixed ?? "";
                        const displayed = fixedDisplayed ?? "";
                        const anim = fixedAnimating;

                        // If not revealed yet: allow submit → handleRun starts reveal animation.
                        if (!hasFull) {
                          e.currentTarget.blur();
                          return;
                        }

                        // If animating or partially shown: click skips to full reveal (no submit)
                        if (anim || displayed !== full) {
                          e.preventDefault();
                          e.currentTarget.blur();
                          revealFullFixedResponse(element.id, full);
                          return;
                        }

                        // If fully shown: click advances (no submit)
                        if (displayed === full) {
                          e.preventDefault();
                          e.currentTarget.blur();
                          advance(idx + 1);
                          return;
                        }

                        // Otherwise: allow submit.
                      }}
                    >
                      {element.type === "aiResponse"
                        ? "Continue"
                        : element.type === "scoring"
                        ? scoringIsRequired && scoringFailed
                          ? "Submit again"
                          : "Continue"
                        : revealedFixed
                        ? "Continue"
                        : "Continue"}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        );
      })}

      {/* No stop element left → end */}
      {!isComplete && !stopElement && stopIndex === null && (
        <div className="mt-6 flex justify-end">
          <button
            type="button"
            className="px-6 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
            onClick={() => advance(visibleElements.length)}
          >
            Finish
          </button>
        </div>
      )}
    </form>
  );
}
