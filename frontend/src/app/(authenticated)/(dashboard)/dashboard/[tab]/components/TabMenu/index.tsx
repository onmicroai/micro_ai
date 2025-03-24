// app/(dashboard)/dashboard/components/TabMenu.tsx
import { FC } from 'react';
import Link from "next/link";
import { TabMenuProps } from '@/app/(authenticated)/(dashboard)/types';

const TabMenu: FC<TabMenuProps> = ({ tabTypes, activeTab, appCounts, collectionId }) => {
   
   /**
    * Returns the URL for a tab based on the active tab and collection ID.
    * 
    * @param {string} tab - The tab to get the URL for.
    * @param {string} collectionId - The collection ID to get the URL for.
    * @returns {string} The URL for the tab.
    */
   const getTabUrl = (tab: string, collectionId?: string) => {
      if (collectionId) {
         return `/dashboard/${tab}/${collectionId}`;
      }
      return `/dashboard/${tab}`;
   };
   
   return (
      <ul className="flex items-center space-x-2 text-sm">
         {tabTypes.map((tab, index) => {
            const isActive = activeTab === tab.value;
            return (
               <li key={tab.value} className="flex items-center">
                  {isActive ? (
                     <span className="font-medium text-blue-600">
                        {tab.label} ({appCounts[tab.value] || 0})
                     </span>
                  ) : (
                     <Link 
                        href={getTabUrl(tab.value, collectionId)}
                        className="text-gray-600 hover:text-blue-600 transition-colors"
                     >
                        {tab.label} ({appCounts[tab.value] || 0})
                     </Link>
                  )}
                  {index < tabTypes.length - 1 && (
                     <span className="text-gray-400 ml-2">/</span>
                  )}
               </li>
            );
         })}
      </ul>
   );
};

export default TabMenu;