"use client";
import React, { useEffect, useState, useRef, useCallback } from "react";
import "survey-core/survey.i18n.js";
import "survey-creator-core/survey-creator-core.i18n.js";
import "survey-core/defaultV2.css";
import "survey-creator-core/survey-creator-core.css";
import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import axiosInstance from "@/utils/axiosInstance";
import Modal from '@/components/modules/custom-prompt-modal/custom-prompt-modal';
import { SurveyCreatorProps } from '@/app/(authenticated)/app/types';
import { useSurveyStore } from './store/editSurveyStore';
import FormBuilder from "./components/FormBuilder";
import SkeletonLoader from "@/components/layout/loading/skeletonLoader";
import AccessDenied from "@/components/access-denied";
import { useUserStore } from "@/store/userStore";
import { checkIsAdmin, checkIsOwner } from "@/utils/checkRoles";
import { normalizeAppJsonToV2 } from "@/utils/migrateAppJson";
const SurveyCreatorRenderComponent: React.FC<SurveyCreatorProps> = ({ hashId }) => {
   const api = axiosInstance();
   const appId = useRef<number | null>(null);
   const [modalInfo, setModalInfo] = useState({ isOpen: false, message: "" });
   const [loading, setLoading] = useState(true);
   const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
   const {
      setElements,
      setTitle,
      setDescription,
      setCollectionIds,
      setPrivacy,
      setPermittedDomains,
      setClonable,
      resetStore,
      setAppId,
      setCompletedHtml,
      setIsInitialLoad,
      setAIConfig,
      setAttachedFiles,
      fetchCollections,
      fetchModels
   } = useSurveyStore();

   const showModal = useCallback((message: string) => {
      setModalInfo({ isOpen: true, message });
   }, []);

   const handleAPIErrors = useCallback((error: any) => {
      if (error.name !== 'CanceledError') {
         const errorMessage = error instanceof Error ? error.message : String(error);
         console.error("API Error:", errorMessage);
         showModal(errorMessage);
      }
   }, [showModal]);

   /**
    * Fetches the microapp data and sets the store values
    * @param hashId - The hash ID of the microapp
    * @param signal - The AbortSignal to cancel the request
    */
   const fetchMicroapp = useCallback(async (hashId: string, signal?: AbortSignal) => {
      try {
         setIsInitialLoad(true);
         setLoading(true); 

         const response = await api.get(`/api/microapps/hash/${hashId}`, { signal });

         if (response.status === 200) {
           
            const appData = structuredClone(response?.data?.data);
            const appIdFetched = appData?.id;
            let appJson: any = {};

            if (!appData) {
               showModal("Failed to load the microapp data.");
               setLoading(false);
               setIsInitialLoad(false);
               return;
            }

            const editorUserId = useUserStore.getState().user?.id ?? null;
            if (editorUserId === null) {
               setIsAuthorized(false);
               setLoading(false);
               setIsInitialLoad(false);
               return;
            }
            const [ownerResult, adminResult] = await Promise.all([
               checkIsOwner(hashId, editorUserId, signal!),
               checkIsAdmin(hashId, editorUserId, signal!),
            ]);
            if (!ownerResult.isOwner && !adminResult.isAdmin) {
               setIsAuthorized(false);
               setLoading(false);
               setIsInitialLoad(false);
               return;
            }

            appId.current = appIdFetched;
            setAppId(appIdFetched);

            const appCollectionsResponse = await api.get(`/api/collection/app/${appIdFetched}/collections/`, { signal });
            const appCollectionsData = appCollectionsResponse?.data?.data;

            if (typeof appData.app_json === 'string') {
               if (appData.app_json.length === 0) {
                  //First render after creation - use empty object, phases will be initialized with default
                  appJson = {};
               } else {
                  appJson = structuredClone(JSON.parse(appData.app_json || "{}"));
               }
            } else {
               appJson = structuredClone(appData.app_json || {});
            }

            // Normalize/migrate legacy app_json to v2 elements[] so the editor has a canonical shape available.
            // (Editor will switch to storing elements[] directly in the next step of the migration.)
            const v2 = normalizeAppJsonToV2(appJson);
            if (!Array.isArray(appJson.elements)) {
               appJson.elements = v2.elements;
            }

            // Editor is V2: always set elements[] (legacy phases were migrated above).
            setElements(v2.elements || [], true, signal);
            setTitle(appJson.title || "Untitled App", true, signal);
            setDescription(appJson.description, true, signal);
            setPrivacy(getPrivacyName(appJson.privacySettings), true, signal);
            setPermittedDomains(appData.permitted_domains ?? []);
            setClonable(appJson.clonable === undefined ? true : appJson.clonable, true, signal);
            setCompletedHtml(appJson.completedHtml, true, signal);
            setAIConfig(appJson.aiConfig || {}, true, signal);
            setAttachedFiles(appJson.attachedFiles || [], true, signal);

            if (Array.isArray(appCollectionsData)) {
               const appCollections = structuredClone(appCollectionsData);
               const ids = appCollections
                 .map((c: { id?: number }) => c?.id)
                 .filter((id): id is number => typeof id === "number");
               setCollectionIds(ids, true, signal);
            }

            // App Builder: restore chat + undo stack from session (same tab / refresh).
            useSurveyStore.getState().hydrateAppBuilderFromSession(appIdFetched);

            setIsAuthorized(true); 
         } else if (response.status === 400) {
           
            setIsAuthorized(false); 
         }
      } catch (error: any) {
         if (error.name !== 'CanceledError') {
            handleAPIErrors(error);
            setIsAuthorized(false); 
         }
      } finally {
         setLoading(false);
         setIsInitialLoad(false);
      }
   }, [
      api, 
      handleAPIErrors,
      setAppId, 
      setElements,
      setTitle, 
      setDescription, 
      setPrivacy,
      setPermittedDomains,
      setClonable, 
      setCompletedHtml, 
      setAIConfig, 
      setAttachedFiles,
      setCollectionIds,
      setIsInitialLoad,
      setLoading,
      setIsAuthorized,
      showModal
   ]);

   const getPrivacyName = (privacy: string) => {
      if (privacy === undefined) {
         return "private";
      }

      switch (privacy.toLowerCase()) {
         case "public":
            return "public";
         case "site-specific":
            return "restricted";
         default:
            return "private";
      }
   };

   useEffect(() => {
      const controller = new AbortController();
      const signal = controller.signal;

      if (hashId !== null) {
         fetchMicroapp(hashId, signal);
         fetchCollections();
         
         //fetchModels();
         // fetchModels results in 404 error currently
         // TODO: investigate why the endpoint is missing on
         // backend & wheather it is needed after LiteLLM integration
      }

      return () => {
         controller.abort();
         resetStore();
      };
   }, [hashId, fetchMicroapp, fetchCollections, fetchModels, resetStore]);

   if (loading || isAuthorized === null) {
      return (
         <>
            <SkeletonLoader variant="builder" />
         </>
      );
   }

   if (isAuthorized === false) {
      return (
         <>
            <AccessDenied />
         </>
      );
   }
   return (
      <div>
         <>
            <FormBuilder />
         </>
         <Modal isOpen={modalInfo.isOpen} onClose={() => setModalInfo({ ...modalInfo, isOpen: false })}>
            <div>{modalInfo.message}</div>
         </Modal>
      </div>
   );
};

const SurveyCreatorPage = () => {
   const params = useParams() ?? {};
   const hashId = (params.id as string) || "";
   const hashIdString = hashId.toString();

   return <SurveyCreatorRenderComponent hashId={hashIdString} />;
};

export default dynamic(() => Promise.resolve(SurveyCreatorPage), {
   ssr: false,
});