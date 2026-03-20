"use client";

import { ToastContainer } from "react-toastify";
import AccessDenied from "@/components/access-denied";
import SkeletonLoader from "@/components/layout/loading/skeletonLoader";
import { useMicroappAccess } from "@/hooks/useMicroappAccess";

export default function EmbedLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { id: string };
}) {
  const { shellLoading, isAuthorized } = useMicroappAccess(params.id, "embed");

  if (shellLoading) {
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
