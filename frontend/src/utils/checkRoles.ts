import axiosInstance from "@/utils//axiosInstance";

interface CheckIsOwnerResult {
  isOwner: boolean;
  error: string | null;
}

interface CheckIsAdminResult {
  isAdmin: boolean;
  error: string | null;
}

interface CheckRoleResult {
  roles: string[];
  error: string | null;
}


// Map to track pending requests by hashId and userId
const pendingRequests: Map<string, Promise<CheckRoleResult>> = new Map();

/**
 * Makes an API request to check user roles
 * @param hashId - The hash ID of the app
 * @param userId - The ID of the user
 * @param signal - The abort signal for the request
 * @returns Promise with check role result
 */
const makeRequest = async (hashId: string, userId: number, signal: AbortSignal): Promise<CheckRoleResult> => {
  try {
    const response = await axiosInstance().get(`/api/microapps/hash/${hashId}/user/${userId}`, {
      signal: signal
    });
    const roles = response.data.data.map((role: any) => role.role);
    
    const result = {
      roles,
      error: null
    };
    
    // Previously cached result removed – we now rely on fresh fetches.
    
    return result;
  } catch (error: any) {
    const errorName = error?.name;
    if (errorName && errorName !== 'AbortError' && errorName !== 'CanceledError') {
      console.error('Error checking roles:', error);
    }
    
    const result = {
      roles: [],
      error: 'Failed to check roles'
    };
    
    // Do not cache error result to allow retry on next call.
    
    return result;
  }
};

/**
 * Check the roles of a user for a specific app
 * @param hashId - The hash ID of the app
 * @param userId - The ID of the user
 * @param signal - The abort signal for the request
 * @returns The roles of the user or an error
 */
export const checkRole = async (hashId: string, userId: number | null, signal: AbortSignal): Promise<CheckRoleResult> => {
  if (userId === null) {
    const result = {
      roles: [],
      error: 'User ID is null'
    };
    // No-op: result not cached.
    return result;
  }

  // Create a unique key for this request
  const requestKey = `${hashId}:${userId}`;
  
  // If there's already a pending request for this hashId and userId, return that promise
  if (pendingRequests.has(requestKey)) {
    return pendingRequests.get(requestKey)!.catch(error => {
      // Only handle abort/cancel errors
      const isAborted = 
        error?.name === 'AbortError' || 
        error?.name === 'CanceledError';
      
      if (isAborted) {
        pendingRequests.delete(requestKey);
        const newRequest = makeRequest(hashId, userId, signal).finally(() => {
          pendingRequests.delete(requestKey);
        });
        pendingRequests.set(requestKey, newRequest);
        return newRequest;
      }
      
      // Rethrow other errors
      throw error;
    });
  }

  // Create the actual request and cleanup function
  const requestPromise = makeRequest(hashId, userId, signal).finally(() => {
    // Remove this request from the pending requests map once completed
    pendingRequests.delete(requestKey);
  });

  // Store the promise in the pending requests map
  pendingRequests.set(requestKey, requestPromise);
  
  return requestPromise;
};

/**
 * Check if the user is the owner of the app
 * @param hashId - The hash ID of the app
 * @param userId - The ID of the user
 * @param signal - The abort signal for the request
 * @returns The result of the check
 */
export const checkIsOwner = async (hashId: string, userId: number | null, signal: AbortSignal): Promise<CheckIsOwnerResult> => {
  const { roles, error } = await checkRole(hashId, userId, signal);
  
  return {
    isOwner: roles.includes('owner'),
    error
  };
};

/**
 * Check if the user is an admin of the app
 * @param hashId - The hash ID of the app
 * @param userId - The ID of the user
 * @param signal - The abort signal for the request
 * @returns The result of the check
 */
export const checkIsAdmin = async (hashId: string, userId: number | null, signal: AbortSignal): Promise<CheckIsAdminResult> => {
  const { roles, error } = await checkRole(hashId, userId, signal);
  
  return {
    isAdmin: roles.includes('admin'),
    error
  };
};