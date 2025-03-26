// \microai-frontend\app\context\AuthContext.tsx
"use client"; 

import axios from "axios";
import axiosInstance from "@/utils/axiosInstance";
import {
   createContext,
   FC,
   ReactNode,
   useCallback,
   useContext,
   useEffect,
   useMemo,
} from "react";
import { useRouter } from "next/navigation";
import { useDashboardStore } from "@/app/(authenticated)/(dashboard)/dashboard/[tab]/store/dashboardStore";
import { useUserStore } from "@/store/userStore";

interface AuthContextProps {
   isAuthenticated: boolean;
   authorizeUserWithJwt: (jwtData: any, signal?: AbortSignal) => Promise<void>;
   login: (email: string, password: string, signal?: AbortSignal) => Promise<void>;
   register: (email: string, password: string, signal?: AbortSignal) => Promise<void>;
   logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextProps | undefined>(undefined);

interface AuthProviderProps {
   children: ReactNode;
}

const handleApiError = (error: any) => {
   let errorMessage;
   if (axios.isAxiosError(error)) {
      console.error('Full error response:', error.response);
      
      // Handle Django's error response format
      if (error.response?.data) {
         const data = error.response.data;
         
         // Handle non-field errors
         if (data.non_field_errors) {
            errorMessage = data.non_field_errors[0];
         }
         // Handle field-specific errors
         else if (typeof data === 'object') {
            const firstError = Object.entries(data)[0];
            if (firstError) {
               const [field, messages] = firstError;
               // Convert field name to title case and format message
               const fieldName = field.charAt(0).toUpperCase() + field.slice(1).replace(/_/g, ' ');
               errorMessage = `${fieldName}: ${Array.isArray(messages) ? messages[0] : messages}`;
            }
         }
         // Fallback for other error formats
         else {
            errorMessage = typeof data === 'string' ? data : 'An error occurred during registration';
         }
      } else {
         errorMessage = error.message;
      }
   } else {
      errorMessage = error.message || "An error occurred";
   }
   console.error('Error details:', errorMessage);
   throw new Error(errorMessage);
};



/**
 * 
 * @param children 
 * @returns 
 */
export const AuthProvider: FC<AuthProviderProps> = ({ children }) => {
   const api = axiosInstance();
   const router = useRouter();
   const { 
      user,
      getUser,
      reset: resetUserStore
   } = useUserStore();

   /**
    * Checks if the auth credentials (tokens) are valid based on token presence and expiration
    * @returns boolean indicating if auth credentials are valid
    */
   const isAuthCredentialsValid = useCallback(() => {
      const token = typeof window !== 'undefined' ? localStorage.getItem("accessToken") : null;
      const tokenExpiration = typeof window !== 'undefined' ? localStorage.getItem("accessTokenExpiration") : null;
      
      if (!token || !tokenExpiration) {
        return false;
      }
      
      // Check if token is expired
      let expirationTime: number;
      
      // Handle both timestamp format and ISO date string format
      if (!isNaN(Number(tokenExpiration))) {
        // If it's already a number (Unix timestamp)
        expirationTime = parseInt(tokenExpiration, 10);
      } else {
        // If it's an ISO date string
        expirationTime = Math.floor(new Date(tokenExpiration).getTime() / 1000);
      }
      
      const currentTime = Math.floor(Date.now() / 1000);
      
      return expirationTime > currentTime;
   }, []);

   /**
    * Checks if the user is authenticated based on valid credentials AND user data
    * @returns boolean indicating if user is authenticated
    */
   const isAuthenticated = useMemo(() => {
      // First check if auth credentials are valid
      const credentialsValid = isAuthCredentialsValid();
      
      // Then check if user data is loaded
      return credentialsValid && !!user?.id;
   }, [isAuthCredentialsValid, user]);

   /**
    * Sets user authentication tokens from JWT data
    * @param {any} jwtData - The JWT data from the authentication response
    * @param {AbortSignal} signal - The signal to abort the request
    * @returns {Promise<void>}
    */
   const authorizeUserWithJwt = useCallback(async (jwtData: any, signal?: AbortSignal): Promise<void> => {
      if (!jwtData) {
      throw new Error('Invalid JWT data');
      }
   
      try {
         // Store the access token
         const token = jwtData.access;
         const tokenExpiration = jwtData.access_expiration;
     
         localStorage.setItem("accessToken", token);
         localStorage.setItem("accessTokenExpiration", tokenExpiration.toString());
     
         // Get user data with the new token
         await getUser(signal);
      } catch (error: any) {
         console.error('Error during JWT authorization:', error);
         throw new Error('Failed to authorize with provided JWT');
      }
   }, [getUser]);

   /**
    * Logs in a user
    * @param email - The email of the user
    * @param password - The password of the user
    * @param signal - The signal to abort the request
    * @returns 
    */
   const login = useCallback(async (email: string, password: string, signal?: AbortSignal): Promise<void> => {
      try {
         // Create a new axios instance without auth headers for login
         const loginApi = axios.create({
            baseURL: process.env.NEXT_PUBLIC_API_URL,
            headers: {
               "Content-Type": "application/json",
            },
            withCredentials: true
         });
         const { data } = await loginApi.post('/api/auth/login/', {
            email,
            password,
         }, { signal });

         if (data.status === 'success' && data.jwt) {
            await authorizeUserWithJwt(data.jwt, signal);
         } else if (data.status === 'otp_required') {
            // Handle 2FA if implemented
            throw new Error('2FA is required');
         } else {
            throw new Error('Login failed');
         }
      } catch (error: any) {
         handleApiError(error);
      }
   }, [authorizeUserWithJwt]);

   /**
    * Registers a new user
    * @param email - The email of the user
    * @param password - The password of the user
    * @param signal - The signal to abort the request
    * @returns 
    */
   const register = useCallback(async (email: string, password: string, signal?: AbortSignal): Promise<void> => {
      try {
         // Create a new axios instance without auth headers for registration
         const registerApi = axios.create({
            baseURL: process.env.NEXT_PUBLIC_API_URL,
            headers: {
               "Content-Type": "application/json",
            },
            withCredentials: true
         });

         await registerApi.post('/api/auth/register/', {
            email,
            password1: password,
            password2: password,
         }, { signal });

         // Instead of expecting tokens, we'll show a success message
         // The user needs to verify their email before they can log in
         return;
      } catch (error: any) {
         handleApiError(error);
      }
   }, []);

   /**
    * Logs out a user
    * @returns 
    */
   const logout = useCallback(async (): Promise<void> => {
      try {
         await api.post('/api/auth/logout/');
      } catch (error: any) {
         handleApiError(error);
      } finally {
         localStorage.removeItem('accessToken');
         localStorage.removeItem('accessTokenExpiration');
         router.push('/accounts/login');
         useDashboardStore.getState().reset();
         resetUserStore();
      }
   }, [resetUserStore, router, api]);

   useEffect(() => {
      const controller = new AbortController();
      const signal = controller.signal;

      // Fetch user data if credentials are valid but user data is missing
      if (isAuthenticated === false) {
         getUser(signal);
      }

      return () => {
         controller.abort();
      }
   }, [getUser, user, isAuthenticated]);
   

   return (
      <AuthContext.Provider
         value={{ 
            isAuthenticated,
            authorizeUserWithJwt,
            login,
            register,
            logout
         }}
      >
         {children}
      </AuthContext.Provider>
   );
};

export const useAuth = (): AuthContextProps => {
   const context = useContext(AuthContext);
   if (!context) {
      throw new Error("useAuth must be used within an AuthProvider");
   }
   return context;
};