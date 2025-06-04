// \microai-frontend\app\hooks\etchAvailableModels.ts

import axiosInstance from "@/utils//axiosInstance"
import { ModelTemperatureRanges } from "@/app/(authenticated)/app/types";

 function createErrorResponse(): ModelTemperatureRanges {
    return {
       "Failed to load list of LLM models...": {
          min: 0,
          max: 0
       }
    };
 }

/**
 * Async singlton, so if API request hasn't been resolved yet it puts all requests to queue
 *  
 * @returns 
 */
export const fetchAvailableModelsSingleton = (): () => Promise<ModelTemperatureRanges | null> => {
   const api = axiosInstance();
   let modelTemperatureRanges: ModelTemperatureRanges | null = null;
   let pendingRequests: Array<(models: ModelTemperatureRanges | null) => void> = [];
   let isFetching = false;

   return async () => {
      if (modelTemperatureRanges !== null) {
         return modelTemperatureRanges;
      }

      return new Promise<ModelTemperatureRanges | null>((resolve) => {
         if (isFetching) {
            pendingRequests.push(resolve);
            return;
         }

         isFetching = true;
         
         api.get(`/api/microapps/models/configuration/`)
            .then((response:any) => {
               const availableModels = response?.data?.data;
               if (!Array.isArray(availableModels)) {
                  throw new Error("No available models");
               }

               modelTemperatureRanges = availableModels.reduce((acc: ModelTemperatureRanges, model: any) => {
                  acc[model.model] = model.temperature_range;
                  return acc;
               }, {});

               resolveAllPendingRequests(modelTemperatureRanges);
            })
            .catch(() => {
               modelTemperatureRanges = createErrorResponse();
               resolveAllPendingRequests(modelTemperatureRanges);
            })
            .finally(() => {
               isFetching = false;
            });
      });
   };

   function resolveAllPendingRequests(models: ModelTemperatureRanges | null) {
      pendingRequests.forEach((pendingResolve) => pendingResolve(models));
      pendingRequests = [];
   }
}