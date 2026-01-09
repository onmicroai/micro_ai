"use client";

import { useMemo, useState, FormEvent } from "react";
import evaluateVisibility from "@/utils/evaluateVisibility";
import { validateForm } from "@/utils/validateForms";
import { useSurveyStore } from "@/store/runtimeSurveyStore";
import { useConversationStore } from "@/store/conversationStore";
import RenderQuestion from "./RenderQuestion";
import injectValuesIntoPrompt from "@/utils/injectValuesIntoPrompt";
import type { Answers, ConditionalLogic, Element, Prompt } from "@/app/(authenticated)/app/types";
import {
  AIResponseDisplay,
  RunScoreDisplay,
  passedTheRubricMinScore,
} from "@/utils/phaseResultDisplay";
import SkeletonLoader from "@/components/layout/loading/skeletonLoader";

const STOP_TYPES = new Set<Element["type"]>(["aiResponse", "fixedResponse", "scoring"]);

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
  const [cursor, setCursor] = useState(0);
  const [fixedResponseShown, setFixedResponseShown] = useState<string | null>(null);

  const appElements = useMemo(() => {
    const els = surveyJson?.elements;
    return Array.isArray(els) ? (els as Element[]) : [];
  }, [surveyJson]);

  const { visibleChunk, stopElement, stopIndex } = useMemo(() => {
    const chunk: Element[] = [];
    let i = cursor;

    while (i < appElements.length) {
      const el = appElements[i];
      if (isStopElement(el)) break;
      chunk.push(el);
      i += 1;
    }

    const stop = i < appElements.length ? appElements[i] : null;
    return {
      visibleChunk: chunk,
      stopElement: stop && isStopElement(stop) ? stop : null,
      stopIndex: stop && isStopElement(stop) ? i : null,
    };
  }, [appElements, cursor]);

  const currentRun = useMemo(() => {
    if (!currentConversation?.runs?.length) return null;
    if (stopIndex === null) return null;
    return (
      currentConversation.runs
        .filter((run) => run.phaseIndex === stopIndex)
        .sort((a, b) => b.createdAt - a.createdAt)[0] || null
    );
  }, [currentConversation?.runs, stopIndex]);

  const advance = (nextIndex: number) => {
    setFixedResponseShown(null);
    setErrors([]);
    setCursor(nextIndex);
    if (nextIndex >= appElements.length) {
      onComplete?.();
    }
  };

  const handleRun = async (event: FormEvent) => {
    event.preventDefault();

    if (!surveyJson) return;
    if (!stopElement || stopIndex === null) return;

    // Validate only the visible chunk inputs
    const newErrors = validateForm(visibleChunk, answers);
    if (newErrors.length > 0) {
      setErrors(newErrors);
      return;
    }

    if (stopElement.type === "fixedResponse") {
      const text = injectValuesIntoPrompt(stopElement.text || "", answers);
      setFixedResponseShown(text);
      return;
    }

    if (stopElement.type === "aiResponse") {
      const prompts: Prompt[] = (stopElement.instructions || []).map((inst, idx) => ({
        id: `${stopElement.id}-p-${idx}`,
        name: `${stopElement.name}-p-${idx}`,
        type: "prompt",
        text: inst.text || "",
        conditionalLogic: inst.conditionalLogic,
      }));

      const res = await sendPrompts(prompts, answers, appId, surveyJson, stopIndex, userId, false);
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
          minScore: typeof stopElement.minScore === "number" ? stopElement.minScore : 0,
        }
      );

      if (res.run_passed === false) return;
      advance(stopIndex + 1);
      return;
    }
  };

  if (!surveyJson) return null;

  if (cursor >= appElements.length) {
    return (
      <div className="space-y-4">
        <div
          className="prose max-w-none"
          dangerouslySetInnerHTML={{ __html: surveyJson.completedHtml || "You've reached the end." }}
        />
      </div>
    );
  }

  return (
    <form onSubmit={handleRun} className="space-y-6">
      {visibleChunk.map((element) => {
        const isVisible = evaluateVisibility(
          (element.conditionalLogic || {}) as ConditionalLogic,
          answers as Answers
        );

        if (!isVisible) return null;

        if (element.type === "title") {
          return (
            <div key={element.id} className="pt-2">
              <h2 className="text-base/7 font-semibold text-gray-900">
                {element.text || element.label}
              </h2>
            </div>
          );
        }

        return (
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
            disabled={false}
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
        );
      })}

      {/* Stop element card */}
      {stopElement && stopIndex !== null && (
        <div className="mt-6 border rounded-lg p-4 bg-white">
          {stopElement.type === "aiResponse" && (
            <div className="space-y-2">
              <div className="text-sm font-medium text-gray-900">AI Response</div>
              <div className="text-sm text-gray-600">Click Run to generate the next response.</div>
            </div>
          )}

          {stopElement.type === "fixedResponse" && (
            <div className="space-y-2">
              <div className="text-sm font-medium text-gray-900">Response</div>
              {fixedResponseShown ? (
                <div className="whitespace-pre-wrap text-sm text-gray-800">{fixedResponseShown}</div>
              ) : (
                <div className="text-sm text-gray-600">Click Continue to reveal the response.</div>
              )}
            </div>
          )}

          {stopElement.type === "scoring" && (
            <div className="space-y-2">
              <div className="text-sm font-medium text-gray-900">Scoring</div>
              <div className="text-sm text-gray-600">Click Run to score the submission.</div>
            </div>
          )}

          {(() => {
            if (!currentRun) return null;
            return (
              <>
                <AIResponseDisplay run={currentRun} isOwner={isOwner} isAdmin={isAdmin} />
                <RunScoreDisplay run={currentRun} />
                {!promptLoading && !passedTheRubricMinScore(currentRun) && (
                  <div className="mt-4 border rounded-lg p-3 bg-red-50">
                    <p className="text-sm/6 text-red-700">
                      Did not pass the Minimum Score. Please try again.
                    </p>
                  </div>
                )}
              </>
            );
          })()}

          {promptLoading ? (
            <div className="mt-4">
              <SkeletonLoader />
            </div>
          ) : (
            <div className="mt-4 flex justify-end">
              <button
                type="submit"
                className="px-6 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                onClick={() => {
                  // For fixed response, second click advances after showing text
                  if (stopElement.type === "fixedResponse" && fixedResponseShown) {
                    advance(stopIndex + 1);
                  }
                }}
              >
                {stopElement.type === "aiResponse"
                  ? "Run"
                  : stopElement.type === "scoring"
                    ? "Run"
                    : fixedResponseShown
                      ? "Continue"
                      : "Continue"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* No stop element left → end */}
      {!stopElement && stopIndex === null && (
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

