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
      name: "Failed to load user collections..."
   }];
}

/**
 * Async singleton to fetch user collections
 * If API request hasn't been resolved yet, it puts all requests in a queue
 *  
 * @returns A function that returns a Promise resolving to an array of CollectionItem or null
 */
export function fetchUserCollectionsSingleton(): () => Promise<FormattedCollectionItem[] | null> {
   const api = axiosInstance();
   let userCollections: FormattedCollectionItem[] | null = null;
   let pendingRequests: Array<(collections: FormattedCollectionItem[] | null) => void> = [];
   let isFetching = false;

   return async () => {
      if (userCollections !== null) {
         return userCollections;
      }

      return new Promise<FormattedCollectionItem[] | null>((resolve) => {
         if (isFetching) {
            pendingRequests.push(resolve);
            return;
         }

         isFetching = true;
         
         api.get(`/api/collection/user/admin`)
            .then((response:any) => {
               const collectionsList:CollectionItem[] = response?.data?.data;
               if (!Array.isArray(collectionsList)) {
                  throw new Error("Invalid response format");
               }

               userCollections = collectionsList.map((collection: CollectionItem) => ({
                  value: collection.id,
                  text: collection.name,
               }));

               resolveAllPendingRequests(userCollections);
            })
            .catch((error: any) => {
               console.error("Failed to load user collections: ", error);
               userCollections = createErrorResponse().map(item => ({
                  value: item.id,
                  text: item.name,
               }));
               resolveAllPendingRequests(userCollections);
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