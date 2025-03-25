"use client";

import PrivateNavbar from "@/components/layout/navbar/privateNavbar";
import { ToastContainer } from 'react-toastify';
import { useEffect, useState } from "react";
import { checkIsAdmin, checkIsOwner } from "@/utils//checkRoles";
import { checkIsPublic } from "@/utils//checkAppPrivacy";
import AccessDenied from "@/components/access-denied";
import SkeletonLoader from "@/components/layout/loading/skeletonLoader";
import { useUserStore } from "@/store/userStore";
import { useAuth } from "@/context/AuthContext";

export default function RootLayout({
   children,
   params,
}: {
   children: React.ReactNode;
   params: { id: string };
}) {
   const { isAuthenticated } = useAuth();
   const [isAuthorized, setIsAuthorized] = useState<boolean>(false);
   const [isLoading, setIsLoading] = useState(true);
   const { user, isLoading: userIsLoading } = useUserStore();
   const userId = user?.id ?? null;
   const hashId = params.id;

   useEffect(() => {
      const abortController = new AbortController();
      const signal = abortController.signal;

      /**
       * Check if the app is public or if the user is authorized to access it
       * @param signal - The abort signal for the request
       * @returns void
       */
      const checkAuthorization = async (signal: AbortSignal) => {
         try {
            const { isPublic, error } = await checkIsPublic(hashId, signal);
            
            if (error) {
               const errorName = error?.name;
               if (errorName && errorName !== 'AbortError' && errorName !== 'CanceledError') {
                  console.error('Error checking public status:', error);
                  setIsAuthorized(false);
               }
               
               return;
            }

            if (isPublic) {
               setIsAuthorized(true);
               return;
            }

            // If app is private, check user permissions
            if (userId !== null) {
               const [ownerResult, adminResult] = await Promise.all([
                  checkIsOwner(hashId, userId, signal),
                  checkIsAdmin(hashId, userId, signal)
               ]);

               setIsAuthorized(ownerResult.isOwner || adminResult.isAdmin);
            }
         } catch (error: any) {
            const errorName = error?.name;
            if (errorName && errorName !== 'AbortError' && errorName !== 'CanceledError') {
               console.error('Error checking authorization:', error);
            }
         } finally {
            setIsLoading(false);
         }
      };

      checkAuthorization(signal);

      return () => abortController.abort();
   }, [userId, hashId]);

   // Show loading state while waiting for user data
   if (userIsLoading || isLoading) {
      return (
        <>
          <ToastContainer />
          <PrivateNavbar />
          <SkeletonLoader variant="app" />
        </>
      );
   }

   if (!isAuthorized && isAuthenticated) {
      return (
         <>
            <ToastContainer />
            <PrivateNavbar />
            <AccessDenied />
         </>
      );
   }

   if (isAuthorized && isAuthenticated) {
      return (
        <>
          <ToastContainer />
          <PrivateNavbar />
          {children ? children : <div></div>}
        </>
      );
   }


   if (!isAuthorized) {
      return (
        <>
          <ToastContainer />
          <PrivateNavbar />
          <AccessDenied />
        </>
      );
   }

   return (
      <>
         <ToastContainer />
         <PrivateNavbar />
         {children ? children : <div></div>}
      </>
   );
}