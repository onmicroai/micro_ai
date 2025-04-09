"use client";

import { useEffect, useState } from "react";
import SkeletonLoader from "@/components/layout/loading/skeletonLoader";
import { toast } from 'react-toastify';
import CompletedPhase from '@/components/CompletedPhases';
import CurrentPhase from '@/components/CurrentPhase';
import { useSurveyStore } from '@/store/runtimeSurveyStore';
import { useConversationStore } from '@/store/conversationStore';
import { useAuth } from "@/context/AuthContext";
import EditAppLink from "../../../../../components/EditAppLink";
import DebugInformation from "../../../../../components/DebugInformation";
import { checkRole } from '@/utils/checkRoles';
import { checkIsPublic } from '@/utils/checkAppPrivacy';
import RemixBanner from "@/components/RemixBanner";
import { useUserStore } from "@/store/userStore";

type PageParams = {
   params: {
      id: string;  // Next.js route parameters are strings
   };
};

const SurveyDisplay = ({ params }: PageParams) => {
   const [showThankYouMessage, setShowThankYouMessage] = useState(false);
   const [showRemixBanner, setShowRemixBanner] = useState(true);
   const { user } = useUserStore();
   const { isAuthenticated } = useAuth();
   const userId = user?.id ?? null;
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
   const [roles, setRoles] = useState({
      isOwner: false,
      isAdmin: false
   });

   // Use ref instead of state to track previous values without triggering re-renders
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

   useEffect(() => {
      const phasesLength = surveyJson?.phases?.length;
      const completedPhasesLength = completedPhases.length;
      const isLastPhaseCompleted = phasesLength !== undefined && phasesLength > 0 && completedPhasesLength === phasesLength;

      const shouldShowThankYouMessage =
         isLastPhaseCompleted &&
         !promptLoading;

      let timeoutId: NodeJS.Timeout;
      if (shouldShowThankYouMessage === true) {
         timeoutId = setTimeout(() => {
            setShowThankYouMessage(true);
         }, 1000);
      }

      // Clear the timeout when the component unmounts or when dependencies change
      return () => {
         if (timeoutId) {
            clearTimeout(timeoutId);
         }
      };
   }, [completedPhases, surveyJson, promptLoading, setShowThankYouMessage]);

   useEffect(() => {
      const abortController = new AbortController();
      const signal = abortController.signal;

      const checkRoles = async () => {
         if (isAuthenticated && hashId) {
            try {
               const roleResult = await checkRole(hashId, userId, signal);
               setRoles({
                  isOwner: roleResult.roles.includes('owner'),
                  isAdmin: roleResult.roles.includes('admin')
               });
            } catch (error) {
               console.error("Error checking roles:", error);
            }
         }
      };
      
      checkRoles();

      return () => abortController.abort();
   }, [userId, hashId, isAuthenticated]);

   return (
      <div className="bg-gray-50 min-h-screen dark:bg-black-dark pb-16">
         <div className="max-w-7xl mx-auto px-4 py-6 bg-gray-50 sm:px-6 lg:px-8">
            <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-md overflow-hidden p-6">
               {(roles.isOwner || roles.isAdmin) && <EditAppLink hashId={hashId} />}
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

               {/* Completed phases */}
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

               {currentPhase !== null && appId !== null && (
                  <div className="mt-6">
                     <CurrentPhase
                        appId={appId}
                        userId={userId}
                        answers={answers}
                        isOwner={roles.isOwner}
                        isAdmin={roles.isAdmin}
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
         {!roles.isOwner && !roles.isAdmin && showRemixBanner && appId && (
            <RemixBanner 
               onDismiss={() => setShowRemixBanner(false)}
               appId={appId}
               copyAllowed={!!surveyJson?.copyAllowed}
            />
         )}
      </div>
   );
};

export default SurveyDisplay;
