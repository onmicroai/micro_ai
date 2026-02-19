"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "react-toastify";
import { MessageCircle, RotateCcw } from "lucide-react";

import SkeletonLoader from "@/components/layout/loading/skeletonLoader";
import CurrentElementFlow from "@/components/CurrentElementFlowV2";
import ContinuationInterface from "@/components/ContinuationInterface";
import RemixBanner from "@/components/RemixBanner";
import EditAppLink from "@/components/EditAppLink";
import DebugInformation from "@/components/DebugInformation";

import { useSurveyStore } from "@/store/runtimeSurveyStore";
import { useConversationStore } from "@/store/conversationStore";
import { useUserStore } from "@/store/userStore";
import { useAuth } from "@/context/AuthContext";

import { checkRole } from "@/utils/checkRoles";
import { checkIsPublic } from "@/utils/checkAppPrivacy";
import axiosInstance from "@/utils/axiosInstance";

type AppRuntimeViewProps = {
  hashId: string;
};

export default function AppRuntimeView({ hashId }: AppRuntimeViewProps) {
  const searchParams = useSearchParams();
  const launchId = searchParams.get("lid");

  const [showThankYouMessage, setShowThankYouMessage] = useState(false);
  const [flowKey, setFlowKey] = useState(0);
  const [showRemixBanner, setShowRemixBanner] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [appId, setAppId] = useState<number | null>(null);

  const { user } = useUserStore();
  const { isAuthenticated } = useAuth();
  const userId = user?.id ?? null;

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
  } = useSurveyStore();

  const {
    currentConversation,
    conversations,
    reset: resetConversations,
  } = useConversationStore();

  // Check if there are existing continuation messages for auto-expansion
  const [isContinuationExpanded, setIsContinuationExpanded] = useState(false);

  // Update expansion state when answers change (e.g., on page refresh)
  useEffect(() => {
    const existingMessages = answers.continuation_chat?.value || [];
    const hasExistingMessages =
      Array.isArray(existingMessages) && existingMessages.length > 0;

    if (hasExistingMessages && !isContinuationExpanded) {
      setIsContinuationExpanded(true);
    }
  }, [answers.continuation_chat?.value, isContinuationExpanded]);

  const [roles, setRoles] = useState({
    isOwner: false,
    isAdmin: false,
  });
  const [rolesLoaded, setRolesLoaded] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const signal = controller.signal;

    /**
     * Initialize the app by checking if it is public and fetching the app data.
     * @param signal - The AbortSignal to cancel the request.
     */
    const initializeApp = async (signal: AbortSignal) => {
      if (hashId) {
        const { isPublic } = await checkIsPublic(hashId, signal);

        const wasAppUpdated = await fetchApp(hashId, !isPublic, signal);

        if (wasAppUpdated) {
          resetConversations();
        }
      }
    };

    initializeApp(signal);

    return () => {
      try {
        //controller.abort();
      } catch {}
    };
  }, [hashId, fetchApp, resetConversations]);

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
    const nextAppId = Number(surveyJson.id) || null;

    // Always set appId when surveyJson is available
    if (nextAppId !== undefined) {
      setAppId(nextAppId);
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
      if (!isAuthenticated || !hashId) {
        return;
      }

      try {
        const roleResult = await checkRole(hashId, userId, signal);
        if (!roleResult.error) {
          const lowerRoles = roleResult.roles.map((r: string) =>
            r.toLowerCase(),
          );
          setRoles({
            isOwner: lowerRoles.includes("owner"),
            isAdmin: lowerRoles.includes("admin"),
          });
          setRolesLoaded(true);
        } else {
          console.warn(
            "Role check returned error; banner suppressed until retry",
          );
        }
      } catch (error) {
        console.error("Error checking roles:", error);
      }
    };

    checkRoles();

    return () => abortController.abort();
  }, [userId, hashId, isAuthenticated]);

  /* ------------------------------------------------------------------
   * Decide when the Remix ("Like this app?") banner should be visible.
   * ------------------------------------------------------------------
   * Rules:
   *  1. Unauthenticated visitors → show banner.
   *  2. Authenticated visitors → show banner only if NOT owner/admin.
   *  3. If the banner has been manually dismissed this session, keep it
   *     hidden for the rest of the page-view.
   *  4. The banner starts hidden (useState(false)).
   * ------------------------------------------------------------------
   */
  useEffect(() => {
    // Do nothing if the user has already dismissed it.
    if (bannerDismissed) return;

    // Show for guests immediately.
    if (!isAuthenticated) {
      setShowRemixBanner(true);
      return;
    }

    // For authenticated users, wait until role check completes.
    if (rolesLoaded) {
      const shouldShow = !roles.isOwner && !roles.isAdmin;
      setShowRemixBanner(shouldShow);
    }
  }, [
    isAuthenticated,
    rolesLoaded,
    roles.isOwner,
    roles.isAdmin,
    bannerDismissed,
  ]);

  return (
    <div className="bg-gray-50 min-h-screen dark:bg-black-dark pb-16">
      <div className="max-w-7xl mx-auto px-4 py-6 bg-gray-50 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-md overflow-hidden p-6">
          {(roles.isOwner || roles.isAdmin) && <EditAppLink hashId={hashId} />}
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

          {appId !== null && (
            <div className="mt-6">
              <CurrentElementFlow
                key={flowKey}
                appId={appId}
                userId={userId}
                isOwner={roles.isOwner}
                isAdmin={roles.isAdmin}
                onComplete={() => setShowThankYouMessage(true)}
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

            {/* Chat Continuation Interface */}
            <ContinuationInterface
              appId={appId}
              userId={userId}
              surveyJson={surveyJson}
              answers={answers}
              isOwner={roles.isOwner}
              isAdmin={roles.isAdmin}
              isExpanded={isContinuationExpanded}
              onToggleExpanded={() =>
                setIsContinuationExpanded(!isContinuationExpanded)
              }
            />

            <div className="mt-4 flex justify-between items-center">
              <button
                onClick={() => {
                  resetConversations();
                  softResetSurveyStore();
                  setShowThankYouMessage(false);
                  setIsContinuationExpanded(false);
                  setFlowKey((k) => k + 1);
                  toast.success("App restarted successfully");
                }}
                className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                Restart the app
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

          {(roles.isOwner || roles.isAdmin) && (
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
      </div>

      {/* Remix banner – displayed according to the rules in the effect above */}
      {!bannerDismissed && showRemixBanner && appId && (
        <RemixBanner
          onDismiss={() => {
            setBannerDismissed(true);
            setShowRemixBanner(false);
          }}
          appId={appId}
          copyAllowed={!!surveyJson?.copyAllowed}
        />
      )}
    </div>
  );
}
