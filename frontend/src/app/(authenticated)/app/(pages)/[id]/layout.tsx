"use client";

import NavBarClientSwitch from "@/components/layout/navbar/NavBarClientSwitch";
import { ToastContainer } from "react-toastify";
import AccessDenied from "@/components/access-denied";
import SkeletonLoader from "@/components/layout/loading/skeletonLoader";
import { useAuth } from "@/context/AuthContext";
import { useMicroappAccess } from "@/hooks/useMicroappAccess";

export default function RootLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { id: string };
}) {
  const { isAuthenticated } = useAuth();
  const { shellLoading, isAuthorized } = useMicroappAccess(params.id, "run");

  if (shellLoading) {
    return (
      <>
        <ToastContainer />
        <NavBarClientSwitch />
        <SkeletonLoader variant="app" />
      </>
    );
  }

  if (!isAuthorized && isAuthenticated) {
    return (
      <>
        <ToastContainer />
        <NavBarClientSwitch />
        <AccessDenied />
      </>
    );
  }

  if (isAuthorized && isAuthenticated) {
    return (
      <>
        <ToastContainer />
        <NavBarClientSwitch />
        {children ? children : <div></div>}
      </>
    );
  }

  if (!isAuthorized) {
    return (
      <>
        <ToastContainer />
        <NavBarClientSwitch />
        <AccessDenied />
      </>
    );
  }

  return (
    <>
      <ToastContainer />
      <NavBarClientSwitch />
      {children ? children : <div></div>}
    </>
  );
}
