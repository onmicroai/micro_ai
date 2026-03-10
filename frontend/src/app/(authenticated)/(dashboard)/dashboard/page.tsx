"use client"

import { useEffect, useState } from 'react';
import { useDashboardStore } from './[tab]/store/dashboardStore';
import DashboardSidebar from './[tab]/components/DashboardSidebar';
import AppTable from './[tab]/components/AppTable';

const DashboardPage = () => {
   const {
      appCounts,
      activeCollectionId,
      createCollection,
      updateCollectionName,
      collections,
      fetchCollections,
      fetchAllApps,
      fetchDefaultModel,
      handleCreateApp,
   } = useDashboardStore();

   const [isInitializing, setIsInitializing] = useState(true);
   const [isCreatingApp, setIsCreatingApp] = useState(false);
   const [isCreatingCollection, setIsCreatingCollection] = useState(false);

   // Initialize dashboard: fetch collections, default model, and all apps.
   // isInitializing gates the UI so createApp never runs before defaultAiModel is set.
   useEffect(() => {
      const controller = new AbortController();
      
      const initializeData = async () => {
         const state = useDashboardStore.getState();
         
         // Fetch collections and default model in parallel
         const promises: Promise<void>[] = [];

         if (state.collections.length === 0) {
            promises.push(fetchCollections(controller.signal));
         }

         promises.push(fetchDefaultModel(controller.signal));

         await Promise.all(promises);
         
         // Fetch all apps
         await fetchAllApps(controller.signal);

         setIsInitializing(false);
      };
      
      initializeData();
      
      return () => {
         controller.abort();
      };
   }, [fetchCollections, fetchAllApps, fetchDefaultModel]);

   const onCreateApp = async () => {
      // When creating an app from /dashboard, use the first collection or active collection
      const collectionId = activeCollectionId || collections[0]?.id;
      
      if (collectionId && !isCreatingApp) {
         setIsCreatingApp(true);
         try {
            await handleCreateApp(collectionId);
         } finally {
            setIsCreatingApp(false);
         }
      }
   };

   const onCreateCollection = async () => {
      if (!isCreatingCollection) {
         setIsCreatingCollection(true);
         try {
            await createCollection();
         } finally {
            setIsCreatingCollection(false);
         }
      }
   };

   if (isInitializing) {
      return (
         <div className="flex justify-center items-center min-h-screen">
            <div className="text-gray-500">Loading...</div>
         </div>
      );
   }

   return (
      <DashboardSidebar
         collections={collections}
         activeCollectionId={activeCollectionId}
         activeTab="all"
         appCounts={appCounts}
         onCreateApp={onCreateApp}
         onCreateCollection={onCreateCollection}
         updateCollectionName={updateCollectionName}
         isCreatingApp={isCreatingApp}
         isCreatingCollection={isCreatingCollection}
      >
         <AppTable
            activeCollectionId={activeCollectionId}
            activeTab="all"
         />
      </DashboardSidebar>
   );
};

export default DashboardPage;