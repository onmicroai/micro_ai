import React, { useEffect } from 'react';
import AppItem from "../AppItem";
import { CollectionItemProps } from '@/app/(authenticated)/(dashboard)/types';
import { useDashboardStore } from '../../store/dashboardStore';

const CollectionItem: React.FC<CollectionItemProps> = ({ 
   collection, 
   searchTerm, 
   selectedTab 
}) => {
   const { 
      apps, 
      appLoading,
      fetchApps, 
      cloneApp, 
      deleteApp 
   } = useDashboardStore();

   useEffect(() => {
      if (collection.id !== null) {
         const controller = new AbortController();
         fetchApps(collection.id, controller.signal);
         return () => controller.abort();
      }
   }, [collection.id, fetchApps]);

   // Filter apps based on searchTerm and selectedTab
   const filteredApps = apps
      .filter(app => app.title.toLowerCase().includes(searchTerm.toLowerCase()))
      .filter(app => selectedTab === "all" || app?.privacy?.toLowerCase() === selectedTab)
      .sort((a, b) => a.id - b.id);

   return (
      <section className="space-y-2">
         <div className="divide-y divide-gray-200">
            {filteredApps.length > 0 && filteredApps.map((app) => (
               <AppItem
                  key={app.id}
                  app={app}
                  collectionId={collection.id}
                  onCloneApp={(appId, collectionId) => cloneApp(appId, collectionId)}
                  onDeleteApp={deleteApp}
               />
            ))}
            {appLoading && (
               <div className="flex justify-center py-8">
                  <div className="text-gray-500">Loading...</div>
               </div>
            )}
         </div>
      </section>
   );
};

export default CollectionItem;