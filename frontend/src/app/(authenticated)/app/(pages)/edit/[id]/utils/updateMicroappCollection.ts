import axiosInstance from "@/utils//axiosInstance"

/**
 * Adds a microapp to a collection (many-to-many).
 * @param appId - The ID of the microapp
 * @param collectionId - The ID of the collection
 * @param signal - The AbortSignal to cancel the request
 */
export async function addMicroappToCollection(
  appId: number,
  collectionId: number,
  signal?: AbortSignal
) {
  const api = axiosInstance();
  const response = await api.post(
    `/api/collection/${collectionId}/microapp/${appId}`,
    { collection_id: collectionId, ma_id: appId },
    { signal }
  );
  return response.data;
}

/**
 * Removes a microapp from a collection (many-to-many).
 * @param appId - The ID of the microapp
 * @param collectionId - The ID of the collection
 * @param signal - The AbortSignal to cancel the request
 */
export async function removeMicroappFromCollection(
  appId: number,
  collectionId: number,
  signal?: AbortSignal
) {
  const api = axiosInstance();
  await api.delete(`/api/collection/${collectionId}/microapp/${appId}`, {
    signal,
  });
}
