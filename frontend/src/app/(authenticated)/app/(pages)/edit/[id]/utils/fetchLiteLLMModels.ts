// \microai-frontend\app\hooks\fetchLiteLLMModels.ts

import axiosInstance from "@/utils//axiosInstance"
import { ModelTemperatureRanges } from "@/app/(authenticated)/app/types";

export interface LiteLLMModelsResult {
   models: ModelTemperatureRanges;
   defaultModel: string | null;
}

function createErrorResponse(): LiteLLMModelsResult {
   return {
      models: {
         "Failed to load list of LLM models...": { min: 0, max: 0 },
      },
      defaultModel: null,
   };
}

/**
 * Async singleton, so if API request hasn't been resolved yet it puts all requests to queue
 */
export const fetchLiteLLMModelsSingleton = (): () => Promise<LiteLLMModelsResult | null> => {
   const api = axiosInstance();
   let result: LiteLLMModelsResult | null = null;
   let pendingRequests: Array<(r: LiteLLMModelsResult | null) => void> = [];
   let isFetching = false;

   return async () => {
      if (result !== null) {
         return result;
      }

      return new Promise<LiteLLMModelsResult | null>((resolve) => {
         pendingRequests.push(resolve);
         if (isFetching) {
            return;
         }

         isFetching = true;

         api.get(`/api/microapps/models/litellm-configuration/`)
            .then((response: any) => {
               const availableModels: any[] = response?.data?.data?.models ?? [];
               if (!Array.isArray(availableModels)) {
                  throw new Error("No available models");
               }

               const models = availableModels.reduce((acc: ModelTemperatureRanges, model: any) => {
                  acc[model.model] = model.temperature_range;
                  return acc;
               }, {});

               const defaultEntry = availableModels.find(
                  (m) => Array.isArray(m.tags) && m.tags.includes('default')
               );

               result = { models, defaultModel: defaultEntry?.model ?? null };
               resolveAllPendingRequests(result);
            })
            .catch(() => {
               result = createErrorResponse();
               resolveAllPendingRequests(result);
            })
            .finally(() => {
               isFetching = false;
            });
      });
   };

   function resolveAllPendingRequests(r: LiteLLMModelsResult | null) {
      pendingRequests.forEach((pendingResolve) => pendingResolve(r));
      pendingRequests = [];
   }
}
