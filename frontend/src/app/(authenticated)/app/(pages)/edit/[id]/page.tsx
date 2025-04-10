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
import { SurveyCreatorProps } from './types';
import { useSurveyStore } from './store/editSurveyStore';
import FormBuilder from "./components/FormBuilder";
import Link from "next/link";
import { Video } from 'lucide-react';
import SkeletonLoader from "@/components/layout/loading/skeletonLoader";
import AccessDenied from "@/components/access-denied"; 
const SurveyCreatorRenderComponent: React.FC<SurveyCreatorProps> = ({ hashId }) => {
   const api = axiosInstance();
   const appId = useRef<number | null>(null);
   const [modalInfo, setModalInfo] = useState({ isOpen: false, message: "" });
   const [loading, setLoading] = useState(true);
   const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
   const collectionId = useRef<number | null>(null);
   const {
      setPhases,
      setTitle,
      setDescription,
      setCollectionId,
      setPrivacy,
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

   const getAppUrl = (hashId: string) => {
      return `/app/${hashId}`;
   };

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

            appId.current = appIdFetched;
            setAppId(appIdFetched);

            const appCollectionsResponse = await api.get(`/api/collection/app/${appIdFetched}/collections/`, { signal });
            const appCollectionsData = appCollectionsResponse?.data?.data;

            if (typeof appData.app_json === 'string') {
               if (appData.app_json.length === 0) {
                  //First render after creation
                  appJson = appData;
               } else {
                  appJson = structuredClone(JSON.parse(appData.app_json || "{}"));
               }
            } else {
               appJson = structuredClone(appData.app_json);
            }

            setPhases(appJson.phases, true, signal);
            setTitle(appJson.title || "Untitled App", true, signal);
            setDescription(appJson.description, true, signal);
            setPrivacy(getPrivacyName(appJson.privacySettings), true, signal);
            setClonable(appJson.clonable === undefined ? true : appJson.clonable, true, signal);
            setCompletedHtml(appJson.completedHtml, true, signal);
            setAIConfig(appJson.aiConfig || {}, true, signal);
            setAttachedFiles(appJson.attachedFiles || [], true, signal);

            if (Array.isArray(appCollectionsData)) {
               const appCollections = structuredClone(appCollectionsData);
               if (appCollections.length > 0) {
                  const defaultCollection = appCollections[0]?.id;
                  if (typeof defaultCollection === 'number') {
                     appData.collection = defaultCollection;
                     collectionId.current = defaultCollection;
                     setCollectionId(defaultCollection, true, signal);
                  }
               }
            }

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
      setPhases, 
      setTitle, 
      setDescription, 
      setPrivacy, 
      setClonable, 
      setCompletedHtml, 
      setAIConfig, 
      setCollectionId,
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

   const TutorialButton = () => {
      return (
        <div className="fixed bottom-20 right-6 z-50">
                <a
                  href="/building-microapps-101"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 
                    shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105
                    hover:translate-x-[-8px] group"
                >
                  <Video className="h-5 w-5" />
                  <span className="max-w-0 overflow-hidden whitespace-nowrap group-hover:max-w-[200px] 
                    transition-all duration-300">
                    Watch Tutorial
                  </span>
                </a>
        </div>
      );
    };

   useEffect(() => {
      const controller = new AbortController();
      const signal = controller.signal;

      if (hashId !== null) {
         fetchMicroapp(hashId, signal);
         fetchCollections();
         fetchModels();
      }

      return () => {
         controller.abort();
         resetStore();
      };
   }, [hashId, fetchMicroapp, fetchCollections, fetchModels, resetStore]);

   if (loading || isAuthorized === null) {
      return (
         <>
            <SkeletonLoader /> 
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
            <TutorialButton />
            <Link 
               href={getAppUrl(hashId)}
               id="preview-button"
               className="fixed bottom-6 right-6 px-6 py-3 shadow-lg z-50
                  text-primary-foreground
                  bg-gradient-to-r from-secondary via-primary to-primary
                  bg-[length:300%_100%] bg-right
                  hover:bg-left transition-all duration-500
                  hover:shadow-xl"
            >
               Preview
            </Link>
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