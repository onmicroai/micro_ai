import { create } from 'zustand';
import { SurveyState, SaveState, ModelTemperatureRanges, AttachedFile } from '../types';
import axiosInstance from "@/utils//axiosInstance";
import { toast } from 'react-toastify';
import debounce from 'lodash/debounce';
import { fetchUserCollectionsSingleton } from '../utils/fetchCollectionsList';
import { fetchAvailableModelsSingleton } from '../utils/fetchAvailableModels';
import { updateMicroappCollection } from '../utils/updateMicroappCollection';

const initialState = {
  phases: [
    { 
      id: '1', 
      name: 'phase1',
      title: 'Phase 1',
      description: '', 
      elements: [], 
      prompts: [],
      skipPhase: false,
      scoredPhase: false,
      rubric: '',
    }
  ],
  title: '',
  description: '',
  collectionId: null,
  privacy: 'private',
  clonable: true,
  completedHtml: '',
  attachedFiles: [] as AttachedFile[],
  //debounce state
  saveState: {
    isSaving: false,
    lastSaved: null,
    error: null,
  } as SaveState,
  appId: null as number | null,
  // Flag to determine if it's the initial load to prevent initial PUT request
  isInitialLoad: true,
  collections: [] as { value: number; text: string }[],
  availableModels: {} as ModelTemperatureRanges,
  isLoadingCollections: false,
  isLoadingModels: false,
  aiConfig: {
    aiModel: 'gpt-4o-mini',
    temperature: 0.7,
    maxResponseTokens: null,
    systemPrompt: ""
  },
};

export const useSurveyStore = create<SurveyState>((set, get) => {
  /**
   * Debounced function to save the survey to the server, prevents multiple saves in a short period of time
   * @param signal - The AbortSignal to cancel the request
   */
   const debouncedSaveToServer = debounce(async (signal?: AbortSignal) => {
    const state = get();
    const { appId, saveState, isInitialLoad } = state;

    if (!appId || saveState.isSaving) {
      return;
    }

    // If it's the initial load, set the flag to false and return
    if (isInitialLoad === true) {
      set({ isInitialLoad: false });
      return;
    }

    try {
      set((state) => ({ 
        saveState: { ...state.saveState, isSaving: true, error: null } 
      }));

      const api = axiosInstance();
      const data = {
        title: state.title || "Untitled App",
        privacy: state.privacy,
        copy_allowed: state.clonable,
        ai_model: state.aiConfig.aiModel,
        temperature: state.aiConfig.temperature,
        explanation: state.description,
        app_json: {
          phases: state.phases,
          title: state.title,
          description: state.description,
          privacySettings: state.privacy,
          clonable: state.clonable,
          completedHtml: state.completedHtml,
          aiConfig: state.aiConfig,
          attachedFiles: state.attachedFiles
        },
      };

      await api.put(`/api/microapps/${appId}`, data, {
        signal: signal
      });

      set((state) => ({ 
        saveState: { 
          ...state.saveState, 
          isSaving: false, 
          lastSaved: new Date(),
          error: null 
        } 
      }));
      
      toast.success('Changes saved successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to save';
      set((state) => ({ 
        saveState: { 
          ...state.saveState, 
          isSaving: false,
          error: errorMessage
        } 
      }));
      
      toast.error(`Failed to save: ${errorMessage}`);
    }
  }, 1000);

  // Create singleton instances
  const fetchCollectionsInitial = fetchUserCollectionsSingleton();
  const fetchModelsInitial = fetchAvailableModelsSingleton();

  return {
    ...initialState,

    /**
     * Sets the save state of the survey
     * @param saveState - The save state of the survey
     */
    setSaveState: (saveState: Partial<SaveState>) => 
      set((state) => ({ 
        saveState: { ...state.saveState, ...saveState } 
      })),

    /**
     * Sets the app ID of the survey
     * @param id - The ID of the survey
     */
    setAppId: (id: number | null) => set({ appId: id }),

    /**
     * Sets the phases of the survey
     * @param phases - The phases of the survey
     * @param skipServerUpdate - Whether to skip saving to server
     * @param signal - The AbortSignal to cancel the request
     */
    setPhases: async (phases, skipServerUpdate?: boolean, signal?: AbortSignal) => {
      const state = get();
      if (JSON.stringify(state.phases) !== JSON.stringify(phases)) {
        set({ phases });
        if (!skipServerUpdate) {
          await get().saveToServer(signal);
        }
      }
    },

    /**
     * Sets the title of the survey
     * @param title - The title of the survey
     * @param skipServerUpdate - Whether to skip saving to server
     * @param signal - The AbortSignal to cancel the request
     */
    setTitle: async (title, skipServerUpdate?: boolean, signal?: AbortSignal) => {
      const state = get();
      if (state.title !== title) {
        set({ title });
        if (!skipServerUpdate) {
          await get().saveToServer(signal);
        }
      }
    },

    /**
     * Sets the description of the survey
     * @param description - The description of the survey
     * @param skipServerUpdate - Whether to skip saving to server
     * @param signal - The AbortSignal to cancel the request
     */
    setDescription: async (description, skipServerUpdate?: boolean, signal?: AbortSignal) => {
      const state = get();
      if (state.description !== description) {
        set({ description });
        if (!skipServerUpdate) {
          await get().saveToServer(signal);
        }
      }
    },

    /**
     * Updates the collection ID of the app
     * @param id - The new collection ID
     * @param skipServerUpdate - Whether to skip saving to server
     * @param signal - The AbortSignal to cancel the request
     * @returns 
     */
    setCollectionId: async (id: number | null, skipServerUpdate?: boolean, signal?: AbortSignal) => {
      const state = get();
      const oldCollectionId = state.collectionId;
      const appId = state.appId;

      // If id is null, we're just updating the state
      if (id === null) {
        set({ collectionId: null });
        return;
      }

      if (!appId) {
        toast.error('Cannot update collection: App ID is missing');
        return;
      }

      if (skipServerUpdate) {
        set({ collectionId: id });
        return;
      }

      try {
        // Only pass oldCollectionId if it's a number
        if (typeof oldCollectionId === 'number') {
          await updateMicroappCollection(appId, id, oldCollectionId, signal);
        } else {
          await updateMicroappCollection(appId, id, undefined, signal);
        }
        set({ collectionId: id });
        toast.success('Collection updated successfully');
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to update collection';
        toast.error(`Failed to update collection: ${errorMessage}`);
        // Revert the UI state on error
        set({ collectionId: oldCollectionId });
      }
    },

    /**
     * Sets the privacy of the survey
     * @param privacy - The privacy of the survey
     * @param skipServerUpdate - Whether to skip saving to server
     * @param signal - The AbortSignal to cancel the request
     */
    setPrivacy: async (privacy, skipServerUpdate?: boolean, signal?: AbortSignal) => {
      const state = get();
      if (state.privacy !== privacy) {
        set({ privacy });
        if (!skipServerUpdate) {
          await get().saveToServer(signal);
        }
      }
    },

    /**
     * Sets the clonable of the survey
     * @param clonable - The clonable of the survey
     * @param skipServerUpdate - Whether to skip saving to server
     * @param signal - The AbortSignal to cancel the request
     */
    setClonable: async (clonable, skipServerUpdate?: boolean, signal?: AbortSignal) => {
      const state = get();
      if (state.clonable !== clonable) {
        set({ clonable });
        if (!skipServerUpdate) {
          await get().saveToServer(signal);
        }
      }
    },

    /**
     * Sets the completed HTML of the survey
     * @param completedHtml - The completed HTML of the survey
     * @param skipServerUpdate - Whether to skip saving to server
     * @param signal - The AbortSignal to cancel the request
     */
    setCompletedHtml: async (completedHtml, skipServerUpdate?: boolean, signal?: AbortSignal) => {
      const state = get();
      if (state.completedHtml !== completedHtml) {
        set({ completedHtml });
        if (!skipServerUpdate) {
          await get().saveToServer(signal);
        }
      }
    },

    /**
     * Sets the AI config of the survey
     * @param aiConfig - The AI config of the survey
     * @param skipServerUpdate - Whether to skip saving to server
     * @param signal - The AbortSignal to cancel the request
     */
    setAIConfig: async (aiConfig, skipServerUpdate?: boolean, signal?: AbortSignal) => {
      const state = get();
      if (JSON.stringify(state.aiConfig) !== JSON.stringify(aiConfig)) {
        set({ aiConfig });
        if (!skipServerUpdate) {
          await get().saveToServer(signal);
        }
      }
    },

    /**
    * Sets the attached files of the survey
     * @param attachedFiles - The attached files of the survey
     * @param skipServerUpdate - Whether to skip saving to server
     * @param signal - The AbortSignal to cancel the request
     */
      setAttachedFiles: async (attachedFiles: AttachedFile[], skipServerUpdate?: boolean, signal?: AbortSignal) => {
      const state = get();
      if (JSON.stringify(state.attachedFiles) !== JSON.stringify(attachedFiles)) {
         set({ attachedFiles });
         if (!skipServerUpdate) {
            await get().saveToServer(signal);
         }
      }
      },

    /**
     * Saves the survey to the server
     * @param signal - The AbortSignal to cancel the request
     * @returns 
     */
    saveToServer: (signal?: AbortSignal) => {
      return Promise.resolve(debouncedSaveToServer(signal));
    },

    /**
     * Sets the initial load of the survey
     * @param isInitialLoad - The initial load of the survey
     */
    setIsInitialLoad: (isInitialLoad: boolean) => set({ isInitialLoad }),

    /**
     * Resets the store
     */
    resetStore: () => {
      debouncedSaveToServer.cancel();
      set(initialState);
    },

    /**
     * Fetches the collections of the survey
     */
    fetchCollections: async () => {
      set({ isLoadingCollections: true });
      try {
        const collections = await fetchCollectionsInitial();
        set({ collections: collections || [], isLoadingCollections: false });
      } catch (error) {
        console.error('Failed to fetch collections:', error);
        set({ isLoadingCollections: false });
      }
    },
    /**
     * Adds a filename to the list of attached files
     * @param filename - The filename to add
     * @param skipServerUpdate - Whether to skip saving to server
     * @param signal - The AbortSignal to cancel the request
     */
    addAttachedFile: async (file: AttachedFile, skipServerUpdate?: boolean, signal?: AbortSignal) => {
      set((state) => ({
        attachedFiles: [...state.attachedFiles, file]
      }));
      if (!skipServerUpdate) {
        await get().saveToServer(signal);
      }
    },

    /**
     * Removes a filename from the list of attached files
     * @param filename - The filename to remove
     * @param skipServerUpdate - Whether to skip saving to server
     * @param signal - The AbortSignal to cancel the request
     */
    removeAttachedFile: async (filename: string, skipServerUpdate?: boolean, signal?: AbortSignal) => {
      set((state) => ({
        attachedFiles: state.attachedFiles.filter(f => f.filename !== filename)
      }));
      if (!skipServerUpdate) {
        await get().saveToServer(signal);
      }
    },

    /**
     * Fetches the models of the survey
     */
    fetchModels: async () => {
      set({ isLoadingModels: true });
      try {
        let models = await fetchModelsInitial();
        if (models === null) {
          models = {} as ModelTemperatureRanges;
        }
        set({ availableModels: models, isLoadingModels: false });
      } catch (error) {
        console.error('Failed to fetch models:', error);
        set({ isLoadingModels: false });
      }
    },


  };
});
