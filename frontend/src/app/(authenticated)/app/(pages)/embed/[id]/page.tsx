"use client";

import { useEffect, useState, useCallback } from "react";
import SkeletonLoader from "@/components/layout/loading/skeletonLoader";
import { toast } from 'react-toastify';
import CurrentElementFlow from "@/components/CurrentElementFlowV2";
import { useSurveyStore } from '@/store/runtimeSurveyStore';
import { useConversationStore } from '@/store/conversationStore';
import { useUserStore } from "@/store/userStore";
import DebugInformation from "../../../../../../components/DebugInformation";
import { checkIsOwner, checkIsAdmin } from '@/utils/checkRoles';
import { checkIsPublic } from '@/utils/checkAppPrivacy';
import axiosInstance from '@/utils/axiosInstance';
import { useSearchParams } from 'next/navigation';
import ContinuationInterface from '@/components/ContinuationInterface';
import { RotateCcw, MessageCircle } from 'lucide-react';

type PageParams = {
   params: {
      id: string;
   };
};

const EmbeddedSurveyDisplay = ({ params }: PageParams) => {
   const searchParams = useSearchParams();
   const launchId = searchParams.get('lid');
   const [showThankYouMessage, setShowThankYouMessage] = useState(false);
   const [flowKey, setFlowKey] = useState(0);
   const { user } = useUserStore();
   const userId = Number(user?.id);
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
   } = useSurveyStore();
   
   // Check if there are existing continuation messages for auto-expansion
   const [isContinuationExpanded, setIsContinuationExpanded] = useState(false);
   
   // Update expansion state when answers change (e.g., on page refresh)
   useEffect(() => {
      const existingMessages = answers.continuation_chat?.value || [];
      const hasExistingMessages = Array.isArray(existingMessages) && existingMessages.length > 0;
      
      if (hasExistingMessages && !isContinuationExpanded) {
         setIsContinuationExpanded(true);
      }
   }, [answers.continuation_chat?.value, isContinuationExpanded]);
   const {
      currentConversation,
      conversations,
      reset: resetConversations,
   } = useConversationStore();
   const [isOwner, setIsOwner] = useState(false);
   const [isAdmin, setIsAdmin] = useState(false);
   const [embedAllowed, setEmbedAllowed] = useState<boolean | null>(null);

   useEffect(() => {
      const controller = new AbortController();
      const signal = controller.signal;
      const initializeApp = async () => {
         if (hashId) {
            const { isPublic } = await checkIsPublic(hashId, signal);

            // Check embed access based on parent domain (document.referrer)
            try {
               const referrer = document.referrer || "";
               let domain = "";
               if (referrer) {
                  try {
                     const url = new URL(referrer);
                     domain = url.hostname.toLowerCase();
                  } catch {
                     // Fallback: naive extraction
                     const match = referrer.match(/^https?:\/\/([^/]+)/i);
                     if (match && match[1]) {
                        domain = match[1].toLowerCase();
                     }
                  }
               }

               if (domain) {
                  const api = axiosInstance();
                  const resp = await api.post(
                     `/api/microapps/embed-access/${hashId}`,
                     { domain },
                     { signal }
                  );
                  const allowed = resp.data?.data?.allowed ?? false;
                  setEmbedAllowed(allowed);
                  if (!allowed) {
                     return;
                  }
               } else {
                  // If no referrer, treat as not allowed for restricted apps; appFetchError handling will show generic error
                  setEmbedAllowed(false);
                  return;
               }
            } catch (e) {
               console.error("Error checking embed access:", e);
               setEmbedAllowed(false);
               return;
            }

            const wasAppUpdated = await fetchApp(hashId, !isPublic, signal);
            
            if (wasAppUpdated) {
               resetConversations();
            }
         }
      };

      initializeApp();

      return () => {
         controller.abort();
      };
   }, [hashId, fetchApp, resetConversations]);

   useEffect(() => {
      if ((appFetchError.message !== null)) {
         const errorStatus = appFetchError.status;
         if (errorStatus && errorStatus >= 400 && errorStatus < 500) {
            toast.error("Page not found.", { theme: "colored" });
         } else {
            toast.error(`Error fetching app: ${appFetchError}`, { theme: "colored" });
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
         console.error('Error submitting LTI score:', error);
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
         if (userId && hashId) {
            const [ownerResult, adminResult] = await Promise.all([
               checkIsOwner(hashId, userId, signal),
               checkIsAdmin(hashId, userId, signal)
            ]);
            setIsOwner(ownerResult.isOwner);
            setIsAdmin(adminResult.isAdmin);
         }
      };

      checkRoles();

      return () => abortController.abort();
   }, [userId, hashId]);

   // If we haven't checked embed access yet, or app is loading, show skeleton as before
   if (embedAllowed === null || loading) {
      return (
         <div className="min-h-screen bg-gray-50">
            <div className="max-w-3xl mx-auto px-4 py-4">
               <SkeletonLoader />
            </div>
         </div>
      );
   }

   if (!embedAllowed) {
      return (
         <div className="min-h-screen bg-gray-50 flex items-center justify-center">
            <div className="text-center max-w-md px-4">
               <h1 className="text-lg font-semibold text-gray-900">
                  This app is not available on this site.
               </h1>
               <p className="mt-2 text-sm text-gray-600">
                  The app owner has restricted embedding to specific domains. If you think this is a mistake,
                  please contact the app owner.
               </p>
            </div>
         </div>
      );
   }

   return (
      <div className="min-h-screen bg-gray-50">
         <div className="max-w-3xl mx-auto px-4 py-4">
            {surveyJson?.title && (
               <h1 className="text-xl/loose font-semibold text-gray-900">{surveyJson.title}</h1>
            )}
            {surveyJson?.description && (
               <p className="mt-1 text-sm/6 text-gray-600">{surveyJson.description}</p>
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
                     onComplete={() => setShowThankYouMessage(true)}
                     isOwner={isOwner}
                     isAdmin={isAdmin}
                  />
               </div>
            )}

            
               <div>
                  {showThankYouMessage && (
                     <div className="mt-6 bg-green-50 border border-green-200 rounded-lg p-4">
                        <div className="text-sm/6  max-w-none text-green-800" dangerouslySetInnerHTML={{ __html: surveyJson?.completedHtml || "" }} />
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
                     onToggleExpanded={() => setIsContinuationExpanded(!isContinuationExpanded)}
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