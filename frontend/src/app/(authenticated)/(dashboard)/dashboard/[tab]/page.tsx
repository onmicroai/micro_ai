"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useDashboardStore } from "./store/dashboardStore";
import DashboardSidebar from "./components/DashboardSidebar";
import AppTable from "./components/AppTable";

const DashboardTabPage = () => {
  const params = useParams() ?? {};
  const activeTab = (params.tab as string) || "all";

  const {
    appCounts,
    listScope,
    createCollection,
    updateCollectionName,
    collections,
    fetchCollections,
    fetchApps,
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

      if (state.listScope.kind === "collection") {
        await fetchApps(state.listScope.id, controller.signal);
      } else {
        await fetchAllApps(controller.signal);
      }

      setIsInitializing(false);
    };

    initializeData();

    return () => {
      controller.abort();
    };
  }, [fetchCollections, fetchApps, fetchAllApps, fetchDefaultModel]);

  const onCreateApp = async () => {
    if (isCreatingApp) return;
    setIsCreatingApp(true);
    try {
      const collectionId =
        listScope.kind === "collection" ? listScope.id : undefined;
      const hashId = await handleCreateApp(collectionId, {
        privacy: "private",
      });
      if (!hashId) throw new Error("Failed to create app");
    } finally {
      setIsCreatingApp(false);
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
      activeTab={activeTab}
      appCounts={appCounts}
      onCreateApp={onCreateApp}
      onCreateCollection={onCreateCollection}
      updateCollectionName={updateCollectionName}
      isCreatingApp={isCreatingApp}
      isCreatingCollection={isCreatingCollection}
    >
      <AppTable activeTab={activeTab} />
    </DashboardSidebar>
  );
};

export default DashboardTabPage;
