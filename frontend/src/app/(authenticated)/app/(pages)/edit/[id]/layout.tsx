"use client";

import NavBarClientSwitch from "@/components/layout/navbar/NavBarClientSwitch";
import { ToastContainer } from "react-toastify";
import AccessDenied from "@/components/access-denied";
import SkeletonLoader from "@/components/layout/loading/skeletonLoader";
import { useAuth } from "@/context/AuthContext";
import { useMicroappAccess } from "@/hooks/useMicroappAccess";

/**
 * Edit UI must never be gated on app visibility alone: only owners or app admins
 * may load the builder, including when the microapp is public.
 */
export default function EditLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { id: string };
}) {
  const { isAuthenticated } = useAuth();
  const { shellLoading, isAuthorized } = useMicroappAccess(params.id, "edit");

  if (shellLoading) {
    return (
      <>
        <ToastContainer stacked position="bottom-left" hideProgressBar={true} />
        <NavBarClientSwitch />
        <SkeletonLoader variant="app" />
      </>
    );
  }

  if (!isAuthenticated || !isAuthorized) {
    return (
      <>
        <ToastContainer stacked position="bottom-left" hideProgressBar={true} />
        <NavBarClientSwitch />
        <AccessDenied />
      </>
    );
  }

  return (
    <>
      <ToastContainer stacked position="bottom-left" hideProgressBar={true} />
      <NavBarClientSwitch />
      {children}
    </>
  );
}
