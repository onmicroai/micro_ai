// \microai-frontend\app\hooks\fetchLiteLLMModels.ts

import axiosInstance from "@/utils//axiosInstance"
import { ModelTemperatureRanges } from "@/app/(authenticated)/app/types";

const LOG_PREFIX = "[app-settings-models]";
const LITELLM_MODELS_ENDPOINT = "/api/microapps/models/litellm-configuration/";

const logModelsDebug = (event: string, payload?: Record<string, unknown>) => {
   if (payload) {
      console.log(`${LOG_PREFIX} ${event}`, payload);
      return;
   }
   console.log(`${LOG_PREFIX} ${event}`);
};

 function createErrorResponse(): ModelTemperatureRanges {
    return {
       "Failed to load list of LLM models...": {
          min: 0,
          max: 0
       }
    };
 }

/**
 * Async singleton, so if API request hasn't been resolved yet it puts all requests to queue
 *  
 * @returns 
 */
export const fetchLiteLLMModelsSingleton = (): () => Promise<ModelTemperatureRanges | null> => {
   const api = axiosInstance();
   let modelTemperatureRanges: ModelTemperatureRanges | null = null;
   let pendingRequests: Array<(models: ModelTemperatureRanges | null) => void> = [];
   let isFetching = false;

   return async () => {
      if (modelTemperatureRanges !== null) {
         logModelsDebug("cache-hit", {
            keysCount: Object.keys(modelTemperatureRanges).length,
            sampleKeys: Object.keys(modelTemperatureRanges).slice(0, 5),
         });
         return modelTemperatureRanges;
      }

      return new Promise<ModelTemperatureRanges | null>((resolve) => {
         pendingRequests.push(resolve);
         if (isFetching) {
            logModelsDebug("request-deduped-queued", {
               queuedBeforePush: pendingRequests.length - 1,
               queuedAfterPush: pendingRequests.length,
            });
            return;
         }

         isFetching = true;
         logModelsDebug("request-start", {
            endpoint: LITELLM_MODELS_ENDPOINT,
            hasCachedModels: modelTemperatureRanges !== null,
            queuedRequests: pendingRequests.length,
         });
         
         api.get(LITELLM_MODELS_ENDPOINT)
            .then((response:any) => {
               const rawData = response?.data;
               const responseData = rawData?.data;
               const availableModels = responseData?.models;
               const sampleModelNames = Array.isArray(availableModels)
                  ? availableModels.slice(0, 5).map((model: any) => model?.model_name ?? model?.model)
                  : [];
               logModelsDebug("response-received", {
                  status: response?.status,
                  topLevelKeys: rawData ? Object.keys(rawData) : [],
                  dataKeys: responseData ? Object.keys(responseData) : [],
                  modelsIsArray: Array.isArray(availableModels),
                  modelsCount: Array.isArray(availableModels) ? availableModels.length : 0,
                  sampleModelNames,
               });
               if (!Array.isArray(availableModels)) {
                  logModelsDebug("response-invalid-models-shape", {
                     modelsType: typeof availableModels,
                     valuePreview: String(availableModels),
                  });
                  throw new Error("No available models");
               }

               modelTemperatureRanges = availableModels.reduce((acc: ModelTemperatureRanges, model: any) => {
                  acc[model.model] = model.temperature_range;
                  return acc;
               }, {});
               logModelsDebug("models-mapped", {
                  keysCount: Object.keys(modelTemperatureRanges).length,
                  sampleKeys: Object.keys(modelTemperatureRanges).slice(0, 5),
               });

               resolveAllPendingRequests(modelTemperatureRanges);
            })
            .catch((error: any) => {
               logModelsDebug("request-failed-using-fallback", {
                  errorName: error?.name,
                  errorMessage: error?.message,
                  responseStatus: error?.response?.status,
                  responseData: error?.response?.data,
               });
               modelTemperatureRanges = createErrorResponse();
               resolveAllPendingRequests(modelTemperatureRanges);
            })
            .finally(() => {
               logModelsDebug("request-finished", {
                  isFetchingBeforeReset: isFetching,
               });
               isFetching = false;
            });
      });
   };

   function resolveAllPendingRequests(models: ModelTemperatureRanges | null) {
      logModelsDebug("resolving-pending-requests", {
         pendingRequestsCount: pendingRequests.length,
         keysCount: models ? Object.keys(models).length : 0,
      });
      pendingRequests.forEach((pendingResolve) => pendingResolve(models));
      pendingRequests = [];
   }
}
