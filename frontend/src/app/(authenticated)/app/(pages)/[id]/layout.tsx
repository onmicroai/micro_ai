"use client";

import { ToastContainer } from "react-toastify";
import AccessDenied from "@/components/access-denied";
import SkeletonLoader from "@/components/layout/loading/skeletonLoader";
import { useMicroappAccess } from "@/hooks/useMicroappAccess";

export default function RootLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { id: string };
}) {
  const { shellLoading, isAuthorized } = useMicroappAccess(params.id, "run");

  if (shellLoading) {
    return (
      <>
        <ToastContainer />
        <SkeletonLoader variant="app" />
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
      {children ? children : <div></div>}
    </>
  );
}
