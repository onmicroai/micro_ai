"use client";

import { useEffect, useState, useCallback } from "react";
import SkeletonLoader from "@/components/layout/loading/skeletonLoader";
import { toast } from "react-toastify";
import CurrentElementFlow from "@/components/CurrentElementFlowV2";
import { useSurveyStore } from "@/store/runtimeSurveyStore";
import { useConversationStore } from "@/store/conversationStore";
import { useUserStore } from "@/store/userStore";
import DebugInformation from "../../../../../../components/DebugInformation";
import { checkIsOwner, checkIsAdmin } from "@/utils/checkRoles";
import { checkIsPublic } from "@/utils/checkAppPrivacy";
import axiosInstance from "@/utils/axiosInstance";
import { useSearchParams } from "next/navigation";
import ContinuationInterface from "@/components/ContinuationInterface";
import { RotateCcw, MessageCircle } from "lucide-react";
import { getContinuationChatKey } from "@/utils/continuationChatKey";

/** Parent frames may post `{ type: EMBED_RESTART_MESSAGE_TYPE }` to restart the embed (any origin). */
const EMBED_RESTART_MESSAGE_TYPE = "microai-embed-restart";

type PageParams = {
  params: {
    id: string;
  };
};

const EmbeddedSurveyDisplay = ({ params }: PageParams) => {
  const searchParams = useSearchParams();
  const launchId = searchParams.get("lid");
  const [showThankYouMessage, setShowThankYouMessage] = useState(false);
  const [flowKey, setFlowKey] = useState(0);
  const { user } = useUserStore();
  const userId = user?.id ?? null;
  const hashId = params.id?.toString() || "";
  const [appId, setAppId] = useState<number | null>(null);
  const {
    surveyJson,
    loading,
    promptLoading,
    sendPromptError,
    appFetchError,
    answers,
    images,
    fetchApp,
    softReset: softResetSurveyStore,
    setCurrentUserId,
  } = useSurveyStore();

  const { currentConversation, conversations, resetAppConversation } =
    useConversationStore();

  useEffect(() => {
    setCurrentUserId(userId != null ? String(userId) : null);
  }, [userId, setCurrentUserId]);

  // Check if there are existing continuation messages for auto-expansion
  const [isContinuationExpanded, setIsContinuationExpanded] = useState(false);

  // Update expansion state when answers change (e.g., on page refresh)
  useEffect(() => {
    const elementName = getContinuationChatKey(appId, userId);
    const existingMessages = answers[elementName]?.value || [];
    const hasExistingMessages =
      Array.isArray(existingMessages) && existingMessages.length > 0;

    if (hasExistingMessages && !isContinuationExpanded) {
      setIsContinuationExpanded(true);
    }
  }, [answers, appId, userId, isContinuationExpanded]);
  const [isOwner, setIsOwner] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const signal = controller.signal;
    const initializeApp = async () => {
      if (hashId) {
        const embedOrigin =
          typeof document !== "undefined" ? document.referrer || "" : "";
        const { isPublic, embedAllowed } = await checkIsPublic(
          hashId,
          signal,
          embedOrigin,
        );
        // Treat as "public" (no auth) when app is public OR embed is allowed from this origin
        const accessibleWithoutAuth = isPublic || embedAllowed === true;

        await fetchApp(
          hashId,
          !accessibleWithoutAuth,
          signal,
          embedOrigin || undefined,
        );
      }
    };

    initializeApp();

    return () => {
      controller.abort();
    };
  }, [hashId, fetchApp]);

  useEffect(() => {
    if (appFetchError.message !== null) {
      const errorStatus = appFetchError.status;
      if (errorStatus && errorStatus >= 400 && errorStatus < 500) {
        toast.error("Page not found.", { theme: "colored" });
      } else {
        toast.error(`Error fetching app: ${appFetchError}`, {
          theme: "colored",
        });
      }
    }
  }, [appFetchError]);

  useEffect(() => {
    if (sendPromptError) {
      toast.error(sendPromptError, { theme: "colored" });
    }
  }, [sendPromptError]);

  useEffect(() => {
    if (!surveyJson) return;
    const appId = Number(surveyJson.id) || null;
    if (appId !== undefined) {
      setAppId(appId);
    }
  }, [surveyJson]);

  const submitLTIScore = useCallback(async () => {
    if (!launchId) return;

    try {
      const api = axiosInstance();
      await api.post(`/lti/api/score/${launchId}/1/1/`);
    } catch (error) {
      console.error("Error submitting LTI score:", error);
    }
  }, [launchId]);

  useEffect(() => {
    if (!showThankYouMessage) return;
    if (promptLoading) return;
    submitLTIScore();
  }, [showThankYouMessage, promptLoading, submitLTIScore]);

  useEffect(() => {
    const abortController = new AbortController();
    const signal = abortController.signal;

    const checkRoles = async () => {
      if (userId == null || !hashId) {
        return;
      }

      try {
        const [ownerResult, adminResult] = await Promise.all([
          checkIsOwner(hashId, userId, signal),
          checkIsAdmin(hashId, userId, signal),
        ]);
        setIsOwner(ownerResult.isOwner);
        setIsAdmin(adminResult.isAdmin);
      } catch (error: unknown) {
        const name =
          error && typeof error === "object" && "name" in error
            ? String((error as { name?: string }).name)
            : "";
        if (name === "AbortError" || name === "CanceledError") {
          return;
        }
        console.error("Error checking roles:", error);
      }
    };

    checkRoles();

    return () => abortController.abort();
  }, [userId, hashId]);

  const restartEmbeddedApp = useCallback(() => {
    if (appId) {
      resetAppConversation(
        String(appId),
        userId != null ? String(userId) : undefined,
      );
    }
    softResetSurveyStore();
    setShowThankYouMessage(false);
    setIsContinuationExpanded(false);
    setFlowKey((k) => k + 1);
    toast.success("App restarted successfully");
  }, [appId, userId, resetAppConversation, softResetSurveyStore]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const data = event.data;
      if (data == null || typeof data !== "object" || Array.isArray(data)) {
        return;
      }
      if ((data as { type?: unknown }).type !== EMBED_RESTART_MESSAGE_TYPE) {
        return;
      }
      restartEmbeddedApp();
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [restartEmbeddedApp]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-4">
        <div className="bg-white rounded-xl shadow-md overflow-hidden p-6">
          {surveyJson?.title && (
            <h1 className="text-xl/loose font-semibold text-gray-900">
              {surveyJson.title}
            </h1>
          )}
          {surveyJson?.description && (
            <p className="mt-1 text-sm/6 text-gray-600">
              {surveyJson.description}
            </p>
          )}

          {loading && (
            <div className="flex justify-center py-8">
              <SkeletonLoader />
            </div>
          )}

          {!loading && (surveyJson?.elements?.length || 0) === 0 && (
            <p className="text-gray-600 text-center py-8">
              This application doesn&apos;t contain any questions.
            </p>
          )}

          {appId !== null && !loading && (
            <div className="mt-6">
              <CurrentElementFlow
                key={flowKey}
                appId={appId}
                userId={userId}
                onComplete={() => setShowThankYouMessage(true)}
                isOwner={isOwner}
                isAdmin={isAdmin}
              />
            </div>
          )}

          <div>
            {showThankYouMessage && (
              <div className="mt-6 bg-green-50 border border-green-200 rounded-lg p-4">
                <div
                  className="text-sm/6  max-w-none text-green-800"
                  dangerouslySetInnerHTML={{
                    __html: surveyJson?.completedHtml || "",
                  }}
                />
              </div>
            )}
          </div>

          {/* Chat Continuation Interface */}
          <ContinuationInterface
            appId={appId}
            userId={userId}
            surveyJson={surveyJson}
            answers={answers}
            isOwner={isOwner}
            isAdmin={isAdmin}
            isExpanded={isContinuationExpanded}
            onToggleExpanded={() =>
              setIsContinuationExpanded(!isContinuationExpanded)
            }
          />

          <div className="mt-4 flex justify-between items-center">
            <button
              onClick={restartEmbeddedApp}
              className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              Restart
            </button>

            {showThankYouMessage && !isContinuationExpanded && (
              <button
                onClick={() => setIsContinuationExpanded(true)}
                className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
              >
                <MessageCircle className="w-4 h-4" />
                Continue the conversation
              </button>
            )}
          </div>
        </div>
      </div>

      {(isOwner || isAdmin) && (
        <DebugInformation
          surveyJson={surveyJson}
          currentConversation={currentConversation}
          conversations={conversations}
          answers={answers}
          base64Images={images}
          statsData={null}
        />
      )}
    </div>
  );
};

export default EmbeddedSurveyDisplay;
