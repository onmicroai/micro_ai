import { create } from 'zustand';
import { Collection, AppSerialized, AppRaw } from '@/app/(authenticated)/(dashboard)/types';
import axiosInstance from '@/utils/axiosInstance';
import { toast } from 'react-toastify';

interface DashboardStore {
   // State
   collections: Collection[];
   collection: Collection | null;
   collectionCount: number;
   collectionLoading: boolean;
   pageLoading: boolean;
   appCounts: { [key: string]: number };
   tabTypes: { label: string, value: string }[];
   apps: AppSerialized[];
   appsCount: number;
   appLoading: boolean;
   activeCollectionId: number | null;
   // Actions
   fetchCollections: (signal?: AbortSignal) => Promise<void>;
   createCollection: () => Promise<void>;
   updateCollectionName: (collectionId: number, newName: string) => Promise<void>;
   countAppPrivacyTypes: (apps: AppSerialized[]) => void;
   fetchApps: (collectionId: number, signal?: AbortSignal) => Promise<void>;
   createApp: (collectionId: number) => Promise<string | null>;
   cloneApp: (appId: number, collectionId?: number) => Promise<void>;
   deleteApp: (appId: number) => void;
   appSerializer: (app: AppRaw | AppRaw[]) => AppSerialized | AppSerialized[];
   setActiveCollectionId: (collectionId: number) => void;
   handleCreateApp: (collectionId: number) => Promise<string | null>;
   reset: () => void;
}

const sortCollectionsById = (collections: Collection[]): Collection[] => {
   return [...collections].sort((a, b) => a.id - b.id);
};

export const useDashboardStore = create<DashboardStore>((set, get) => ({
   // Initial state
   collections: [],
   collection: null,
   collectionCount: 0,
   collectionLoading: false,
   pageLoading: true,
   appCounts: {
      "all": 0,
      "public": 0,
      "private": 0,
      "restricted": 0
   },
   tabTypes: [
      { label: "All", value: "all" },
      { label: "Public", value: "public" },
      { label: "Private", value: "private" },
      { label: "Restricted", value: "restricted" },
   ],
   apps: [],
   appsCount: 0,
   appLoading: false,
   activeCollectionId: null,

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

            if (data.length > 0) {
               const collection = data[0];
               set({
                  collection,
                  activeCollectionId: collection.id
               });
            }
         } else {
            toast.error("Failed to fetch collections", { theme: "colored" });
         }
      } catch (error: any) {
         // Ignore CanceledError from AbortController
         if (error.name !== 'CanceledError' && error.name !== 'AbortError') {
            toast.error("Failed to fetch collections: " + (error.response?.data?.message || error.message), { theme: "colored" });
         }
      } finally {
         set({ pageLoading: false });
      }
   },

   /**
    * Creates a new collection for the current user.
    */
   createCollection: async () => {
      const api = axiosInstance();
      set({ collectionLoading: true });
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
               collectionCount: state.collectionCount + 1
            }));
            toast.success("Collection created successfully!", { theme: "colored" });
         } else {
            toast.error("Failed to create collection", { theme: "colored" });
         }
      } catch (error: any) {
         const errorMessage = error.response?.data?.error || error.response?.data?.message || error.message;
         toast.error("Failed to create collection: " + errorMessage, { theme: "colored" });
      } finally {
         set({ collectionLoading: false });
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
            name: newName
         });
         if (response.data) {
            set((state) => ({
               collection: state.collection ? { ...state.collection, name: newName } : null,
               collections: state.collections.map(col => 
                  col.id === collectionId ? { ...col, name: newName } : col
               )
            }));
            toast.success("Collection name updated successfully", { theme: "colored" });
         }
      } catch (error: any) {
         const errorResponse = error?.response?.data || {};
         const errorMessage = errorResponse.error || errorResponse.message || error.message;
         toast.error("Failed to update collection name: " + errorMessage, { theme: "colored" });
      }
   },

   /**
    * Counts the privacy types of the apps in the collection.
    * @param {App[]} apps - The apps to count.
    */
   countAppPrivacyTypes: (apps: AppSerialized[]) => {
      const counts = apps.reduce((accumulator: { [key: string]: number }, app: AppSerialized) => {
         if (app.privacy !== undefined) {
            const appPrivacy = app.privacy.toLocaleLowerCase();
            accumulator[appPrivacy] = (accumulator[appPrivacy] || 0) + 1;
         }
         return accumulator;
      }, {});

      set(() => {
         const updatedAppCounts = {
            "all": 0,
            "public": 0,
            "private": 0,
            "restricted": 0
         };

         Object.keys(updatedAppCounts).forEach(key => {
            if (key === "all") {
               return;
            }
            const countKey = counts[key];
            updatedAppCounts.all += (countKey || 0);
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
            collectionId: serializedApp.collection_id,
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
         const response = await api.get(`/api/collection/user/apps/${collectionId}`, { signal });
         const data = response?.data?.data;
         
         if (data !== undefined) {
            const serializedData = get().appSerializer(data);
            if (Array.isArray(serializedData)) {
               set({ 
                  apps: serializedData,
                  appsCount: data.length 
               });
               get().countAppPrivacyTypes(serializedData);
            }
         }
      } catch (error: any) {
         // Ignore CanceledError from AbortController
         if (error.name !== 'CanceledError') {  
            const errorMessage = error.response?.data?.error || error.response?.data?.message || error.message;
            toast.error("Failed to fetch apps: " + errorMessage, { theme: "colored" });
         }
      } finally {
         set({ appLoading: false });
      }
   },

   /**
    * Creates a new app in the specified collection.
    * @param {number} collectionId - The ID of the collection to create the app in.
    * @returns {Promise<string | null>} - The hash ID of the new app or null if creation fails.
    */
   createApp: async (collectionId: number): Promise<string | null> => {
      const api = axiosInstance();
      set({ appLoading: true });
      
      try {
         const nextAppNumber = get().appsCount + 1;
         const nextAppName = "App " + nextAppNumber;

         const defaultAppDetails = {
            title: nextAppName,
            type: "Private",
            copyAllowed: true,
            app_json: "",
            collection_id: collectionId,
         };

         const response = await api.post("/api/microapps/", defaultAppDetails);
         const data = response?.data?.data;
         
         if (data !== undefined) {
            const serializedData = get().appSerializer(data) as AppSerialized;
            if (!Array.isArray(serializedData)) {
               set(state => ({ 
                  apps: [...state.apps, serializedData],
                  appsCount: state.appsCount + 1 
               }));
               get().countAppPrivacyTypes([serializedData]);
               toast.success("Redirecting to the app editor...", { theme: "colored" });
               set({ appLoading: false });
               return serializedData.hashId;
            }
            set({ appLoading: false });
            return null;
         }
         set({ appLoading: false });
         return null;
      } catch (error: any) {
         const errorMessage = error.response?.data?.error || error.response?.data?.message || error.message;
         toast.error("Failed to create app: " + errorMessage, { theme: "colored" });
         set({ appLoading: false });
         return null;
      }
   },

   /**
    * Clones an existing app within the specified collection.
    * @param {number} appId - The ID of the app to clone.
    * @param {number} [collectionId] - Optional ID of the collection to clone the app to.
    */
   cloneApp: async (appId: number, collectionId?: number) => {
      set({ appLoading: true });
      const api = axiosInstance();
      try {
         // Use simpler URL if no collection ID provided
         const url = collectionId ? `/api/microapps/${appId}/${collectionId}/clone` : `/api/microapps/${appId}/clone`;
         const response = await api.post(url);
         const data = response?.data?.data;
         
         if (data !== undefined) {
            const serializedData = get().appSerializer(data) as AppSerialized;
            set(state => ({ 
               apps: [...state.apps, serializedData],
               appsCount: state.appsCount + 1 
            }));
            get().countAppPrivacyTypes([serializedData]);
            
            // Redirect to the new app
            window.location.href = `/app/${serializedData.hashId}`;
         }
         set({ appLoading: false });
      } catch (error: any) {
         const errorMessage = error.response?.data?.error || error.response?.data?.message || error.message;
         toast.error("Failed to clone app: " + errorMessage, { theme: "colored" });
         set({ appLoading: false });
      } 
   },

   /**
    * Removes an app from the local state after deletion.
    * @param {number} deletedAppId - The ID of the app to delete.
    */
   deleteApp: (deletedAppId: number) => {
      set(state => {
         const updatedApps = state.apps.filter(app => app.id !== deletedAppId);
         get().countAppPrivacyTypes(updatedApps);
         return {
            apps: updatedApps,
            appsCount: state.appsCount - 1
         };
      });
   },

   /**
    * Sets the active collection in the state.
    * @param {number} collectionId - The ID of the collection to set as active.
    */
   setActiveCollectionId: (collectionId: number) => {
      const collection = get().collections.find((c: any) => c.id === collectionId);
      set({ 
         activeCollectionId: collectionId,
         collection: collection || null,
      });
   },

   handleCreateApp: async (collectionId: number) => {
      const newAppHashId = await get().createApp(collectionId);
      if (newAppHashId) {
         window.location.href = `/app/edit/${newAppHashId}`;
      }
      return newAppHashId;
   },

   reset: () => {
      set({
         collections: [],
         collection: null,
         collectionCount: 0,
         collectionLoading: false,
         pageLoading: true,
         appCounts: {
            "all": 0,
            "public": 0,
            "private": 0,
            "restricted": 0
         },
         apps: [],
         appsCount: 0,
         appLoading: false,
         activeCollectionId: null
      });
   }
}));