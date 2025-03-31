import axiosInstance from "@/utils//axiosInstance"

/**
 * Updates the collection ID of a microapp
 * @param appId - The ID of the microapp
 * @param newCollectionId - The ID of the new collection
 * @param oldCollectionId - The ID of the old collection
 * @param signal - The AbortSignal to cancel the request
 */
export async function updateMicroappCollection(appId: number, newCollectionId: number, oldCollectionId?: number, signal?: AbortSignal) {
   const api = axiosInstance();

   if (oldCollectionId === newCollectionId) {
      return;
   }
 
   try {
     // Use the new PUT endpoint to move the app to the new collection in one step
     const response = await api.put(`/api/collection/${newCollectionId}/microapp/${appId}`, {
       collection_id: newCollectionId,
       ma_id: appId
     }, {
      signal: signal
     });
 
     return response.data;
   } catch (error) {
     console.error("Error updating microapp collection:", error);
     throw error;
   }
}