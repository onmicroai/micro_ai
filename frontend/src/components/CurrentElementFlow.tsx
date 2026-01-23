"use client";

import { useMemo, useRef, useState, FormEvent } from "react";
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
  const fixedResponseRunTokenRef = useRef<Record<string, number>>({});

  const appElements = useMemo(() => {
    const els = surveyJson?.elements;
    return Array.isArray(els) ? (els as Element[]) : [];
  }, [surveyJson]);

  const { stopIndex, stopElement, visibleUntil } = useMemo(() => {
    let i = cursor;
    while (i < appElements.length && !isStopElement(appElements[i])) {
      i += 1;
    }
    const hasStop = i < appElements.length && isStopElement(appElements[i]);
    const stopIdx = hasStop ? i : null;
    const stopEl = hasStop ? appElements[i] : null;
    const until = hasStop ? i : appElements.length - 1;
    return { stopIndex: stopIdx, stopElement: stopEl, visibleUntil: until };
  }, [appElements, cursor]);

  const advance = (nextIndex: number) => {
    setErrors([]);
    setCursor(nextIndex);
    if (nextIndex >= appElements.length) {
      onComplete?.();
    }
  };

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

  const handleRun = async (event: FormEvent) => {
    event.preventDefault();

    if (!surveyJson) return;
    if (!stopElement || stopIndex === null) return;

    // Validate only the current segment inputs (cursor..stopIndex-1)
    const segmentInputs = appElements
      .slice(cursor, stopIndex)
      .filter((el) => !isStopElement(el));
    const newErrors = validateForm(segmentInputs, answers);
    if (newErrors.length > 0) {
      setErrors(newErrors);
      return;
    }

    if (stopElement.type === "fixedResponse") {
      const text = injectValuesIntoPrompt(stopElement.text || "", answers);
      setFixedResponsesById((prev) => ({ ...prev, [stopElement.id]: text }));
      const alreadyDisplayed = fixedResponseDisplayedById[stopElement.id];
      const isAnimating = fixedResponseAnimatingById[stopElement.id];
      if (alreadyDisplayed === undefined && !isAnimating) {
        startFixedResponseTypewriter(stopElement.id, text);
      }
      return;
    }

    if (stopElement.type === "aiResponse") {
      const prompts: Prompt[] = (stopElement.instructions || []).map(
        (inst, idx) => ({
          id: `${stopElement.id}-p-${idx}`,
          name: `${stopElement.name}-p-${idx}`,
          type: "prompt",
          text: inst.text || "",
          conditionalLogic: inst.conditionalLogic,
        })
      );

      const res = await sendPrompts(
        prompts,
        answers,
        appId,
        surveyJson,
        stopIndex,
        userId,
        false
      );
      if (res.run_passed === false) return;
      advance(stopIndex + 1);
      return;
    }

    if (stopElement.type === "scoring") {
      const prompt: Prompt[] = [
        {
          id: `${stopElement.id}-score`,
          name: `${stopElement.name}-score`,
          type: "prompt",
          text: ".",
        },
      ];

      const res = await sendPrompts(
        prompt,
        answers,
        appId,
        surveyJson,
        stopIndex,
        userId,
        false,
        false,
        {
          scoredPhase: true,
          rubric: stopElement.rubric || "",
          minScore:
            typeof stopElement.minScore === "number" ? stopElement.minScore : 0,
        }
      );

      const scoringIsRequired = stopElement.isRequired !== false;
      if (res.run_passed === false && scoringIsRequired) return;
      advance(stopIndex + 1);
      return;
    }
  };

  if (!surveyJson) return null;

  const isComplete = cursor >= appElements.length;

  const visibleElements = isComplete
    ? appElements
    : appElements.slice(0, Math.min(visibleUntil + 1, appElements.length));

  return (
    <form onSubmit={handleRun} className="space-y-6">
      {visibleElements.map((element, idx) => {
        const isVisible = evaluateVisibility(
          (element.conditionalLogic || {}) as ConditionalLogic,
          answers as Answers
        );
        if (!isVisible) return null;

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
                handleInputChange={handleInputChange}
                setInputValue={setInputValue}
                setImages={setImages}
                visible={isVisible}
                appId={appId}
                userId={userId}
                surveyJson={surveyJson}
                currentPhaseIndex={stopIndex ?? cursor}
                isOwner={isOwner}
                isAdmin={isAdmin}
              />
            </div>
          );
        }

        // Stop card rendering (aiResponse/fixedResponse/scoring)
        const runForThisStop =
          currentConversation?.runs
            ?.filter((run) => run.phaseIndex === idx)
            .sort((a, b) => b.createdAt - a.createdAt)[0] || null;
        const scoringIsRequired =
          element.type === "scoring" ? element.isRequired !== false : false;
        const scoringFailed =
          element.type === "scoring" && runForThisStop
            ? !passedTheRubricMinScore(runForThisStop)
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
            ? (element.instructions || []).map((inst: any, pIdx: number) => ({
                id: `${element.id}-preview-${pIdx}`,
                name: `${element.name}-preview-${pIdx}`,
                type: "prompt",
                text: inst?.text || "",
                conditionalLogic: inst?.conditionalLogic,
              }))
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
                ) : element.type === "scoring" && scoringIsRequired && scoringFailed ? null : (
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
                        if (!hasFull) return;

                        // If animating or partially shown: click skips to full reveal (no submit)
                        if (anim || displayed !== full) {
                          e.preventDefault();
                          revealFullFixedResponse(element.id, full);
                          return;
                        }

                        // If fully shown: click advances (no submit)
                        if (displayed === full) {
                          e.preventDefault();
                          advance(idx + 1);
                          return;
                        }

                        // Otherwise: allow submit.
                      }}
                    >
                      {element.type === "aiResponse"
                        ? "Continue"
                        : element.type === "scoring"
                        ? "Continue"
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
            onClick={() => advance(appElements.length)}
          >
            Finish
          </button>
        </div>
      )}
    </form>
  );
}
