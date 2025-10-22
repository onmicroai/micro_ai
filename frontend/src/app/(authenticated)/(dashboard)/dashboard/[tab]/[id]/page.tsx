/**
 * It currently works only on client, because axiosInstance uses Local Storage for the storaging access token
 */
'use client'

import { useEffect, useState } from "react";
import { useParams } from 'next/navigation';
import { useDashboardStore } from '../store/dashboardStore';
import DashboardSidebar from '../components/DashboardSidebar';
import AppTable from '../components/AppTable';

const Dashboard = () => {
  const params = useParams() ?? {};
  const activeTab = (params.tab as string) || 'all';
  const pageCollectionId = (params.id as string) || '';
  const {
    pageLoading,
    appCounts,
    activeCollectionId,
    createCollection,
    updateCollectionName,
    collections,
    setActiveCollectionId,
    handleCreateApp,
  } = useDashboardStore();

  const [isCreatingApp, setIsCreatingApp] = useState(false);
  const [isCreatingCollection, setIsCreatingCollection] = useState(false);

  const onCreateApp = async () => {
    if (activeCollectionId && !isCreatingApp) {
      setIsCreatingApp(true);
      try {
        await handleCreateApp(activeCollectionId);
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

export default Dashboard;
