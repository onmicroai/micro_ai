"use client";

import { ToastContainer } from "react-toastify";
import SkeletonLoader from "@/components/layout/loading/skeletonLoader";
import { useAuth } from "@/context/AuthContext";
import { useMicroappAccess } from "@/hooks/useMicroappAccess";
import { useRouter } from "next/navigation";

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
  const router = useRouter();
  const { id } = params;
  const { isAuthenticated } = useAuth();
  const { shellLoading, isAuthorized } = useMicroappAccess(id, "edit");

  if (shellLoading) {
    return (
      <>
        <ToastContainer stacked position="bottom-left" hideProgressBar={true} />
        <SkeletonLoader variant="app" />
      </>
    );
  }

  console.log("isAuthorized: ", isAuthorized);

  if (!isAuthenticated || !isAuthorized) {
    router.replace(`/app/${id}`);
  }

  /* Builder (FormBuilder) provides its own header; global nav is redundant here. */
  return (
    <>
      <ToastContainer stacked position="bottom-left" hideProgressBar={true} />
      {children}
    </>
  );
}
