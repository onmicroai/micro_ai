"use client";

import { useEffect, useState } from "react";
import SkeletonLoader from "@/components/layout/loading/skeletonLoader";
import { toast } from 'react-toastify';
import CompletedPhase from '@/components/CompletedPhases';
import CurrentPhase from '@/components/CurrentPhase';
import { useSurveyStore } from '@/store/runtimeSurveyStore';
import { useConversationStore } from '@/store/conversationStore';
import { useUserStore } from "@/store/userStore";
import DebugInformation from "../../../../../../components/DebugInformation";
import { checkIsOwner, checkIsAdmin } from '@/utils/checkRoles';
import { checkIsPublic } from '@/utils/checkAppPrivacy';
import axiosInstance from '@/utils/axiosInstance';
import { useSearchParams } from 'next/navigation';

type PageParams = {
   params: {
      id: string;
   };
};

const EmbeddedSurveyDisplay = ({ params }: PageParams) => {
   const searchParams = useSearchParams();
   const launchId = searchParams.get('lid');
   const [showThankYouMessage, setShowThankYouMessage] = useState(false);
   const { user } = useUserStore();
   const userId = Number(user?.id);
   const hashId = params.id?.toString() || "";
   const [appId, setAppId] = useState<number | null>(null);
   const {
      surveyJson,
      currentPhase,
      currentPhaseIndex,
      completedPhases,
      loading,
      promptLoading,
      sendPromptError,
      appFetchError,
      answers,
      images,
      fetchApp,
      setCurrentPhase,
      setElements,
      softReset: softResetSurveyStore,
   } = useSurveyStore();
   const {
      currentConversation,
      conversations,
      reset: resetConversations,
   } = useConversationStore();
   const [isOwner, setIsOwner] = useState(false);
   const [isAdmin, setIsAdmin] = useState(false);

   useEffect(() => {
      const controller = new AbortController();
      const signal = controller.signal;
      const initializeApp = async () => {
         if (hashId) {
            const { isPublic } = await checkIsPublic(hashId, signal);
            
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
      
      const newCurrentPhase = surveyJson.phases?.[currentPhaseIndex] || null;
      const appId = Number(surveyJson.id) || null;
      const newElements = newCurrentPhase?.elements || [];
      
      if ((newCurrentPhase && completedPhases.includes(currentPhaseIndex)) ||
          (completedPhases.length === surveyJson.phases.length)) {
         return;
      }
      
      if (appId !== undefined) {
         setAppId(appId);
      }
      
      if (newCurrentPhase !== null) {
         setCurrentPhase(newCurrentPhase);
         setElements(newElements);
      }
   }, [surveyJson, currentPhaseIndex, setCurrentPhase, setElements, completedPhases]);

   const submitLTIScore = async () => {
      if (!launchId) return;
      
      try {
         const api = axiosInstance();
         await api.post(`/lti/api/score/${launchId}/1/1/`);
      } catch (error) {
         console.error('Error submitting LTI score:', error);
      }
   };

   useEffect(() => {
      const phasesLength = surveyJson?.phases?.length;
      const completedPhasesLength = completedPhases.length;
      const isLastPhaseCompleted = phasesLength !== undefined && phasesLength > 0 && completedPhasesLength === phasesLength;

      const shouldShowThankYouMessage = isLastPhaseCompleted && !promptLoading;

      let timeoutId: NodeJS.Timeout;
      if (shouldShowThankYouMessage === true) {
         submitLTIScore();
         timeoutId = setTimeout(() => {
            setShowThankYouMessage(true);
         }, 1000);
      }

      return () => {
         if (timeoutId) {
            clearTimeout(timeoutId);
         }
      };
   }, [completedPhases, surveyJson, promptLoading, setShowThankYouMessage, launchId]);

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

            {!loading && surveyJson?.phases?.length === 0 && (
               <p className="text-gray-600 text-center py-8">
                  This application doesn&apos;t contain any questions.
               </p>
            )}

            <div className="space-y-6">
               {completedPhases.map((pageIndex: number) => {
                  const page = surveyJson!.phases[pageIndex];
                  return (
                     <CompletedPhase
                        key={page.id}
                        pageIndex={pageIndex}
                        page={page}
                     />
                  );
               })}
            </div>

            {promptLoading && (
               <div className="flex justify-center py-8">
                  <SkeletonLoader />
               </div>
            )}

            {currentPhase !== null && appId !== null && (
               <div className="mt-6">
                  <CurrentPhase
                     appId={appId}
                     userId={userId}
                     answers={answers}
                  />
               </div>
            )}

            {showThankYouMessage && (
               <div>
                  <div className="mt-6 bg-green-50 border border-green-200 rounded-lg p-4">
                     <div className="text-sm/6  max-w-none text-green-800" dangerouslySetInnerHTML={{ __html: surveyJson?.completedHtml || "" }} />
                  </div>
               </div>
            )}

            <div className="mt-4">
               <a 
                  href="#" 
                  onClick={(e) => {
                     e.preventDefault();
                     resetConversations();
                     softResetSurveyStore();
                     setShowThankYouMessage(false);
                     toast.success("App state cleared successfully");
                  }}
                  className="inline-flex items-center text-sm text-gray-600 hover:text-gray-800"
               >
                  Clear State
               </a>
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
      </div>
   );
};

export default EmbeddedSurveyDisplay; 