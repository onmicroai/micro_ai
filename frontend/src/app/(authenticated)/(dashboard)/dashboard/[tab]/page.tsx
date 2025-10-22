"use client"

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useDashboardStore } from './store/dashboardStore';
import DashboardSidebar from './components/DashboardSidebar';
import AppTable from './components/AppTable';

const DashboardTabPage = () => {
   const params = useParams() ?? {};
   const activeTab = (params.tab as string) || 'all';
   
   const {
      pageLoading,
      appCounts,
      activeCollectionId,
      createCollection,
      updateCollectionName,
      collections,
      fetchCollections,
      fetchAllApps,
      handleCreateApp,
   } = useDashboardStore();

   const [isCreatingApp, setIsCreatingApp] = useState(false);
   const [isCreatingCollection, setIsCreatingCollection] = useState(false);

   // Initialize dashboard: fetch collections and all apps
   useEffect(() => {
      const controller = new AbortController();
      
      const initializeData = async () => {
         const state = useDashboardStore.getState();
         
         // Fetch collections if not already loaded
         if (state.collections.length === 0) {
            await fetchCollections(controller.signal);
         }
         
         // Fetch all apps if activeCollectionId is null, otherwise fetch for specific collection
         if (state.activeCollectionId === null) {
            await fetchAllApps(controller.signal);
         }
      };
      
      initializeData();
      
      return () => {
         controller.abort();
      };
   }, [fetchCollections, fetchAllApps]);

   const onCreateApp = async () => {
      // When creating an app, use the active collection or first collection
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

   if (pageLoading) {
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
         activeTab={activeTab}
         appCounts={appCounts}
         onCreateApp={onCreateApp}
         onCreateCollection={onCreateCollection}
         updateCollectionName={updateCollectionName}
         isCreatingApp={isCreatingApp}
         isCreatingCollection={isCreatingCollection}
      >
         <AppTable
            activeCollectionId={activeCollectionId}
            activeTab={activeTab}
         />
      </DashboardSidebar>
   );
};

export default DashboardTabPage;

