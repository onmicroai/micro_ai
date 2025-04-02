import { create } from 'zustand';
import axiosInstance from '@/utils/axiosInstance';
import { getAccessToken } from '@/utils/tokenCookieUtils';

export interface User {
   id: number;
   email: string;
   firstName?: string;
   lastName?: string;
   profilePic?: string;
   slug?: string;
   isBetaTester: boolean;
}

interface UserState {
   user: User | null;
   isLoading: boolean;
   setUser: (user: User | null) => void;
   getUser: (signal?: AbortSignal) => Promise<User | null>;
   reset: () => void;
}

/**
 * Handles API errors
 * @param error - The error to handle
 * @returns void
 */
const handleApiError = (error: any) => {
   console.error('Error fetching user data:', error);
   throw error;
};

export const useUserStore = create<UserState>((set, get) => {
   
   /**
    * Private function not exposed in the interface
    * 
    * Sets the loading state
    * @param isLoading - The loading state to set
    * @returns void
    */
   const setLoading = (isLoading: boolean) => {
      return set({ isLoading });
   };
   
   /**
    * Private function not exposed in the interface
    * 
    * Fetches user data from the API
    * @param signal - AbortSignal for cancelling the request
    * @returns void
    */
   const fetchUserData = async (signal?: AbortSignal) => {
      setLoading(true);
      try {
         const accessToken = getAccessToken();
         if (!accessToken) {
            set({ user: null, isLoading: false });
            return;
         }

         const api = axiosInstance();
         const { data } = await api.get(`/api/auth/user/`, { signal });
         
         const userData = {
            id: data.id,
            email: data.email,
            firstName: data.first_name,
            lastName: data.last_name,
            profilePic: data.avatar_url,
            slug: data.slug,
            isBetaTester: data.is_beta_tester,
         };

         set({ user: userData });
      } catch (error: any) {
         if (error.name !== 'CanceledError') {
            handleApiError(error);
         }
      } finally {
         setLoading(false);
      }
   };
   
   return {
      user: null,
      isLoading: false,

      /**
       * Sets the user
       * @param user - The user to set
       * @returns void
       */
      setUser: (user) => set({ user }),

      /**
       * Fetches user data from the API
       * @param signal - AbortSignal for cancelling the request
       * @returns void
       */
      getUser: async (signal?: AbortSignal) => {
         const { user } = get();
         if (user !== null) return user;

         await fetchUserData(signal);
         return get().user;
      },

      /**
       * Resets the user store
       * @returns void
       */
      reset: () => set({ user: null, isLoading: false })
   };
}); 