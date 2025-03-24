"use client";

import { ToastContainer } from 'react-toastify';
import { useEffect, useState } from "react";
import { checkIsAdmin, checkIsOwner } from "@/utils/checkRoles";
import { checkIsPublic } from "@/utils/checkAppPrivacy";
import AccessDenied from "@/components/access-denied";
import SkeletonLoader from "@/components/layout/loading/skeletonLoader";
import { useUserStore } from "@/store/userStore";

export default function EmbedLayout({
   children,
   params,
}: {
   children: React.ReactNode;
   params: { id: string };
}) {
   const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
   const [isLoading, setIsLoading] = useState(true);
   const { user } = useUserStore();
   const userId = Number(user?.id);
   const hashId = params.id;

   useEffect(() => {
      const abortController = new AbortController();
      const signal = abortController.signal;

      const checkAuthorization = async () => {
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

            if (userId && hashId) {
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

      checkAuthorization();

      return () => abortController.abort();
   }, [userId, hashId]);

   if (isLoading) {
      return (
         <div className="flex justify-center items-center h-screen">
            <SkeletonLoader />
         </div>
      );
   }

   if (!isAuthorized) {
      return (
         <>
            <ToastContainer />
            <AccessDenied />
         </>
      );
   }

   return (
      <>
         <ToastContainer />
         <div className="bg-white">
            {children ? children : <div></div>}
         </div>
      </>
   );
} 