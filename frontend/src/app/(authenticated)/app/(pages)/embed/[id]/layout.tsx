"use client";

import { ToastContainer } from "react-toastify";
import AccessDenied from "@/components/access-denied";
import SkeletonLoader from "@/components/layout/loading/skeletonLoader";
import { useAuth } from "@/context/AuthContext";
import { useMicroappAccess } from "@/hooks/useMicroappAccess";

export default function EmbedLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { id: string };
}) {
  const { isAuthenticated } = useAuth();
  const { shellLoading, isAuthorized } = useMicroappAccess(params.id, "embed");

  if (shellLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <SkeletonLoader />
      </div>
    );
  }

  if (!isAuthorized && isAuthenticated) {
    return (
      <>
        <ToastContainer />
        <AccessDenied />
      </>
    );
  }

  if (isAuthorized && isAuthenticated) {
    return (
      <>
        <ToastContainer />
        <div className="bg-white">
          {children ? children : <div></div>}
        </div>
      </>
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
