import { create } from "zustand";
import {
  Collection,
  AppSerialized,
  AppRaw,
  DashboardListScope,
} from "@/app/(authenticated)/(dashboard)/types";
import axiosInstance from "@/utils/axiosInstance";
import { toast } from "react-toastify";
import {
  getSortedDashboardAppList,
  mergeSubsetReorder,
  reorderArray,
} from "../dashboardSortUtils";

/** Coalesces concurrent cloneApp calls for the same app/collection into one request. */
const cloneAppInFlight = new Map<string, Promise<void>>();

function cloneRequestKey(appId: number, collectionId?: number) {
  return `${appId}:${collectionId ?? "default"}`;
}
interface DashboardStore {
  // State
  collections: Collection[];
  collectionCount: number;
  pageLoading: boolean;
  appCounts: { [key: string]: number };
  apps: AppSerialized[];
  appsCount: number;
  appLoading: boolean;
  listScope: DashboardListScope;
  /** Merged global order from API; null = no saved order (sort by id). */
  globalDashboardOrderIds: number[] | null;
  /** Order for current collection view; null = no saved order. */
  collectionDashboardOrderIds: number[] | null;
  /** Which collection `collectionDashboardOrderIds` belongs to. */
  collectionOrderForId: number | null;
  defaultAiModel: string;
  // Actions
  fetchCollections: (signal?: AbortSignal) => Promise<void>;
  fetchDefaultModel: (signal?: AbortSignal) => Promise<void>;
  createCollection: () => Promise<void>;
  updateCollectionName: (
    collectionId: number,
    newName: string
  ) => Promise<void>;
  deleteCollection: (collectionId: number) => Promise<void>;
  countAppPrivacyTypes: (apps: AppSerialized[]) => void;
  fetchApps: (collectionId: number, signal?: AbortSignal) => Promise<void>;
  fetchAllApps: (signal?: AbortSignal) => Promise<void>;
  createApp: (
    collectionId?: number | null,
    options?: { title?: string; privacy?: string }
  ) => Promise<string | null>;
  cloneApp: (appId: number, collectionId?: number) => Promise<void>;
  deleteApp: (appId: number) => void;
  updateAppPrivacy: (appId: number, privacy: string) => void;
  appSerializer: (app: AppRaw | AppRaw[]) => AppSerialized | AppSerialized[];
  setListScope: (scope: DashboardListScope) => void;
  reorderDashboardList: (
    sourceIndex: number,
    destinationIndex: number,
    activeTab: string
  ) => Promise<void>;
  handleCreateApp: (
    collectionId?: number | null,
    options?: { title?: string; privacy?: string }
  ) => Promise<string | null>;
  reset: () => void;
}

const sortCollectionsById = (collections: Collection[]): Collection[] => {
  return [...collections].sort((a, b) => a.id - b.id);
};

const FALLBACK_AI_MODEL = "gpt-5-mini";

export const useDashboardStore = create<DashboardStore>((set, get) => ({
  // Initial state
  collections: [],
  collectionCount: 0,
  pageLoading: true,
  appCounts: {
    all: 0,
    public: 0,
    private: 0,
    restricted: 0,
  },
  apps: [],
  appsCount: 0,
  appLoading: false,
  listScope: { kind: "all" },
  globalDashboardOrderIds: null,
  collectionDashboardOrderIds: null,
  collectionOrderForId: null,
  defaultAiModel: FALLBACK_AI_MODEL,

  /**
   * Fetches the collections for the current user.
   * @param {AbortSignal} signal - The abort signal for the request.
   */
  fetchCollections: async (signal?: AbortSignal) => {
    const api = axiosInstance();
    set({ pageLoading: true });
    try {
      const response = await api.get("/api/collection/user", { signal });
      const data = response?.data?.data;

      if (data !== undefined) {
        const sortedCollections = sortCollectionsById(data);
        set({
          collections: sortedCollections,
          collectionCount: data.length,
        });
        // listScope stays user-selected (default all)
      } else {
        toast.error("Failed to fetch collections", { theme: "colored" });
      }
    } catch (error: any) {
      // Ignore CanceledError from AbortController
      if (error.name !== "CanceledError" && error.name !== "AbortError") {
        toast.error(
          "Failed to fetch collections: " +
            (error.response?.data?.message || error.message),
          { theme: "colored" }
        );
      }
    } finally {
      set({ pageLoading: false });
    }
  },

  /**
   * Fetches the LiteLLM model list and sets defaultAiModel to the first model
   * tagged 'default' for the user's tier. Falls back to FALLBACK_AI_MODEL.
   */
  fetchDefaultModel: async (signal?: AbortSignal) => {
    const api = axiosInstance();
    try {
      const response = await api.get(
        "/api/microapps/models/litellm-configuration/",
        { signal }
      );
      const models: Array<{ model: string; tags?: string[] }> =
        response?.data?.data?.models ?? [];
      const defaultModel = models.find(
        (m) => Array.isArray(m.tags) && m.tags.includes("default")
      );
      set({ defaultAiModel: defaultModel?.model ?? FALLBACK_AI_MODEL });
    } catch (error: any) {
      if (error.name !== "CanceledError" && error.name !== "AbortError") {
        console.error("Failed to fetch default model:", error);
      }
    }
  },

  /**
   * Creates a new collection for the current user.
   */
  createCollection: async () => {
    const api = axiosInstance();
    const nextCollectionNumber = get().collectionCount + 1;
    const nextCollectionName = "Collection " + nextCollectionNumber;

    try {
      const response = await api.post("/api/collection/", {
        name: nextCollectionName,
      });
      const data = response?.data?.data;

      if (data !== undefined) {
        set((state) => ({
          collections: sortCollectionsById([...state.collections, data]),
          collectionCount: state.collectionCount + 1,
        }));
        toast.success("Collection created successfully!", { theme: "colored" });
      } else {
        toast.error("Failed to create collection", { theme: "colored" });
      }
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.error ||
        error.response?.data?.message ||
        error.message;
      toast.error("Failed to create collection: " + errorMessage, {
        theme: "colored",
      });
    }
  },

  /**
   * Updates the name of a collection.
   * @param {number} collectionId - The ID of the collection to update.
   * @param {string} newName - The new name for the collection.
   */
  updateCollectionName: async (collectionId: number, newName: string) => {
    const api = axiosInstance();
    try {
      const response = await api.put(`/api/collection/${collectionId}`, {
        name: newName,
      });
      if (response.data) {
        set((state) => ({
          collections: state.collections.map((col) =>
            col.id === collectionId ? { ...col, name: newName } : col
          ),
        }));
        toast.success("Collection name updated successfully", {
          theme: "colored",
        });
      }
    } catch (error: any) {
      const errorResponse = error?.response?.data || {};
      const errorMessage =
        errorResponse.error || errorResponse.message || error.message;
      toast.error("Failed to update collection name: " + errorMessage, {
        theme: "colored",
      });
    }
  },

  /**
   * Deletes a collection.
   * @param {number} collectionId - The ID of the collection to delete.
   */
  deleteCollection: async (collectionId: number) => {
    const api = axiosInstance();
    try {
      await api.delete(`/api/collection/${collectionId}`);
      set((state) => ({
        collections: state.collections.filter((c) => c.id !== collectionId),
        collectionCount: Math.max(0, state.collectionCount - 1),
        listScope:
          state.listScope.kind === "collection" &&
          state.listScope.id === collectionId
            ? { kind: "all" }
            : state.listScope,
      }));
      toast.success("Collection deleted successfully", { theme: "colored" });
    } catch (error: any) {
      const errorResponse = error?.response?.data || {};
      const errorMessage =
        errorResponse.error || errorResponse.message || error.message;
      toast.error("Failed to delete collection: " + errorMessage, {
        theme: "colored",
      });
    }
  },

  /**
   * Counts the privacy types of the apps in the collection.
   * @param {App[]} apps - The apps to count.
   */
  countAppPrivacyTypes: (apps: AppSerialized[]) => {
    const counts = apps.reduce(
      (accumulator: { [key: string]: number }, app: AppSerialized) => {
        if (app.privacy !== undefined) {
          const appPrivacy = app.privacy.toLocaleLowerCase();
          accumulator[appPrivacy] = (accumulator[appPrivacy] || 0) + 1;
        }
        return accumulator;
      },
      {}
    );

    set(() => {
      const updatedAppCounts = {
        all: 0,
        public: 0,
        private: 0,
        restricted: 0,
      };

      Object.keys(updatedAppCounts).forEach((key) => {
        if (key === "all") {
          return;
        }
        const countKey = counts[key];
        updatedAppCounts.all += countKey || 0;
        updatedAppCounts[key as keyof typeof updatedAppCounts] = countKey || 0;
      });

      return { appCounts: updatedAppCounts };
    });
  },

  /**
   * Serializes the privacy type of an app or array of apps.
   * @param {App | App[]} app - The app or array of apps to serialize.
   */
  appSerializer: (app: AppRaw | AppRaw[]): AppSerialized | AppSerialized[] => {
    const serializeSingleApp = (app: AppRaw): AppSerialized => {
      const serializedApp = structuredClone(app);
      if (typeof app.privacy === "string") {
        serializedApp.privacy = app.privacy.toLowerCase();
      }
      if (serializedApp.privacy === "site-specific") {
        serializedApp.privacy = "restricted";
      }

      return {
        id: serializedApp.id,
        hashId: serializedApp.hash_id,
        title: serializedApp.title,
        explanation: serializedApp.explanation,
        privacy: serializedApp.privacy,
        temperature: serializedApp.temperature,
        copyAllowed: serializedApp.copy_allowed,
        appJson: serializedApp.app_json,
        ...(serializedApp.collection_id != null
          ? { collectionId: serializedApp.collection_id }
          : {}),
        role: serializedApp.role ?? "owner",
        stats: serializedApp.stats,
      };
    };

    return Array.isArray(app)
      ? app.map(serializeSingleApp)
      : serializeSingleApp(app);
  },

  /**
   * Fetches apps for the specified collection.
   * @param {number} collectionId - The ID of the collection to fetch apps from.
   * @param {AbortSignal} signal - The abort signal for the request.
   */
  fetchApps: async (collectionId: number, signal?: AbortSignal) => {
    try {
      const api = axiosInstance();
      set({ appLoading: true });
      const response = await api.get(
        `/api/collection/user/apps/${collectionId}`,
        { signal }
      );
      const data = response?.data?.data;

      if (data !== undefined) {
        const serializedData = get().appSerializer(data);
        if (Array.isArray(serializedData)) {
          let orderIds: number[] | null = null;
          try {
            const or = await api.get(
              `/api/microapps/me/collection/${collectionId}/app-order/`,
              { signal }
            );
            orderIds = or?.data?.data?.ordered_ids ?? null;
          } catch (orderErr: any) {
            if (
              orderErr.name !== "CanceledError" &&
              orderErr.name !== "AbortError"
            ) {
              console.error("Failed to fetch collection app order:", orderErr);
            }
          }
          set({
            apps: serializedData,
            appsCount: data.length,
            collectionDashboardOrderIds: orderIds,
            collectionOrderForId: collectionId,
            globalDashboardOrderIds: null,
          });
          get().countAppPrivacyTypes(serializedData);
        }
      }
    } catch (error: any) {
      // Ignore CanceledError from AbortController
      if (error.name !== "CanceledError") {
        const errorMessage =
          error.response?.data?.error ||
          error.response?.data?.message ||
          error.message;
        toast.error("Failed to fetch apps: " + errorMessage, {
          theme: "colored",
        });
      }
    } finally {
      set({ appLoading: false });
    }
  },

  /**
   * Fetches all apps for the current user across all collections.
   * @param {AbortSignal} signal - The abort signal for the request.
   */
  fetchAllApps: async (signal?: AbortSignal) => {
    try {
      const api = axiosInstance();
      set({ appLoading: true });
      const response = await api.get("/api/microapps/apps", { signal });
      const data = response?.data?.data;

      if (data !== undefined) {
        const serializedData = get().appSerializer(data);
        if (Array.isArray(serializedData)) {
          let orderIds: number[] | null = null;
          try {
            const or = await api.get("/api/microapps/me/dashboard-app-order/", {
              signal,
            });
            orderIds = or?.data?.data?.ordered_ids ?? null;
          } catch (orderErr: any) {
            if (
              orderErr.name !== "CanceledError" &&
              orderErr.name !== "AbortError"
            ) {
              console.error("Failed to fetch global app order:", orderErr);
            }
          }
          set({
            apps: serializedData,
            appsCount: data.length,
            globalDashboardOrderIds: orderIds,
            collectionDashboardOrderIds: null,
            collectionOrderForId: null,
          });
          get().countAppPrivacyTypes(serializedData);
        }
      }
    } catch (error: any) {
      // Ignore CanceledError from AbortController
      if (error.name !== "CanceledError" && error.name !== "AbortError") {
        const errorMessage =
          error.response?.data?.error ||
          error.response?.data?.message ||
          error.message;
        toast.error("Failed to fetch apps: " + errorMessage, {
          theme: "colored",
        });
      }
    } finally {
      set({ appLoading: false });
    }
  },

  /**
   * Creates a new app in the specified collection.
   * @param {number} collectionId - The ID of the collection to create the app in.
   * @param {Object} [options] - Optional overrides for title and privacy.
   * @returns {Promise<string | null>} - The hash ID of the new app or null if creation fails.
   */
  createApp: async (
    collectionId?: number | null,
    options?: { title?: string; privacy?: string }
  ): Promise<string | null> => {
    try {
      const api = axiosInstance();
      // Do not set appLoading: the dashboard table would show "Loading apps..."
      // during create even though we append the new row and usually redirect immediately.
      // The Add-app control uses local isCreatingApp for feedback.

      const nextAppNumber = get().appsCount + 1;
      const appName = options?.title?.trim() || `App ${nextAppNumber}`;
      const privacySetting = options?.privacy || "private";

      const defaultAppDetails: Record<string, unknown> = {
        title: appName,
        type: "Private",
        copyAllowed: true,
        privacy: privacySetting,
        // Backend stores this as a string; frontend owns schema.
        // New apps start with V2 (no phases) so we don't rely on phase defaults.
        app_json: {
          title: appName,
          description: "",
          privacySettings: privacySetting,
          clonable: true,
          attachedFiles: [],
          aiConfig: {
            aiModel: get().defaultAiModel,
            temperature: 0.7,
            maxResponseTokens: null,
            systemPrompt: "",
          },
          elements: [],
        },
      };
      if (
        collectionId != null &&
        typeof collectionId === "number" &&
        collectionId > 0
      ) {
        defaultAppDetails.collection_id = collectionId;
      }

      const response = await api.post("/api/microapps/", defaultAppDetails);
      const data = response?.data?.data;

      if (data !== undefined) {
        const serializedData = get().appSerializer(data) as AppSerialized;
        if (!Array.isArray(serializedData)) {
          set((state) => ({
            apps: [...state.apps, serializedData],
            appsCount: state.appsCount + 1,
          }));
          get().countAppPrivacyTypes([serializedData]);
          toast.success("Redirecting to the app editor...", {
            theme: "colored",
          });
          return serializedData.hashId;
        }
        return null;
      }
      return null;
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.error ||
        error.response?.data?.message ||
        error.message;
      toast.error("Failed to create app: " + errorMessage, {
        theme: "colored",
      });
      return null;
    }
  },

  /**
   * Clones an existing app within the specified collection.
   * @param {number} appId - The ID of the app to clone.
   * @param {number} [collectionId] - Optional ID of the collection to clone the app to.
   */
  cloneApp: async (appId: number, collectionId?: number) => {
    const key = cloneRequestKey(appId, collectionId);
    const existing = cloneAppInFlight.get(key);
    if (existing) {
      await existing;
      return;
    }

    const promise = (async () => {
      set({ appLoading: true });
      const api = axiosInstance();
      try {
        const url = collectionId
          ? `/api/microapps/${appId}/${collectionId}/clone`
          : `/api/microapps/${appId}/clone`;
        const response = await api.post(url);
        const data = response?.data?.data;

        if (data !== undefined) {
          const serializedData = get().appSerializer(data) as AppSerialized;
          set((state) => ({
            apps: [...state.apps, serializedData],
            appsCount: state.appsCount + 1,
          }));
          get().countAppPrivacyTypes([serializedData]);
          window.location.href = `/app/${serializedData.hashId}`;
        }
      } catch (error: any) {
        const errorMessage =
          error.response?.data?.error ||
          error.response?.data?.message ||
          error.message;
        toast.error("Failed to clone app: " + errorMessage, {
          theme: "colored",
        });
      } finally {
        set({ appLoading: false });
      }
    })();

    cloneAppInFlight.set(key, promise);
    try {
      await promise;
    } finally {
      cloneAppInFlight.delete(key);
    }
  },

  /**
   * Removes an app from the local state after deletion.
   * @param {number} deletedAppId - The ID of the app to delete.
   */
  deleteApp: (deletedAppId: number) => {
    set((state) => {
      const updatedApps = state.apps.filter((app) => app.id !== deletedAppId);
      get().countAppPrivacyTypes(updatedApps);
      return {
        apps: updatedApps,
        appsCount: state.appsCount - 1,
        globalDashboardOrderIds: state.globalDashboardOrderIds?.filter(
          (id) => id !== deletedAppId
        ) ?? null,
        collectionDashboardOrderIds: state.collectionDashboardOrderIds?.filter(
          (id) => id !== deletedAppId
        ) ?? null,
      };
    });
  },

  updateAppPrivacy: (appId: number, privacy: string) => {
    set((state) => {
      const updatedApps = state.apps.map((app) =>
        app.id === appId ? { ...app, privacy } : app
      );
      get().countAppPrivacyTypes(updatedApps);
      return { apps: updatedApps };
    });
  },

  /** Sidebar scope: all apps, owned-only, shared-only, or a collection folder. */
  setListScope: (scope: DashboardListScope) => {
    set({ listScope: scope });
  },

  reorderDashboardList: async (
    sourceIndex: number,
    destinationIndex: number,
    activeTab: string
  ) => {
    const api = axiosInstance();
    const {
      apps,
      listScope,
      globalDashboardOrderIds,
      collectionDashboardOrderIds,
      collectionOrderForId,
    } = get();

    const sortedVisible = getSortedDashboardAppList(
      apps,
      listScope,
      activeTab,
      globalDashboardOrderIds,
      collectionDashboardOrderIds,
      collectionOrderForId
    );
    if (sortedVisible.length < 2) return;

    const reordered = reorderArray(
      sortedVisible,
      sourceIndex,
      destinationIndex
    );
    const newSubsetIds = reordered.map((a) => a.id);

    let previousGlobal: number[] | null = null;
    let previousCollection: number[] | null = null;
    let mergedGlobal: number[] | null = null;

    if (listScope.kind === "collection") {
      if (collectionOrderForId !== listScope.id) return;
      const cur = get().collectionDashboardOrderIds;
      previousCollection = cur ? [...cur] : null;
      set({ collectionDashboardOrderIds: newSubsetIds });
    } else {
      const accessibleIds = [...apps.map((a) => a.id)].sort((a, b) => a - b);
      const accessibleSet = new Set(accessibleIds);
      let baseOrder: number[];
      if (globalDashboardOrderIds?.length) {
        const seen = new Set<number>();
        baseOrder = [];
        for (const id of globalDashboardOrderIds) {
          if (accessibleSet.has(id) && !seen.has(id)) {
            baseOrder.push(id);
            seen.add(id);
          }
        }
        for (const id of accessibleIds) {
          if (!seen.has(id)) baseOrder.push(id);
        }
      } else {
        baseOrder = accessibleIds;
      }
      const subsetIds = new Set(sortedVisible.map((a) => a.id));
      mergedGlobal = mergeSubsetReorder(baseOrder, subsetIds, newSubsetIds);
      const cur = get().globalDashboardOrderIds;
      previousGlobal = cur ? [...cur] : null;
      set({ globalDashboardOrderIds: mergedGlobal });
    }

    try {
      if (listScope.kind === "collection") {
        await api.put(
          `/api/microapps/me/collection/${listScope.id}/app-order/`,
          { ordered_ids: newSubsetIds }
        );
      } else if (mergedGlobal) {
        await api.put("/api/microapps/me/dashboard-app-order/", {
          ordered_ids: mergedGlobal,
        });
      }
    } catch (error: any) {
      if (listScope.kind === "collection") {
        set({ collectionDashboardOrderIds: previousCollection });
      } else {
        set({ globalDashboardOrderIds: previousGlobal });
      }
      const errorMessage =
        error.response?.data?.error ||
        error.response?.data?.message ||
        error.message;
      toast.error(
        "Could not save app order: " +
          (typeof errorMessage === "string"
            ? errorMessage
            : "Please try again."),
        { theme: "colored" }
      );
    }
  },

  handleCreateApp: async (
    collectionId?: number | null,
    options?: { title?: string; privacy?: string }
  ) => {
    const newAppHashId = await get().createApp(collectionId, options);
    if (newAppHashId) {
      window.location.href = `/app/edit/${newAppHashId}`;
    }
    return newAppHashId;
  },

  reset: () => {
    set({
      collections: [],
      collectionCount: 0,
      pageLoading: true,
      appCounts: {
        all: 0,
        public: 0,
        private: 0,
        restricted: 0,
      },
      apps: [],
      appsCount: 0,
      appLoading: false,
      listScope: { kind: "all" },
      globalDashboardOrderIds: null,
      collectionDashboardOrderIds: null,
      collectionOrderForId: null,
      defaultAiModel: FALLBACK_AI_MODEL,
    });
  },
}));
