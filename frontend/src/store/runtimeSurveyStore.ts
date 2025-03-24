import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { SurveyJson, SurveyPage, Element, ErrorObject, SendPromptResponse, SurveyStore, Answers, Prompt, Base64Images } from '@/app/(authenticated)/app/types';
import axiosInstance from "@/utils//axiosInstance";
import axios from "axios";
import { sendPromptsUtil } from '@/utils//sendPrompts';

/**
 * Serializes the raw app data into a SurveyJson format.
 * 
 * @param data - The raw app data to serialize.
 * @returns A SurveyJson object.
 */
const serializeAppData = (data: any): SurveyJson => {
   let parsedJSON = data || {};
   let appJson = {
      phases: [],
   };

   if (typeof data === "string") {
      try {
         parsedJSON = JSON.parse(data);
      } catch (error) {
         throw new Error("Error parsing data string: " + error);
      }
   }

   if (parsedJSON?.app_json) {
      if (typeof parsedJSON.app_json === "string") {
         try {
            appJson = JSON.parse(parsedJSON.app_json);
         } catch (error) {
            throw new Error("Error parsing app_json string: " + error);
         }
      } else if (typeof parsedJSON.app_json === "object") {
         appJson = parsedJSON.app_json;
      }
   }

   if (!appJson.phases) {
      appJson.phases = [];
   }

   return {
      title: parsedJSON?.title || "",
      description: parsedJSON?.app_json?.description || "",
      id: parsedJSON?.id || null,
      hashId: parsedJSON?.hash_id || null,
      privacy: parsedJSON?.privacy || "Public",
      temperature: parsedJSON?.temperature || 0.5,
      copyAllowed: parsedJSON?.copy_allowed ?? true,
      aiConfig: parsedJSON?.app_json?.aiConfig || [],
      phases: appJson.phases,
      completedHtml: parsedJSON?.app_json?.completedHtml || "You've reached the end",
   };
};

/**
    * Serializes the answers state.
    * 
    * @param answers - The answers state.
    * @param name - The name of the input field.
    * @param value - The value of the input field.
    * @param otherValue - The other value of the input field.
    * @param type - The type of the input field.
    */
const answersSerializer = (answers: Answers, name: string, value: string | string[] | undefined, otherValue: string, type: string): Answers => {
   const updatedValue: any = {};

   switch (type) {
      case "text":
         updatedValue.value = value;
         break;
      case "textarea":
         updatedValue.value = value;
         break;
      case "radiogroup":
         if (value !== "") {
            updatedValue.value = value;
         }

         if (otherValue !== "") {
            updatedValue.otherValue = otherValue;
         }
         break;
      case "dropdown":
         if (value !== "") {
            updatedValue.value = value;
         }

         if (otherValue !== "") {
            updatedValue.otherValue = otherValue;
         }
         break;
      case "checkbox":
         if (Array.isArray(value)) {
            updatedValue.value = value;
         }

         if (otherValue !== "") {
            updatedValue.otherValue = otherValue;
         }
         break;
      case "slider":
         updatedValue.value = value;
         break;
      case "boolean":
         updatedValue.value = value;
         break;
      case "imageUpload":
         if (Array.isArray(value)) {
            updatedValue.value = value;
         } else if (value) {
            updatedValue.value = [value];
         }
         break;
      default:
         updatedValue.value = value;
   }

   return {
      ...answers,
      [name]: updatedValue,
   };
};

interface ProcessedPrompts {
  prompts: string[];
  aiInstructions: string[];
  fixedResponses: string[];
}

export const useSurveyStore = create<SurveyStore>()(
  persist(
    (set, get) => ({
      prompt: null,
      aiInstructions: null,
      surveyJson: null,
      currentPhase: null,
      currentPhaseIndex: 0,
      answers: {},
      images: {} as Base64Images,
      responses: [],
      completedPhases: [],
      errors: [],
      loading: true,
      promptLoading: false,
      promptResponse: null,
      sendPromptError: null,
      appFetchLoading: false,
      appFetchError: {
         status: null,
         message: null,
      },
      elements: [] as Element[],
      processedPrompts: {
         prompts: [],
         aiInstructions: [],
         fixedResponses: [],
      } as ProcessedPrompts,
      userRole: null,
      userRoleLoading: false,
      userRoleError: null,
      /**
    * Checks if the given prompt is empty.
    * @param prompt - The prompt to check, can be a string or an array.
    * @returns True if the prompt is empty, false otherwise.
    */
      isPromptEmpty: (prompt: string | any[]): boolean => {
         if (typeof prompt === 'string') {
            return prompt.trim() === '';
         }

         if (!Array.isArray(prompt) || prompt.length === 0) {
            return true;
         }

         return prompt.every(item =>
            !item ||
            typeof item !== 'object' ||
            !item.content ||
            item.content.trim() === ''
         );
      },
      /**
       * TODO: refactor this method, split into smaller methods
       * 
       * Fetches the app data for a given ID.
       * @param hashId - The hash ID of the app to fetch.
       * @param privatePage - Boolean indicating if the app is private.
       * @param signal - The AbortSignal to cancel the request.
       * @returns Boolean indicating if the app was updated (true) or not (false).
       */
      fetchApp: async (hashId: string, privatePage: boolean, signal: AbortSignal) => {
         try {
            let response;
            if (privatePage === true) {
               const api = axiosInstance();
               response = await api.get(`/api/microapps/hash/${hashId}`, { signal });
            } else {
               response = await axios.get(`/api/microapps/public/hash/${hashId}`, { signal });
            }
            const parsedData = serializeAppData(response?.data?.data);
            
            const currentAppId = get().surveyJson?.id;
            const newAppId = parsedData?.id;
            let wasUpdated = false;
            
            if (currentAppId !== newAppId) {
               get().reset();
               wasUpdated = true;
            }
            
            set({
               surveyJson: parsedData,
               loading: false,            
            });
            
            return wasUpdated;
         } catch (error: any) {
            // Don't handle abort signal specifically
            if (error.name !== "CanceledError") {
               let errorResponse = structuredClone(error?.response?.data || {});

               if (Array.isArray(errorResponse)) {
                  errorResponse = errorResponse[0];
               }

               if (typeof errorResponse === "object") {
                  errorResponse = errorResponse.error;
               }

               const errorMessage = "Failed to fetch app data: " + JSON.stringify(errorResponse);
               set({
                  appFetchError: {
                     status: error.response.status,
                     message: errorMessage,
                  },
                  loading: false,
                  surveyJson: serializeAppData(null),
               });
            }
            return false;
         }
      },
      /**
       * Sets the current prompt.
       * @param prompt - The new prompt value.
       */
      setPrompt: (prompt: string | null) => set({ prompt }),
      /**
       * Sets the AI instructions.
       * @param aiInstructions - The new AI instructions.
       */
      setAiInstructions: (aiInstructions: string | null) => set({ aiInstructions }),
      /**
       * Sets the survey JSON data.
       * @param surveyJson - The new survey JSON data.
       */
      setSurveyJson: (surveyJson: SurveyJson | null) => set({ surveyJson }),
      /**
       * Sets the current phase of the survey.
       * @param currentPhase - The new current phase.
       */
      setCurrentPhase: (currentPhase: SurveyPage | null) => set({ currentPhase }),
      /**
       * Sets the elements for the current phase.
       * @param elements - The new elements array.
       */
      setElements: (elements: Element[] | null) => set({ elements }),
      /**
       * Sets the index of the current phase.
       * @param currentPhaseIndex - The new phase index.
       */
      setCurrentPhaseIndex: (currentPhaseIndex: number) => set({ currentPhaseIndex }),
      /**
       * Updates the answers state using a callback function.
       * If there's no answer for a question, it checks for default values.
       * @param updater - A function that takes the previous answers and returns the new answers.
       */
      setAnswers: (updater: (answers: Answers) => Answers) => set((state: SurveyStore) => {
         const currentAnswers = state.answers;
         const updatedAnswers = updater(currentAnswers);

         // If there's no answer for a question, check for default values
         if (state.elements) {
            state.elements.forEach(element => {
               if (updatedAnswers[element.name] === undefined) {
                  if (element.defaultValue !== undefined) {
                     if (Array.isArray(element.defaultValue)) {
                        updatedAnswers[element.name] = {
                           value: [...element.defaultValue],
                        };
                     } else if (typeof element.defaultValue === 'string') {
                        updatedAnswers[element.name] = {
                           value: element.defaultValue,
                        };
                     }
                  } else {
                     // If the question is a boolean, set the value to "false", boolean can't be undefined
                     // Otherwise it will be validated as required
                     if (element.type === 'boolean') {
                        updatedAnswers[element.name] = {
                           value: "false",
                        };
                     }
                  }
               }
            });
         }

         return { answers: updatedAnswers };
      }),
      /**
       * Updates the images state using a callback function.
       * @param updater - A function that takes the previous images and returns the new images.
       */
   setImages: (updater) => set((state) => ({ images: updater(state.images) })),
      /**
       * Updates the responses state using a callback function.
       * @param updater - A function that takes the previous responses and returns the new responses.
       */
   setResponses: (updater) => set((state) => ({ responses: updater(state.responses) })),
      /**
       * Sets the completed phases.
       * @param completedPhases - An array of completed phase indices.
       */
      setCompletedPhases: (completedPhases: number[]) => set({ completedPhases }),
      /**
       * Sets the errors for the survey.
       * @param errors - An array of error objects.
       */
      setErrors: (errors: ErrorObject[]) => set({ errors }),
      /**
       * Sets the loading state of the survey.
       * @param loading - Boolean indicating if the survey is loading.
       */
      setLoading: (loading: boolean) => set({ loading }),
      /**
       * Sets the loading state for the prompt.
       * @param promptLoading - Boolean indicating if the prompt is loading.
       */
      setPromptLoading: (promptLoading: boolean) => set({ promptLoading }),
      /**
       * Sets the processed prompts.
       * @param processedPrompts - The processed prompts.
       */
      setProcessedPrompts: (processedPrompts: ProcessedPrompts) => set({ processedPrompts }),
      /**
       * Handles input changes for survey questions.
       * @param event - The change event from the input element.
       */
      handleInputChange: (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
         const { name, value, type } = event.target;
         const answers = get().answers;
         const updatedAnswers = answersSerializer(answers, name, value, "", type);
         set({ answers: updatedAnswers });
      },
      /**
       * Sets the value for an input field.
       * @param name - The name of the input field.
       * @param value - The value of the input field.
       * @param otherValue - The other value of the input field.
       * @param type - The type of the input field.
       */
      setInputValue: (name: string, value: string | string[] | undefined, otherValue: string, type: string) => {
         const answers = get().answers;
         const updatedAnswers = answersSerializer(answers, name, value, otherValue, type);
         set({ answers: updatedAnswers });
      },

      /**
       * Sets the response received from the prompt.
       * @param response - The response data from the prompt.
       */
      setPromptResponse: (response: any) => set({ promptResponse: response }),
      /**
       * Sets the error message for sending a prompt.
       * @param error - The error message or null if no error.
       */
      setSendPromptError: (error: string | null) => set({ sendPromptError: error }),
      /**
       * TODO: refactor this method, split into smaller methods
       * 
       * Sends a prompt to the AI and processes the response.
       * @param prompt - The prompt to send.
       * @param appId - The ID of the app.
       * @param appConfig - The configuration of the app.
       * @param pageIndex - The index of the current page.
       * @param userId - The ID of the user. null for public pages.
       * @param requestSkip - Boolean indicating if the request should be skipped.
       * @returns A promise that resolves to an object containing the success status and response or error.
       */
      sendPrompts: async (
         prompts: Prompt[] | null, 
         answers: Answers, 
         appId: number, 
         appConfig: SurveyJson | null, 
         pageIndex: number, 
         userId: number | null, 
         requestSkip: boolean = false,
         noSubmit: boolean  = false
      ): Promise<SendPromptResponse> => {
         set({ promptLoading: true, sendPromptError: null, promptResponse: null });
         const images = get().images; // Get images from store
         return sendPromptsUtil({
            prompts,
            answers,
            images,
            appId,
            appConfig,
            pageIndex,
            userId,
            requestSkip,
            set,
            noSubmit
         });
      },

      /**
      * Resets the store to its initial state.
      */
      reset: () => {
         set({
            prompt: null,
            aiInstructions: null,
            surveyJson: null,
            currentPhase: null,
            currentPhaseIndex: 0,
            answers: {},
            images: {},
            responses: [],
            completedPhases: [],
            errors: [],
            loading: false,
            promptLoading: false,
            promptResponse: null,
            sendPromptError: null,
            appFetchLoading: false,
            appFetchError: {
               status: null,
               message: null,
            },
            elements: [],
            processedPrompts: {
               prompts: [],
               aiInstructions: [],
               fixedResponses: [],
            },
            userRole: null,
            userRoleLoading: false,
            userRoleError: null,
         });
      },
      /**
       * Performs a soft reset of the store, preserving surveyJson, elements, and userRole.
       * Useful for clearing user progress without reloading the app structure.
       */
      softReset: () => {
         const state = get();
         set({
            prompt: null,
            aiInstructions: null,
            // Preserve surveyJson
            surveyJson: state.surveyJson,
            currentPhase: state.surveyJson?.phases?.[0] || null,
            currentPhaseIndex: 0,
            answers: {},
            images: {},
            responses: [],
            completedPhases: [],
            errors: [],
            loading: false,
            promptLoading: false,
            promptResponse: null,
            sendPromptError: null,
            appFetchLoading: false,
            appFetchError: {
               status: null,
               message: null,
            },
            // Preserve elements
            elements: state.elements,
            processedPrompts: {
               prompts: [],
               aiInstructions: [],
               fixedResponses: [],
            },
            // Preserve userRole data
            userRole: state.userRole,
            userRoleLoading: state.userRoleLoading,
            userRoleError: state.userRoleError,
         });
      },
      /**
       * Fetches the user's role for a specific app.
       * 
       * @param hashId - The hash ID of the app.
       * @param userId - The ID of the user.
       * @param signal - The AbortSignal to cancel the request.
       */
      fetchUserRole: async (hashId: string, userId: string, signal: AbortSignal) => {
         set({ userRoleLoading: true, userRoleError: null });
         try {
            const api = axiosInstance();
            const response = await api.get(`/api/microapps/hash/${hashId}/user/${userId}`, { signal });
            const userRole = response?.data?.data?.[0]?.role || null;
            set({
               userRole,
               userRoleLoading: false
            });
            return userRole;
         } catch (error: any) {
            // Don't handle abort signal specifically
            if (error.name !== "CanceledError") {
               let errorResponse = structuredClone(error?.response?.data || {});

               if (Array.isArray(errorResponse)) {
                  errorResponse = errorResponse[0];
               }

               if (typeof errorResponse === "object") {
                  errorResponse = errorResponse.error;
               }

               const errorMessage = "Failed to fetch user role: " + JSON.stringify(errorResponse);
               set({
                  userRoleError: {
                     status: error.response?.status,
                     message: errorMessage,
                  },
                  userRoleLoading: false,
                  userRole: null
               });
               throw error;
            }
         }
      },
    }),
    {
      name: 'survey-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        answers: state.answers,
        currentPhaseIndex: state.currentPhaseIndex,
        completedPhases: state.completedPhases,
        responses: state.responses,
        promptResponse: state.promptResponse,
        images: state.images,
        surveyJson: state.surveyJson,
        currentPhase: state.currentPhase,
        elements: state.elements,
        processedPrompts: state.processedPrompts,
        userRole: state.userRole,
        userRoleLoading: state.userRoleLoading,
        userRoleError: state.userRoleError,
      })      
    }
  )
);

