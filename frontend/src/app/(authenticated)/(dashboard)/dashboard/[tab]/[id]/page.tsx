/**
 * It currently works only on client, because axiosInstance uses Local Storage for the storaging access token
 */
'use client'

import { useEffect, useState } from "react";
import CollectionItem from "../components/CollectionItem";
import { FaMagnifyingGlass as Search } from 'react-icons/fa6';
import { useParams } from 'next/navigation';
import TabMenu from '../components/TabMenu';
import { useDashboardStore } from '../store/dashboardStore';
import CollectionHeader from '../components/CollectionHeader';

const Dashboard = () => {
  const params = useParams() ?? {};
   const activeTab = (params.tab as string) || 'all';
   const pageCollectionId = (params.id as string) || '';
  const [searchTerm, setSearchTerm] = useState<string>("");
  const {
    collection,
    collectionLoading,
    pageLoading,
    appCounts,
    tabTypes,
    activeCollectionId,
    createCollection,
    updateCollectionName,
    countAppPrivacyTypes,
    collections,
    setActiveCollectionId,
    handleCreateApp,
  } = useDashboardStore();
  
  /**
   * Handles changes to the search input field.
   *
   * @param {React.ChangeEvent<HTMLInputElement>} event - The input change event
   */
  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    event.preventDefault();
    const searchTerm = event.target.value.toLowerCase();
    setSearchTerm(searchTerm);
  };

  const onCreateApp = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    if (collection?.id) {
      await handleCreateApp(collection.id);
    }
  };

  useEffect(() => {
    if (pageCollectionId) {
      if (typeof pageCollectionId === "string") {
        const collectionId = parseInt(pageCollectionId);

        if (!isNaN(collectionId)) {
          if (collectionId !== activeCollectionId) {
            setActiveCollectionId(collectionId);
          }
        }
      }
    }
  }, [pageCollectionId, activeCollectionId, setActiveCollectionId]);

  /**
   * Fetches the collections and sets the edited name to the current collection name.
   */
  useEffect(() => {
    const controller = new AbortController();
    const dashboardStore = useDashboardStore.getState();

    // Check if collections are empty and fetch if needed
    if (dashboardStore.collections.length === 0) {
      dashboardStore.fetchCollections(controller.signal);
    }

    return () => {
      controller.abort();
    };
  }, []);

  if (pageLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen dark:bg-black-dark">
      <div className="container max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8 dark:bg-black-dark">
        <div className="space-y-6">
          {/* Tab Menu and Search Section */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <TabMenu
              tabTypes={tabTypes}
              activeTab={activeTab}
              appCounts={appCounts}
              collectionId={pageCollectionId}
            />
            <form className="w-full sm:w-auto">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search..."
                  onChange={handleSearchChange}
                  className="w-full sm:w-64 pl-10 pr-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              </div>
            </form>
          </div>

          {/* Collection and Content Section */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <CollectionHeader
              activeCollection={collection}
              collections={collections}
              updateCollectionName={updateCollectionName}
              activeTab={activeTab}
            />

            {collection && (
              <CollectionItem
                key={collection.id}
                collection={collection}
                searchTerm={searchTerm}
                selectedTab={activeTab}
                countAppPrivacyTypes={countAppPrivacyTypes}
              />
            )}

            {collectionLoading && (
              <div className="flex justify-center py-8">
                <div className="text-gray-500">Loading...</div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-4 mt-6 justify-end">
              <button
                onClick={createCollection}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
              >
                Create Collection +
              </button>
              <button
                onClick={onCreateApp}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary-600 focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-colors"
              >
                Create App +
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
