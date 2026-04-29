import { create } from "zustand";
import {
  SurveyState,
  SaveState,
  ModelTemperatureRanges,
  AttachedFile,
  ChatBuildMessage,
  AppJsonV2,
} from "@/app/(authenticated)/app/types";
import axiosInstance from "@/utils//axiosInstance";
import { toast } from "react-toastify";
import debounce from "lodash/debounce";
import { fetchUserCollectionsSingleton } from "../utils/fetchCollectionsList";
import { fetchAvailableModelsSingleton } from "../utils/fetchAvailableModels";
import { fetchLiteLLMModelsSingleton } from "../utils/fetchLiteLLMModels";
import {
  addMicroappToCollection,
  removeMicroappFromCollection,
} from "../utils/updateMicroappCollection";
import {
  APP_BUILDER_UNDO_STACK_MAX,
  readAppBuilderSession,
  writeAppBuilderSession,
} from "./appBuilderSessionStorage";

const initialState = {
  elements: [],
  title: "",
  description: "",
  collectionIds: [] as number[],
  privacy: "private",
  permittedDomains: [] as string[],
  clonable: true,
  completedHtml: "",
  attachedFiles: [] as AttachedFile[],
  //debounce state
  saveState: {
    isSaving: false,
    isDebouncing: false,
    lastSaved: null,
    error: null,
  } as SaveState,
  appId: null as number | null,
  // Flag to determine if it's the initial load to prevent initial PUT request
  isInitialLoad: true,
  collections: [] as { value: number; text: string }[],
  availableModels: {} as ModelTemperatureRanges,
  defaultAiModel: "",
  isLoadingCollections: false,
  isLoadingModels: false,
  aiConfig: {
    aiModel: "",
    temperature: 0.7,
    maxResponseTokens: null,
    systemPrompt: "",
  },
  conditionalSidebarOpen: false,
  conditionalSidebarContext: null as SurveyState["conditionalSidebarContext"],

  // App Builder Chat sidebar
  chatBuildSidebarOpen: false,
  chatBuildMessages: [] as ChatBuildMessage[],
  appBuilderUndoStack: [] as AppJsonV2[],
};

export const useSurveyStore = create<SurveyState>((set, get) => {
  /**
   * Persists current editor state to the server (single flight; skips during initial load).
   */
  const runSaveToServer = async (signal?: AbortSignal) => {
    const state = get();
    const { appId, saveState, isInitialLoad } = state;

    if (!appId || saveState.isSaving) {
      if (saveState.isDebouncing) {
        set((s) => ({
          saveState: { ...s.saveState, isDebouncing: false },
        }));
      }
      return;
    }

    if (isInitialLoad === true) {
      set((s) => ({
        isInitialLoad: false,
        saveState: { ...s.saveState, isDebouncing: false },
      }));
      return;
    }

    try {
      set((s) => ({
        saveState: {
          ...s.saveState,
          isSaving: true,
          isDebouncing: false,
          error: null,
        },
      }));

      const cur = get();
      const appJsonData: Record<string, unknown> = {
        title: cur.title,
        description: cur.description,
        privacySettings: cur.privacy,
        clonable: cur.clonable,
        completedHtml: cur.completedHtml,
        aiConfig: cur.aiConfig,
        attachedFiles: cur.attachedFiles,
        elements: cur.elements,
      };

      const data: Record<string, unknown> = {
        title: cur.title || "Untitled App",
        privacy: cur.privacy,
        copy_allowed: cur.clonable,
        ai_model: cur.aiConfig.aiModel,
        temperature: cur.aiConfig.temperature,
        explanation: cur.description,
        app_json: appJsonData,
      };
      if (cur.privacy === "restricted") {
        data.permitted_domains = cur.permittedDomains ?? [];
      }

      const api = axiosInstance();
      await api.put(`/api/microapps/${appId}`, data, {
        signal: signal,
      });

      set((s) => ({
        saveState: {
          ...s.saveState,
          isSaving: false,
          isDebouncing: false,
          lastSaved: new Date(),
          error: null,
        },
      }));
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to save";
      set((s) => ({
        saveState: {
          ...s.saveState,
          isSaving: false,
          isDebouncing: false,
          error: errorMessage,
        },
      }));

      toast.error(`Failed to save: ${errorMessage}`);
    }
  };

  const debouncedSaveToServer = debounce((signal?: AbortSignal) => {
    void runSaveToServer(signal);
  }, 1000);

  const persist_app_builder_session = () => {
    const { appId, chatBuildMessages, appBuilderUndoStack } = get();
    if (!appId) return;
    try {
      writeAppBuilderSession(appId, {
        messages: chatBuildMessages,
        undoStack: appBuilderUndoStack,
      });
    } catch (e) {
      console.warn(
        "App Builder: could not persist session (storage full or disabled)",
        e
      );
    }
  };

  // Create singleton instances
  const fetchCollectionsInitial = fetchUserCollectionsSingleton();
  const fetchModelsInitial = fetchAvailableModelsSingleton();
  const fetchLiteLLMModelsInitial = fetchLiteLLMModelsSingleton();

  return {
    ...initialState,

    /**
     * Sets the save state of the survey
     * @param saveState - The save state of the survey
     */
    setSaveState: (saveState: Partial<SaveState>) =>
      set((state) => ({
        saveState: { ...state.saveState, ...saveState },
      })),

    /**
     * Sets the app ID of the survey
     * @param id - The ID of the survey
     */
    setAppId: (id: number | null) => set({ appId: id }),

    /**
     * Sets the elements of the builder (V2 schema).
     */
    setElements: async (
      elements,
      skipServerUpdate?: boolean,
      signal?: AbortSignal
    ) => {
      const state = get();
      if (JSON.stringify(state.elements) !== JSON.stringify(elements)) {
        set({ elements });
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
    setTitle: async (
      title,
      skipServerUpdate?: boolean,
      signal?: AbortSignal
    ) => {
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
    setDescription: async (
      description,
      skipServerUpdate?: boolean,
      signal?: AbortSignal
    ) => {
      const state = get();
      if (state.description !== description) {
        set({ description });
        if (!skipServerUpdate) {
          await get().saveToServer(signal);
        }
      }
    },

    /**
     * Sets the collection IDs for the app (initial load only; no API calls).
     */
    setCollectionIds: (
      ids: number[],
      _skipServerUpdate?: boolean,
      _signal?: AbortSignal
    ) => {
      set({ collectionIds: ids ?? [] });
    },

    /**
     * Adds the app to a collection (many-to-many).
     */
    addCollection: async (id: number, signal?: AbortSignal) => {
      const state = get();
      const appId = state.appId;
      if (!appId) {
        toast.error("Cannot add to collection: App ID is missing");
        return;
      }
      if (state.collectionIds.includes(id)) {
        return;
      }
      try {
        await addMicroappToCollection(appId, id, signal);
        set((s) => ({
          collectionIds: [...s.collectionIds, id].sort((a, b) => a - b),
        }));
        toast.success("Added to collection");
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : "Failed to add to collection";
        toast.error(errorMessage);
      }
    },

    /**
     * Removes the app from a collection (many-to-many).
     */
    removeCollection: async (id: number, signal?: AbortSignal) => {
      const state = get();
      const appId = state.appId;
      if (!appId) {
        toast.error("Cannot remove from collection: App ID is missing");
        return;
      }
      if (!state.collectionIds.includes(id)) {
        return;
      }
      try {
        await removeMicroappFromCollection(appId, id, signal);
        set((s) => ({
          collectionIds: s.collectionIds.filter((c) => c !== id),
        }));
        toast.success("Removed from collection");
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : "Failed to remove from collection";
        toast.error(errorMessage);
      }
    },

    /**
     * Sets the privacy of the survey
     * @param privacy - The privacy of the survey
     * @param skipServerUpdate - Whether to skip saving to server
     * @param signal - The AbortSignal to cancel the request
     */
    setPrivacy: async (
      privacy,
      skipServerUpdate?: boolean,
      signal?: AbortSignal
    ) => {
      const state = get();
      if (state.privacy !== privacy) {
        set({ privacy });
        if (!skipServerUpdate) {
          await get().saveToServer(signal);
        }
      }
    },

    setPermittedDomains: (domains: string[]) => {
      set({ permittedDomains: domains ?? [] });
    },

    /**
     * Sets the clonable of the survey
     * @param clonable - The clonable of the survey
     * @param skipServerUpdate - Whether to skip saving to server
     * @param signal - The AbortSignal to cancel the request
     */
    setClonable: async (
      clonable,
      skipServerUpdate?: boolean,
      signal?: AbortSignal
    ) => {
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
    setCompletedHtml: async (
      completedHtml,
      skipServerUpdate?: boolean,
      signal?: AbortSignal
    ) => {
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
    setAIConfig: async (
      aiConfig,
      skipServerUpdate?: boolean,
      signal?: AbortSignal
    ) => {
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
    setAttachedFiles: async (
      attachedFiles: AttachedFile[],
      skipServerUpdate?: boolean,
      signal?: AbortSignal
    ) => {
      const state = get();
      if (
        JSON.stringify(state.attachedFiles) !== JSON.stringify(attachedFiles)
      ) {
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
      set((state) => ({
        saveState: {
          ...state.saveState,
          isDebouncing: true,
          error: null,
        },
      }));
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
        console.error("Failed to fetch collections:", error);
        set({ isLoadingCollections: false });
      }
    },
    /**
     * Adds a filename to the list of attached files
     * @param filename - The filename to add
     * @param skipServerUpdate - Whether to skip saving to server
     * @param signal - The AbortSignal to cancel the request
     */
    addAttachedFile: async (
      file: AttachedFile,
      skipServerUpdate?: boolean,
      signal?: AbortSignal
    ) => {
      set((state) => ({
        attachedFiles: [...state.attachedFiles, file],
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
    removeAttachedFile: async (
      original_filename: string,
      skipServerUpdate?: boolean,
      signal?: AbortSignal
    ) => {
      set((state) => ({
        attachedFiles: state.attachedFiles.filter(
          (f) => f.original_filename !== original_filename
        ),
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
        console.error("Failed to fetch models:", error);
        set({ isLoadingModels: false });
      }
    },

    /**
     * Fetches the models from LiteLLM
     */
    fetchLiteLLMModels: async () => {
      set({ isLoadingModels: true });
      try {
        const result = await fetchLiteLLMModelsInitial();
        set({
          availableModels: result?.models ?? ({} as ModelTemperatureRanges),
          defaultAiModel: result?.defaultModel ?? "",
          isLoadingModels: false,
        });
      } catch (error) {
        console.error("Failed to fetch LiteLLM models:", error);
        set({ isLoadingModels: false });
      }
    },

    conditionalSidebarOpen: false,
    setConditionalSidebarOpen: (open) => {
      set({ conditionalSidebarOpen: open });
    },
    setConditionalSidebarContext: (context) => {
      set({ conditionalSidebarContext: context });
    },

    // App Builder Chat sidebar
    chatBuildSidebarOpen: false,
    chatBuildMessages: [],

    setChatBuildSidebarOpen: (open: boolean) => {
      set({ chatBuildSidebarOpen: open });
    },

    addChatBuildMessage: (message: ChatBuildMessage) => {
      set((state) => ({
        chatBuildMessages: [...state.chatBuildMessages, message],
      }));
      persist_app_builder_session();
    },

    updateChatBuildMessage: (id: string, patch: Partial<ChatBuildMessage>) => {
      set((state) => ({
        chatBuildMessages: state.chatBuildMessages.map((msg) =>
          msg.id === id ? { ...msg, ...patch } : msg
        ),
      }));
      persist_app_builder_session();
    },

    getAppJsonSnapshot: (): AppJsonV2 => {
      const s = get();
      return {
        elements: s.elements,
        title: s.title,
        description: s.description,
        privacySettings: s.privacy,
        clonable: s.clonable,
        completedHtml: s.completedHtml ?? "",
        aiConfig: s.aiConfig,
        attachedFiles: s.attachedFiles,
      };
    },

    pushAppBuilderUndoSnapshot: () => {
      const snapshot = structuredClone(get().getAppJsonSnapshot());
      set((state) => {
        const next = [...state.appBuilderUndoStack, snapshot];
        const capped =
          next.length > APP_BUILDER_UNDO_STACK_MAX
            ? next.slice(-APP_BUILDER_UNDO_STACK_MAX)
            : next;
        return { appBuilderUndoStack: capped };
      });
      persist_app_builder_session();
    },

    undoLastAppBuilderChange: async () => {
      const stack = get().appBuilderUndoStack;
      if (stack.length === 0) return false;
      const previous = stack[stack.length - 1];
      set((state) => ({
        appBuilderUndoStack: state.appBuilderUndoStack.slice(0, -1),
      }));
      await get().replaceEntireAppJson(previous, { skipServerUpdate: true });
      persist_app_builder_session();
      return true;
    },

    hydrateAppBuilderFromSession: (forAppId: number) => {
      const saved = readAppBuilderSession(forAppId);
      if (!saved) return;
      set({
        chatBuildMessages: saved.messages,
        appBuilderUndoStack: saved.undoStack,
      });
    },

    /**
     * Replaces the entire app JSON with a new value generated by the AI builder.
     * Calls individual setters so the existing debounced save is triggered.
     * Use skipServerUpdate to batch all field updates then save once (e.g. undo).
     */
    replaceEntireAppJson: async (
      newJson: AppJsonV2,
      options?: { skipServerUpdate?: boolean }
    ) => {
      const skip = options?.skipServerUpdate ?? false;
      const {
        setElements,
        setTitle,
        setDescription,
        setAIConfig,
        setPrivacy,
        setClonable,
        setCompletedHtml,
        setAttachedFiles,
      } = get();

      if (newJson.elements !== undefined) {
        await setElements(newJson.elements, skip);
      }
      if (newJson.title !== undefined) {
        await setTitle(newJson.title, skip);
      }
      if (newJson.description !== undefined) {
        await setDescription(newJson.description, skip);
      }
      if (newJson.aiConfig !== undefined) {
        await setAIConfig(newJson.aiConfig, skip);
      }
      if (newJson.privacySettings !== undefined) {
        await setPrivacy(newJson.privacySettings, skip);
      }
      if (newJson.clonable !== undefined) {
        await setClonable(newJson.clonable, skip);
      }
      if (newJson.completedHtml !== undefined) {
        await setCompletedHtml(newJson.completedHtml, skip);
      }
      if (newJson.attachedFiles !== undefined) {
        await setAttachedFiles(newJson.attachedFiles, skip);
      }
      if (skip) {
        await get().saveToServer();
      }
    },
  };
});
