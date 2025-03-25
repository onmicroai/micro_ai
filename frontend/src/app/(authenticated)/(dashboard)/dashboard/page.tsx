"use client"

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useDashboardStore } from './[tab]/store/dashboardStore';

const DashboardPage = () => {
   const router = useRouter();
   const { fetchCollections } = useDashboardStore();
   
   useEffect(() => {
      const controller = new AbortController();
      
      // Initial check and fetch on mount
      const initializeData = async () => {
         const state = useDashboardStore.getState();
         if (state.collections.length === 0) {
            await fetchCollections(controller.signal);
            return;
         }

         router.replace(`/dashboard/all/${state.collections[0]?.id}`);
      };
      
      // Run initial check immediately
      initializeData();
      
      // Subscribe for future state changes
      const unsubscribe = useDashboardStore.subscribe(async (state) => {
         const firstCollectionId = state.collections[0]?.id;
         if (firstCollectionId) {
            router.replace(`/dashboard/all/${firstCollectionId}`);
         }
      });
      
      return () => {
         controller.abort();
         unsubscribe();
      };
   }, [router, fetchCollections]);

   return (
      <div className="flex justify-center items-center min-h-screen">
         <div className="text-gray-500">Loading...</div>
      </div>
   );
};

export default DashboardPage;