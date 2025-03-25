import axiosInstance from "@/utils//axiosInstance"

interface CollectionItem {
   id: number;
   name: string;
}

interface FormattedCollectionItem {
   value: number;
   text: string;
}

function createErrorResponse(): CollectionItem[] {
   return [{
      id: -1,
      name: "Failed to load app collections..."
   }];
}

/**
 * Async singleton to fetch app collections
 * If API request hasn't been resolved yet, it puts all requests in a queue
 *  
 * @param appId The ID of the app to fetch collections for
 * @returns A function that returns a Promise resolving to an array of FormattedCollectionItem or null
 */
export function fetchAppCollectionsSingleton(appId: number): () => Promise<FormattedCollectionItem[] | null> {
   const api = axiosInstance();
   let appCollections: FormattedCollectionItem[] | null = null;
   let pendingRequests: Array<(collections: FormattedCollectionItem[] | null) => void> = [];
   let isFetching = false;

   return async () => {
      if (appCollections !== null) {
         return appCollections;
      }

      return new Promise<FormattedCollectionItem[] | null>((resolve) => {
         if (isFetching) {
            pendingRequests.push(resolve);
            return;
         }

         isFetching = true;
         
         api.get(`/api/collection/app/${appId}/collections/`)
            .then((response:any) => {
               const collectionsList:CollectionItem[] = response?.data;
               if (!Array.isArray(collectionsList)) {
                  throw new Error("Invalid response format");
               }

               appCollections = collectionsList.map((collection: CollectionItem) => ({
                  value: collection.id,
                  text: collection.name,
               }));

               resolveAllPendingRequests(appCollections);
            })
            .catch((error: any) => {
               console.error(`Failed to load collections for app ${appId}: `, error);
               appCollections = createErrorResponse().map(item => ({
                  value: item.id,
                  text: item.name,
               }));
               resolveAllPendingRequests(appCollections);
            })
            .finally(() => {
               isFetching = false;
            });
      });
   };

   function resolveAllPendingRequests(collections: FormattedCollectionItem[] | null) {
      pendingRequests.forEach((pendingResolve) => pendingResolve(collections));
      pendingRequests = [];
   }
}